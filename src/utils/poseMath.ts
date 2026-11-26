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
}

export const EXERCISES: Record<CoachExercise, ExerciseSpec> = {
  squat: { id: 'squat', label: 'Squat', angleName: 'knee', top: 160, bottom: 100, tip: 'Film from the side, whole body in frame, knees and hips visible.' },
  pushup: { id: 'pushup', label: 'Push-up', angleName: 'elbow', top: 155, bottom: 95, tip: 'Film from the side at floor height, whole body in frame.' },
  deadlift: { id: 'deadlift', label: 'Deadlift', angleName: 'hip', top: 165, bottom: 125, tip: 'Film from the side, whole body in frame, bar in hands.' },
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
}

/** The body side the camera sees best, by landmark visibility. */
export function pickSide(lm: readonly Landmark[]): 'left' | 'right' {
  const vis = (ids: number[]) => ids.reduce((t, i) => t + (lm[i]?.visibility ?? 0), 0) / ids.length;
  return vis([LM.lShoulder, LM.lHip, LM.lKnee, LM.lAnkle]) >= vis([LM.rShoulder, LM.rHip, LM.rKnee, LM.rAnkle]) ? 'left' : 'right';
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
  const bar = mid(px(LM.lWrist), px(LM.rWrist));

  return {
    side,
    angle,
    hipBelowKnee: hip.y >= knee.y,
    bodyLine: angleDeg(sh, hip, ank),
    bar,
    torso: Math.max(dist(sh, hip), 1),
    confidence,
  };
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
}

/**
 * Counts reps from a joint-angle stream with hysteresis, and judges each one.
 *
 * A rep starts when the angle drops 15 degrees below the top, and ends when it
 * climbs back to the top. If it reached `bottom` in between it counts; if it
 * dipped meaningfully but never got there it is reported as a partial rep and
 * not counted. Frames below `minConfidence` are ignored, so a person walking
 * out of frame does not count as a rep.
 */
export class FormTracker {
  private phase: 'unknown' | 'top' | 'moving' = 'unknown';
  private minAngle = 180;
  private startT = 0;
  private bar: Pt[] = [];
  private depthSeen = false;
  private lineMin = 180;
  private good = 0;
  /** The bar path of the current rep, for drawing. */
  currentPath: Pt[] = [];
  /** Bar paths of finished reps (most recent last), for drawing. */
  readonly pastPaths: Pt[][] = [];

  constructor(
    private spec: ExerciseSpec,
    private minConfidence = 0.5,
    private minRepMs = 500
  ) {}

  get reps(): number {
    return this.good;
  }

  reset(): void {
    this.phase = 'unknown';
    this.good = 0;
    this.bar = [];
    this.currentPath = [];
    this.pastPaths.length = 0;
  }

  update(m: FrameMetrics, tMs: number): RepResult | null {
    if (m.confidence < this.minConfidence) return null;
    const { top, bottom } = this.spec;

    if (this.phase === 'unknown') {
      if (m.angle >= top) this.phase = 'top'; // wait to see the start position first
      return null;
    }

    if (this.phase === 'top') {
      if (m.angle < top - 15) {
        this.phase = 'moving';
        this.minAngle = m.angle;
        this.startT = tMs;
        this.bar = [m.bar];
        this.depthSeen = m.hipBelowKnee;
        this.lineMin = m.bodyLine;
      }
      return null;
    }

    // moving
    this.minAngle = Math.min(this.minAngle, m.angle);
    this.bar.push(m.bar);
    this.currentPath = this.bar;
    this.depthSeen = this.depthSeen || m.hipBelowKnee;
    this.lineMin = Math.min(this.lineMin, m.bodyLine);
    if (m.angle < top) return null;

    // Back at the top: the rep is over.
    this.phase = 'top';
    const durationMs = tMs - this.startT;
    const reachedDepth = this.minAngle <= bottom || (this.spec.id === 'squat' && this.depthSeen);
    const path = this.bar;
    this.bar = [];
    this.currentPath = [];
    if (durationMs < this.minRepMs) return null; // a twitch, not a rep
    if (!reachedDepth && this.minAngle > top - 30) return null; // barely moved

    const xs = path.map((p) => p.x);
    const barDrift = xs.length ? (Math.max(...xs) - Math.min(...xs)) / Math.max(m.torso, 1) : 0;
    this.pastPaths.push(path);
    if (this.pastPaths.length > 5) this.pastPaths.shift();
    return this.judge(reachedDepth, durationMs, barDrift);
  }

  private judge(reachedDepth: boolean, durationMs: number, barDrift: number): RepResult {
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
    }

    const kind: RepResult['kind'] = reachedDepth ? 'rep' : 'partial';
    if (kind === 'rep') this.good += 1;
    return { n: this.good, kind, minAngle: this.minAngle, durationMs, barDrift, depthOk: reachedDepth, quality, notes };
  }
}
