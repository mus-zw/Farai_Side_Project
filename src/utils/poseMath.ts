/**
 * The maths behind the Form Coach: One-Euro landmark smoothing, joint angles,
 * and rep counting with depth and bar-path feedback. Pure functions and small
 * classes; no DOM, no MediaPipe, so it can be tested with synthetic data.
 *
 * Landmark indices follow MediaPipe Pose (33 points): 11/12 shoulders,
 * 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles
 * (left/right).
 */

export interface Pt {
  x: number;
  y: number;
}
export interface Landmark extends Pt {
  z?: number;
  visibility?: number;
}

// --- One-Euro filter ------------------------------------------------------------------------

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/**
 * One-Euro filter (Casiez et al., 2012): a low-pass whose cutoff rises with
 * speed. Slow movement is smoothed hard (no jitter); fast movement passes
 * almost unfiltered (no lag).
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t: number | null = null;
  constructor(
    private minCutoff = 1.0,
    private beta = 0.02,
    private dCutoff = 1.0
  ) {}

  /** `tMs` is the sample time in milliseconds; it must increase. */
  filter(value: number, tMs: number): number {
    if (this.x === null || this.t === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += alphaFor(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alphaFor(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.t = null;
    this.dx = 0;
  }
}

/** One-Euro smoothing for every landmark's x and y. */
export class PoseSmoother {
  private fx: OneEuroFilter[] = [];
  private fy: OneEuroFilter[] = [];
  constructor(
    private minCutoff = 1.0,
    private beta = 0.02
  ) {}

  smooth(landmarks: readonly Landmark[], tMs: number): Landmark[] {
    return landmarks.map((l, i) => {
      const fx = (this.fx[i] ??= new OneEuroFilter(this.minCutoff, this.beta));
      const fy = (this.fy[i] ??= new OneEuroFilter(this.minCutoff, this.beta));
      return { ...l, x: fx.filter(l.x, tMs), y: fy.filter(l.y, tMs) };
    });
  }

  reset(): void {
    this.fx.forEach((f) => f.reset());
    this.fy.forEach((f) => f.reset());
  }
}

// --- Geometry --------------------------------------------------------------------------------------

/** The angle at b between segments b->a and b->c, in degrees (0-180). */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (mag === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export const LM = {
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const;

// --- Exercises -----------------------------------------------------------------------------------------

export type CoachExercise = 'squat' | 'pushup' | 'deadlift';

export interface ExerciseSpec {
  id: CoachExercise;
  label: string;
  /** What the tracked angle is. */
  angleName: string;
  /** Angle at or above this counts as standing / locked out (the top of a rep). */
  top: number;
  /** Angle at or below this counts as reaching depth. */
  bottom: number;
  tip: string;
  /** Short, specific camera set-up advice for this lift. */
  framing: string[];
}

export const EXERCISES: Record<CoachExercise, ExerciseSpec> = {
  squat: { id: 'squat', label: 'Squat', angleName: 'knee', top: 160, bottom: 100, tip: 'Film from the side, whole body in frame, knees and hips visible.', framing: ['Stand side-on to the camera (a 45° angle also works), about 2 to 3 m away.', 'Phone at hip height, steady, with your whole body from head to feet in frame.'] },
  pushup: { id: 'pushup', label: 'Push-up', angleName: 'elbow', top: 155, bottom: 95, tip: 'Film from the side at floor height, whole body in frame.', framing: ['Film from the side with the phone low, at floor or bench height, about 2 m away.', 'Keep shoulders, elbows and wrists in view and a clear space around you.'] },
  deadlift: { id: 'deadlift', label: 'Deadlift', angleName: 'hip', top: 165, bottom: 125, tip: 'Film from the side, whole body in frame, bar in hands.', framing: ['Stand side-on to the camera (45° also works), 2 to 3 m away, phone at hip height.', 'Keep your shoulders, hips and knees in view; do not let the bar or a rack hide them.'] },
};

export interface FrameMetrics {
  side: 'left' | 'right';
  /** The tracked joint angle for the exercise, in degrees. */
  angle: number;
  /** Hip crease below the top of the knee (side view): a squat depth check. */
  hipBelowKnee: boolean;
  /** Shoulder-hip-ankle angle, ~180 when the body is a straight line. */
  bodyLine: number;
  /** The "bar" in pixels: the midpoint of the wrists (hands are on the bar). */
  bar: Pt;
  /** Shoulder-to-hip length in pixels, used to scale distances. */
  torso: number;
  /** Mean visibility of the joints used, 0-1. */
  confidence: number;
  /** The lowest visibility among the three joints the angle is measured at, 0-1. One hidden joint ruins the angle. */
  jointVisibility: number;
}

/** The body side the camera sees best, by landmark visibility. */
export function pickSide(lm: readonly Landmark[]): 'left' | 'right' {
  const vis = (ids: number[]) => ids.reduce((t, i) => t + (lm[i]?.visibility ?? 0), 0) / ids.length;
  return vis([LM.lShoulder, LM.lHip, LM.lKnee, LM.lAnkle]) >= vis([LM.rShoulder, LM.rHip, LM.rKnee, LM.rAnkle]) ? 'left' : 'right';
}

/** The three joints an exercise's angle is measured at, as [index, name] for one side. */
function angleJoints(exercise: CoachExercise, left: boolean): [number, string][] {
  const J = left ? { sh: LM.lShoulder, el: LM.lElbow, wr: LM.lWrist, hip: LM.lHip, kn: LM.lKnee, an: LM.lAnkle } : { sh: LM.rShoulder, el: LM.rElbow, wr: LM.rWrist, hip: LM.rHip, kn: LM.rKnee, an: LM.rAnkle };
  if (exercise === 'squat') return [[J.hip, 'hip'], [J.kn, 'knee'], [J.an, 'ankle']];
  if (exercise === 'pushup') return [[J.sh, 'shoulder'], [J.el, 'elbow'], [J.wr, 'wrist']];
  return [[J.sh, 'shoulder'], [J.hip, 'hip'], [J.kn, 'knee']];
}

/** Names of the joints, on the best-seen side, that the camera cannot see well enough to measure. */
export function weakJoints(lm: readonly Landmark[], exercise: CoachExercise, minVisibility = 0.5): string[] {
  if (lm.length < 29) return [];
  return angleJoints(exercise, pickSide(lm) === 'left')
    .filter(([i]) => (lm[i]?.visibility ?? 0) < minVisibility)
    .map(([, name]) => name);
}

/** Metrics for one frame, in pixel space (landmarks are normalised 0-1, so pass the frame size). */
export function frameMetrics(lm: readonly Landmark[], width: number, height: number, exercise: CoachExercise): FrameMetrics | null {
  if (lm.length < 29) return null;
  const px = (i: number): Pt => ({ x: lm[i].x * width, y: lm[i].y * height });
  const side = pickSide(lm);
  const L = side === 'left';
  const sh = px(L ? LM.lShoulder : LM.rShoulder);
  const el = px(L ? LM.lElbow : LM.rElbow);
  const wr = px(L ? LM.lWrist : LM.rWrist);
  const hip = px(L ? LM.lHip : LM.rHip);
  const knee = px(L ? LM.lKnee : LM.rKnee);
  const ank = px(L ? LM.lAnkle : LM.rAnkle);

  const angle = exercise === 'squat' ? angleDeg(hip, knee, ank) : exercise === 'pushup' ? angleDeg(sh, el, wr) : angleDeg(sh, hip, knee);
  const idx = L
    ? [LM.lShoulder, LM.lElbow, LM.lWrist, LM.lHip, LM.lAnkle]
    : [LM.rShoulder, LM.rElbow, LM.rWrist, LM.rHip, LM.rAnkle];
  const used = exercise === 'pushup' ? idx : [idx[0], idx[3], L ? LM.lKnee : LM.rKnee, idx[4]];
  const confidence = used.reduce((t, i) => t + (lm[i]?.visibility ?? 0), 0) / used.length;
  const jointVisibility = Math.min(...angleJoints(exercise, L).map(([i]) => lm[i]?.visibility ?? 0));
  const bar = mid(px(LM.lWrist), px(LM.rWrist));

  return {
    side,
    angle,
    hipBelowKnee: hip.y >= knee.y,
    bodyLine: angleDeg(sh, hip, ank),
    bar,
    torso: Math.max(dist(sh, hip), 1),
    confidence,
    jointVisibility,
  };
}

// --- Angle smoothing -----------------------------------------------------------------------------------------------

/**
 * A short filter for one joint angle: the median of the last three samples (kills a one-frame spike)
 * followed by an exponential average whose time constant is in milliseconds, so it behaves the same at
 * 10 fps and 30 fps. About 70 ms adds a frame or two of lag and removes most jitter.
 */
export class AngleSmoother {
  private last: number[] = [];
  private ema: number | null = null;
  private t: number | null = null;
  constructor(private tauMs = 70) {}

  push(value: number, tMs: number): number {
    this.last.push(value);
    if (this.last.length > 3) this.last.shift();
    const sorted = [...this.last].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (this.ema === null || this.t === null) {
      this.ema = med;
    } else {
      const dt = Math.max(tMs - this.t, 1);
      this.ema += (1 - Math.exp(-dt / this.tauMs)) * (med - this.ema);
    }
    this.t = tMs;
    return this.ema;
  }

  reset(): void {
    this.last = [];
    this.ema = null;
    this.t = null;
  }
}

// --- Rep counting -------------------------------------------------------------------------------------------

export interface RepResult {
  /** 1-based count of good reps so far (partials do not increase it). */
  n: number;
  kind: 'rep' | 'partial';
  minAngle: number;
  durationMs: number;
  /** Sideways travel of the bar over the rep, as a fraction of torso length. */
  barDrift: number;
  depthOk: boolean;
  quality: 'good' | 'ok' | 'poor';
  notes: string[];
  /** How the rep was spent: going down, any pause at the bottom, and coming up. */
  tempo: { downMs: number; pauseMs: number; upMs: number };
}

export type RepPhase = 'idle' | 'ready' | 'descending' | 'bottom' | 'ascending';

export interface TrackerConfig {
  /** A frame needs the mean visibility of its joints at least this high. */
  minConfidence: number;
  /** ...and each of the angle's three joints at least this high. */
  minJointVisibility: number;
  /** A rep shorter than this is a twitch, not a rep. */
  minRepMs: number;
  /** A rep still unfinished after this long is abandoned rather than left to swallow the next one. */
  maxRepMs: number;
  /** After a rep, a new one cannot start for this long. */
  cooldownMs: number;
  /** Frames missing for longer than this, mid-rep, abandon the rep. */
  lostMs: number;
  /** Standing tall must be held this long before the tracker is ready. */
  readyDwellMs: number;
  /** A rep starts when the angle falls this far below the standing angle. */
  startDrop: number;
  /** A rep ends when the angle climbs back to within this many degrees of the standing angle. */
  finishBelowTop: number;
  /** Rising this far above the lowest point leaves the bottom (hysteresis, so jitter cannot re-enter it). */
  bottomRelease: number;
  /** Turning back this far from a peak or trough counts as a change of direction. */
  reversal: number;
  /** Time constant of the angle filter. */
  angleTauMs: number;
  /** Standing for this long without reaching the expected angle adapts to the angle actually reached. */
  adaptAfterMs: number;
}

export const DEFAULT_TRACKER: TrackerConfig = {
  minConfidence: 0.5,
  minJointVisibility: 0.5,
  minRepMs: 600,
  maxRepMs: 12_000,
  cooldownMs: 250,
  lostMs: 700,
  readyDwellMs: 150,
  startDrop: 12,
  finishBelowTop: 8,
  bottomRelease: 10,
  reversal: 12,
  angleTauMs: 70,
  adaptAfterMs: 2000,
};

/** A readout of what the tracker is doing, for the optional debug panel. */
export interface TrackerDebug {
  phase: RepPhase;
  angle: number;
  rawAngle: number;
  jointVisibility: number;
  /** The standing angle in use (adapts downwards if you never quite reach the default). */
  standing: number;
  startsBelow: number;
  depthAt: number;
  finishesAt: number;
  reps: number;
  partials: number;
  lastEvent: string;
  lastReject: string | null;
}

/**
 * Counts reps from a joint-angle stream and judges each one.
 *
 * It is a small state machine: idle (not yet standing tall) -> ready -> descending -> bottom -> ascending ->
 * ready. Every move between phases has its own threshold, and leaving the bottom is measured from the
 * lowest point reached, so noise around a threshold cannot flip it back and forth or count a rep twice.
 * A rep is only judged when it is complete. A frame whose joints are hidden is skipped; if they stay hidden
 * for `lostMs` mid-rep the rep is abandoned, never counted. A rep also ends in an abandon if it runs past
 * `maxRepMs`, so one stuck rep can never swallow the ones after it. If the person never quite reaches the
 * default standing angle, the tracker adapts to the angle they do reach instead of waiting forever.
 */
export class FormTracker {
  private cfg: TrackerConfig;
  private filter: AngleSmoother;
  private phase: RepPhase = 'idle';
  private standing: number;
  private good = 0;
  private partials = 0;

  private lastGoodT: number | null = null;
  private dwellStart: number | null = null;
  private idleSince: number | null = null;
  private peak = 0;
  private cooldownUntil = 0;

  // The rep in progress.
  private startT = 0;
  private minT = 0;
  private minAngle = 180;
  private ascMax = 0;
  /** The last moment the angle was at the top, so a rep is timed from when the person actually set off. */
  private topExitT: number | null = null;
  /** The highest angle seen since the last rep: where this person really stands, which can be above the default. */
  private topSeen = 0;
  /** Smoothed angle over the rep in progress, to time the descent, the pause and the ascent. */
  private trace: { t: number; a: number }[] = [];
  private reachedDepth = false;
  private lineMin = 180;
  private torso = 1;
  private bar: Pt[] = [];

  private rawAngle = 0;
  private smoothAngle = 0;
  private vis = 1;
  private lastEvent = 'Waiting for you to stand tall';
  private lastReject: string | null = null;

  /** The bar path of the current rep, for drawing. */
  currentPath: Pt[] = [];
  /** Bar paths of finished reps (most recent last), for drawing. */
  readonly pastPaths: Pt[][] = [];

  constructor(private spec: ExerciseSpec, config: Partial<TrackerConfig> = {}) {
    this.cfg = { ...DEFAULT_TRACKER, ...config };
    this.filter = new AngleSmoother(this.cfg.angleTauMs);
    this.standing = spec.top;
  }

  get reps(): number {
    return this.good;
  }
  get partialReps(): number {
    return this.partials;
  }
  get currentPhase(): RepPhase {
    return this.phase;
  }

  reset(): void {
    this.filter.reset();
    this.phase = 'idle';
    this.standing = this.spec.top;
    this.good = 0;
    this.partials = 0;
    this.lastGoodT = null;
    this.dwellStart = null;
    this.idleSince = null;
    this.peak = 0;
    this.cooldownUntil = 0;
    this.topExitT = null;
    this.topSeen = 0;
    this.clearRep();
    this.pastPaths.length = 0;
    this.lastEvent = 'Waiting for you to stand tall';
    this.lastReject = null;
  }

  debug(): TrackerDebug {
    return {
      phase: this.phase,
      angle: this.smoothAngle,
      rawAngle: this.rawAngle,
      jointVisibility: this.vis,
      standing: this.standing,
      startsBelow: this.startsBelow,
      depthAt: this.spec.bottom,
      finishesAt: this.finishesAt,
      reps: this.good,
      partials: this.partials,
      lastEvent: this.lastEvent,
      lastReject: this.lastReject,
    };
  }

  private get startsBelow(): number {
    return this.standing - this.cfg.startDrop;
  }
  private get finishesAt(): number {
    return this.standing - this.cfg.finishBelowTop;
  }
  private get inRep(): boolean {
    return this.phase === 'descending' || this.phase === 'bottom' || this.phase === 'ascending';
  }

  /** Tell the tracker nothing usable was seen at `tMs` (no person, or joints hidden). */
  lost(tMs: number, reason = 'no person in view'): void {
    this.lastEvent = reason;
    if (this.inRep && this.lastGoodT !== null && tMs - this.lastGoodT > this.cfg.lostMs) this.abort('lost tracking mid-rep');
  }

  update(m: FrameMetrics, tMs: number): RepResult | null {
    if (m.confidence < this.cfg.minConfidence || m.jointVisibility < this.cfg.minJointVisibility) {
      this.vis = m.jointVisibility;
      this.lost(tMs, 'a joint is hard to see');
      return null;
    }
    if (this.lastGoodT !== null && tMs - this.lastGoodT > this.cfg.lostMs) {
      // A long gap: whatever the person was doing, it is not a continuous rep. Start the filter fresh.
      if (this.inRep) this.abort('lost tracking mid-rep');
      this.filter.reset();
      this.dwellStart = null;
      this.idleSince = null;
    }
    this.lastGoodT = tMs;
    this.rawAngle = m.angle;
    this.vis = m.jointVisibility;
    this.torso = m.torso;
    const a = this.filter.push(m.angle, tMs);
    this.smoothAngle = a;

    if (this.phase === 'idle') {
      this.idleSince ??= tMs;
      this.peak = Math.max(this.peak, a);
      if (a >= this.finishesAt) {
        this.dwellStart ??= tMs;
        if (tMs - this.dwellStart >= this.cfg.readyDwellMs) {
          this.phase = 'ready';
          this.topSeen = a;
          this.topExitT = tMs;
          this.idleSince = null;
          this.dwellStart = null;
          this.peak = 0;
          this.lastEvent = 'Ready';
        }
      } else {
        this.dwellStart = null;
        // Standing, but never quite at the expected angle (camera angle, flexibility): adapt rather than stall.
        if (tMs - this.idleSince >= this.cfg.adaptAfterMs && this.peak < this.finishesAt && this.peak >= this.spec.bottom + 45) {
          this.standing = this.peak;
          this.lastEvent = `Adapted: standing angle is ${Math.round(this.peak)}°`;
          this.peak = 0;
        }
      }
      return null;
    }

    if (this.phase === 'ready') {
      if (a >= this.finishesAt) this.topSeen = Math.max(this.topSeen, a);
      if (this.topSeen > 0 && a >= this.topSeen - 3) this.topExitT = tMs;
      if (tMs >= this.cooldownUntil && a < this.startsBelow) {
        this.clearRep();
        this.phase = 'descending';
        this.startT = this.topExitT ?? tMs;
        this.trace = [{ t: tMs, a }];
        this.minT = tMs;
        this.minAngle = a;
        this.ascMax = a;
        this.lineMin = m.bodyLine;
        this.bar = [m.bar];
        this.currentPath = this.bar;
        this.lastEvent = 'Descending';
        this.lastReject = null;
      }
      return null;
    }

    return this.stepRep(m, a, tMs);
  }

  private stepRep(m: FrameMetrics, a: number, tMs: number): RepResult | null {
    if (tMs - this.startT > this.cfg.maxRepMs) {
      this.abort('rep took too long', a);
      return null;
    }
    this.bar.push(m.bar);
    if (this.bar.length > 900) this.bar.shift();
    this.currentPath = this.bar;
    if (this.trace.length < 1500) this.trace.push({ t: tMs, a });
    this.lineMin = Math.min(this.lineMin, m.bodyLine);
    if (a < this.minAngle) {
      this.minAngle = a;
      this.minT = tMs;
    }
    const depthNow = a <= this.spec.bottom || (this.spec.id === 'squat' && m.hipBelowKnee);

    if (this.phase === 'descending') {
      if (depthNow) {
        this.phase = 'bottom';
        this.reachedDepth = true;
        this.lastEvent = 'Bottom';
      } else if (a >= this.finishesAt) {
        return this.finish(tMs);
      } else if (a - this.minAngle >= this.cfg.reversal) {
        this.phase = 'ascending';
        this.ascMax = a;
        this.lastEvent = 'Ascending (no depth yet)';
      }
    } else if (this.phase === 'bottom') {
      if (a - this.minAngle >= this.cfg.bottomRelease) {
        this.phase = 'ascending';
        this.ascMax = a;
        this.lastEvent = 'Ascending';
      }
    } else {
      this.ascMax = Math.max(this.ascMax, a);
      if (a >= this.finishesAt) return this.finish(tMs);
      if (this.ascMax - a >= this.cfg.reversal) {
        // Turned back down before reaching the top: a bounce or a second dip inside the same rep.
        this.phase = this.reachedDepth ? 'bottom' : 'descending';
        this.minAngle = Math.min(this.minAngle, a);
        this.lastEvent = this.reachedDepth ? 'Bounce at the bottom' : 'Descending again';
      } else if (!this.reachedDepth && depthNow) {
        this.phase = 'bottom';
        this.reachedDepth = true;
      }
    }
    return null;
  }

  private clearRep(): void {
    this.bar = [];
    this.currentPath = [];
    this.trace = [];
    this.reachedDepth = false;
  }

  /** Give up on the rep in progress without counting it. */
  private abort(why: string, angle?: number): void {
    this.lastReject = why;
    this.lastEvent = `Rep abandoned: ${why}`;
    this.clearRep();
    this.phase = angle !== undefined && angle >= this.finishesAt ? 'ready' : 'idle';
    this.topSeen = 0;
    this.idleSince = null;
    this.dwellStart = null;
    this.peak = 0;
  }

  private finish(tMs: number): RepResult | null {
    const durationMs = tMs - this.startT;
    const reached = this.reachedDepth;
    const range = this.standing - this.minAngle;
    const path = this.bar;
    // Time the three parts of the rep from the angle trace: "near the bottom" is within 8 degrees of the lowest point.
    const near = this.trace.filter((p) => p.a <= this.minAngle + 8).map((p) => p.t);
    const nearFirst = near.length ? near[0] : this.minT;
    const nearLast = near.length ? near[near.length - 1] : this.minT;
    const tempo = { downMs: Math.max(0, nearFirst - this.startT), pauseMs: Math.max(0, nearLast - nearFirst), upMs: Math.max(0, tMs - nearLast) };
    this.clearRep();
    this.phase = 'ready';
    this.topSeen = 0; // learn the top again as the person finishes standing up
    this.cooldownUntil = tMs + this.cfg.cooldownMs;

    if (durationMs < this.cfg.minRepMs) {
      this.lastReject = `too quick (${Math.round(durationMs)} ms)`;
      this.lastEvent = 'Ignored a twitch';
      return null;
    }
    if (!reached && range < 30) {
      this.lastReject = 'barely moved';
      this.lastEvent = 'Ignored a small movement';
      return null;
    }
    const xs = path.map((p) => p.x);
    const barDrift = xs.length ? (Math.max(...xs) - Math.min(...xs)) / Math.max(this.torso, 1) : 0;
    this.pastPaths.push(path);
    if (this.pastPaths.length > 5) this.pastPaths.shift();
    const rep = this.judge(reached, durationMs, barDrift, tempo);
    this.lastEvent = rep.kind === 'rep' ? `Rep ${rep.n} counted` : 'Partial rep (not counted)';
    return rep;
  }

  private judge(reachedDepth: boolean, durationMs: number, barDrift: number, tempo: RepResult['tempo']): RepResult {
    const id = this.spec.id;
    const notes: string[] = [];
    let quality: RepResult['quality'] = 'good';
    const downgrade = (q: RepResult['quality']) => {
      if (q === 'poor' || (q === 'ok' && quality === 'good')) quality = q;
    };

    if (!reachedDepth) {
      notes.push(id === 'squat' ? 'Shallow: aim for hip crease below the knee.' : id === 'pushup' ? 'Shallow: lower until your elbows reach about 90°.' : 'Not a full pull: finish with hips and knees fully extended.');
      downgrade('poor');
    } else if (id === 'squat') {
      notes.push(this.minAngle <= this.spec.bottom ? 'Good depth.' : 'Depth reached (hip below knee).');
    } else if (id === 'pushup') {
      notes.push('Good depth.');
    } else {
      notes.push('Full lockout.');
    }

    if (id === 'pushup' && this.lineMin < 160) {
      notes.push(`Keep your body in one line (hips sagged or piked, ${Math.round(this.lineMin)}°).`);
      downgrade('ok');
    }
    if (id !== 'pushup' && barDrift > 0.35) {
      notes.push(`Bar path drifted ${Math.round(barDrift * 100)}% of torso length: keep it over mid-foot.`);
      downgrade(barDrift > 0.6 ? 'poor' : 'ok');
    } else if (id !== 'pushup') {
      notes.push('Bar path steady.');
    }
    if (durationMs < 900) {
      notes.push('Fast rep: control the descent.');
      downgrade('ok');
    } else if (tempo.downMs < 700) {
      // The descent is timed from leaving the top to reaching the bottom, which reads about 70% of how long
      // the whole lowering felt: 700 ms here is a descent of about a second.
      notes.push('Rushed descent: about 2 s down is a good target.');
      downgrade('ok');
    }

    const kind: RepResult['kind'] = reachedDepth ? 'rep' : 'partial';
    if (kind === 'rep') this.good += 1;
    else this.partials += 1;
    return { n: this.good, kind, minAngle: this.minAngle, durationMs, barDrift, depthOk: reachedDepth, quality, notes, tempo };
  }
}

// --- Post-set summary -----------------------------------------------------------------------------------------------

/**
 * What is kept after a set: counts, depth and tempo averages and a few plain-language cues. Only numbers
 * and short text, never an image, a landmark or an angle series, so it is safe to keep on the device and
 * would pass the cloud privacy guard if it were ever synced.
 */
export interface FormSetSummary {
  exercise: CoachExercise;
  /** When the set ended, epoch ms. */
  at: number;
  reps: number;
  partials: number;
  durationMs: number;
  /** Lowest tracked angle per counted rep: the average and the deepest, in degrees. */
  avgDepth: number;
  bestDepth: number;
  avgDownMs: number;
  avgPauseMs: number;
  avgUpMs: number;
  quality: { good: number; ok: number; poor: number };
  cues: string[];
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const secs = (ms: number) => (ms / 1000).toFixed(1);

/** A summary of a finished set, or null if nothing was counted or attempted. */
export function summarizeSet(exercise: CoachExercise, reps: readonly RepResult[], durationMs: number, at: number): FormSetSummary | null {
  const counted = reps.filter((r) => r.kind === 'rep');
  const partials = reps.length - counted.length;
  if (reps.length === 0) return null;

  const downs = counted.map((r) => r.tempo.downMs);
  const ups = counted.map((r) => r.tempo.upMs);
  const quality = { good: 0, ok: 0, poor: 0 };
  for (const r of counted) quality[r.quality] += 1;
  const avgDown = mean(downs);

  const cues: string[] = [];
  const depthCue = exercise === 'squat' ? 'hip crease below the knee' : exercise === 'pushup' ? 'elbows near 90°' : 'full lockout';
  if (partials > 0) cues.push(`${partials} of ${reps.length} reps were partials: go to ${depthCue}.`);
  if (counted.length >= 2 && avgDown < 900) cues.push(`Descents averaged ${secs(avgDown)} s: aim for about 2 s down.`);
  if (counted.length >= 4) {
    const third = Math.max(1, Math.floor(counted.length / 3));
    const first = mean(ups.slice(0, third));
    const lastUp = mean(ups.slice(-third));
    if (first > 0 && lastUp > first * 1.5) cues.push(`Reps slowed from ${secs(first)} s to ${secs(lastUp)} s up: the set got hard at the end.`);
  }
  if (exercise !== 'pushup' && counted.length && mean(counted.map((r) => r.barDrift)) > 0.35) cues.push('Bar path wandered: keep it over mid-foot.');
  if (exercise === 'pushup' && counted.some((r) => r.notes.some((n) => n.includes('one line')))) cues.push('Keep your body in one line through the whole set.');
  if (cues.length === 0 && counted.length > 0) cues.push('Consistent set: every rep reached depth.');

  return {
    exercise,
    at,
    reps: counted.length,
    partials,
    durationMs: Math.round(durationMs),
    avgDepth: Math.round(mean(counted.map((r) => r.minAngle))),
    bestDepth: counted.length ? Math.round(Math.min(...counted.map((r) => r.minAngle))) : 0,
    avgDownMs: Math.round(avgDown),
    avgPauseMs: Math.round(mean(counted.map((r) => r.tempo.pauseMs))),
    avgUpMs: Math.round(mean(ups)),
    quality,
    cues: cues.slice(0, 3),
  };
}

const EXERCISE_IDS: CoachExercise[] = ['squat', 'pushup', 'deadlift'];
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

/** A stored or imported summary, validated and clamped; null if it is not one. */
export function cleanFormSet(v: unknown): FormSetSummary | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const q = (o.quality && typeof o.quality === 'object' ? o.quality : {}) as Record<string, unknown>;
  const exercise = EXERCISE_IDS.includes(o.exercise as CoachExercise) ? (o.exercise as CoachExercise) : null;
  const at = num(o.at, 0, 8.64e15);
  const reps = num(o.reps, 0, 500);
  const partials = num(o.partials, 0, 500);
  if (!exercise || at === null || reps === null || partials === null) return null;
  return {
    exercise,
    at,
    reps,
    partials,
    durationMs: num(o.durationMs, 0, 3_600_000) ?? 0,
    avgDepth: num(o.avgDepth, 0, 180) ?? 0,
    bestDepth: num(o.bestDepth, 0, 180) ?? 0,
    avgDownMs: num(o.avgDownMs, 0, 60_000) ?? 0,
    avgPauseMs: num(o.avgPauseMs, 0, 60_000) ?? 0,
    avgUpMs: num(o.avgUpMs, 0, 60_000) ?? 0,
    quality: { good: num(q.good, 0, 500) ?? 0, ok: num(q.ok, 0, 500) ?? 0, poor: num(q.poor, 0, 500) ?? 0 },
    cues: Array.isArray(o.cues) ? o.cues.filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 140)).slice(0, 4) : [],
  };
}

// --- Lighting -------------------------------------------------------------------------------------------------------------

/** Average brightness (0-255) of a tiny downsampled view of the frame: all of it, the middle, and the border. */
export interface LumaSample {
  mean: number;
  center: number;
  edge: number;
}

/** Plain advice when the light is likely to hurt tracking, or null when it looks fine. */
export function lightingHint(s: LumaSample): string | null {
  if (s.mean < 50) return 'It is too dark to track you well: face a light or switch one on.';
  if (s.edge > 150 && s.center < s.edge * 0.55) return 'Strong backlight: move so a window or lamp is not behind you.';
  if (s.mean > 235) return 'The image is overexposed: avoid direct sun on the lens.';
  return null;
}

/** A short sentence for joints the camera cannot see well, or null if none. */
export function visibilityHint(joints: readonly string[]): string | null {
  if (joints.length === 0) return null;
  return `Cannot see your ${joints.join(' and ')} clearly: turn side-on, step back so your whole body is in frame, or add light.`;
}
