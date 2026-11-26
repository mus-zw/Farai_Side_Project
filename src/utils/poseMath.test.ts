/// <reference types="node" />
/**
 * Rep counting on synthetic angle streams: the failure modes of a camera-based counter (noise, a lockout
 * that never reaches the textbook angle, twitches, jitter at a threshold, a joint that drops out) each get a
 * test. No camera, no MediaPipe: just numbers shaped like a person moving.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findForbidden } from '../lib/cloudDocs';
import {
  AngleSmoother, EXERCISES, FormTracker, FrameMetrics, Landmark, RepResult, cleanFormSet, frameMetrics, lightingHint, summarizeSet, visibilityHint, weakJoints,
} from './poseMath';

const FPS = 15;
const DT = 1000 / FPS;

interface Frame {
  t: number;
  m: FrameMetrics;
  /** True when the frame should be treated as "no person at all" (tracker.lost) rather than a low-visibility frame. */
  gone?: boolean;
}

/** A tiny deterministic noise source so "noisy" tests are repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

interface Move {
  to: number;
  ms: number;
  /** Visibility for these frames (default 1). */
  vis?: number;
  gone?: boolean;
}

function stream(start: number, moves: Move[], opts: { noise?: number; seed?: number; hipDepthBelow?: number } = {}): Frame[] {
  const rand = rng(opts.seed ?? 1);
  const frames: Frame[] = [];
  let a = start;
  let t = 0;
  for (const mv of moves) {
    const n = Math.max(1, Math.round(mv.ms / DT));
    const from = a;
    for (let i = 1; i <= n; i++) {
      const angle = from + (mv.to - from) * ease(i / n) + (opts.noise ?? 0) * rand();
      t += DT;
      const vis = mv.vis ?? 1;
      frames.push({
        t,
        gone: mv.gone,
        m: {
          side: 'left', angle, hipBelowKnee: opts.hipDepthBelow !== undefined && angle <= opts.hipDepthBelow, bodyLine: 178,
          bar: { x: 200, y: 400 - angle }, torso: 100, confidence: vis, jointVisibility: vis,
        },
      });
    }
    a = mv.to;
  }
  return frames;
}

function run(frames: Frame[], tracker = new FormTracker(EXERCISES.squat)) {
  const results: RepResult[] = [];
  for (const f of frames) {
    if (f.gone) {
      tracker.lost(f.t);
      continue;
    }
    const r = tracker.update(f.m, f.t);
    if (r) results.push(r);
  }
  return { tracker, results };
}

/** One squat: down, a pause, up, and a rest at the top. */
const rep = (top = 172, bottom = 85, o: { down?: number; pause?: number; up?: number; rest?: number } = {}): Move[] => [
  { to: bottom, ms: o.down ?? 1600 },
  { to: bottom, ms: o.pause ?? 300 },
  { to: top, ms: o.up ?? 1400 },
  { to: top, ms: o.rest ?? 500 },
];
const stand = (ms: number, angle = 172): Move => ({ to: angle, ms });
const reps = (n: number, top = 172, bottom = 85) => Array.from({ length: n }, () => rep(top, bottom)).flat();

test('five clean squats count five', () => {
  const { tracker, results } = run(stream(172, [stand(1200), ...reps(5)]));
  assert.equal(tracker.reps, 5);
  assert.equal(results.filter((r) => r.kind === 'rep').length, 5);
  assert.equal(tracker.partialReps, 0);
  assert.deepEqual(results.map((r) => r.n), [1, 2, 3, 4, 5]);
});

test('noisy angles (+-5 degrees) neither add nor lose reps', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { tracker } = run(stream(172, [stand(1200), ...reps(6)], { noise: 5, seed }));
    assert.equal(tracker.reps, 6, `seed ${seed}`);
  }
});

test('a lockout that never reaches the textbook angle still counts (no stall)', () => {
  // Standing only reaches 150 degrees (the squat default is 160): the old logic waited forever.
  const { tracker, results } = run(stream(150, [stand(2600, 150), ...reps(5, 150, 85)]));
  assert.equal(tracker.reps, 5);
  assert.equal(results.length, 5);
  assert.ok(tracker.debug().standing <= 151, 'adapted to the angle actually reached');
});

test('standing at 158 (just under the 160 default) no longer stalls', () => {
  const { tracker } = run(stream(158, [stand(1500, 158), ...reps(2, 158, 85)]));
  assert.equal(tracker.reps, 2);
});

test('jitter around the standing angle makes no reps', () => {
  const wobble: Move[] = [];
  for (let i = 0; i < 40; i++) wobble.push({ to: i % 2 ? 158 : 168, ms: 150 });
  const { tracker } = run(stream(172, [stand(800), ...wobble]));
  assert.equal(tracker.reps, 0);
  assert.equal(tracker.partialReps, 0);
});

test('a quick twitch is ignored, and says why', () => {
  const { tracker, results } = run(stream(172, [stand(1200), { to: 120, ms: 150 }, { to: 172, ms: 150 }, stand(800)]));
  assert.equal(results.length, 0);
  assert.equal(tracker.reps, 0);
  assert.match(tracker.debug().lastReject ?? '', /too quick|barely/);
});

test('a shallow rep is a partial: reported, not counted', () => {
  const { tracker, results } = run(stream(172, [stand(1200), ...rep(172, 120), ...reps(2)]));
  assert.equal(results.length, 3);
  assert.equal(results[0].kind, 'partial');
  assert.equal(results[0].depthOk, false);
  assert.equal(tracker.reps, 2);
  assert.equal(tracker.partialReps, 1);
  assert.equal(results[0].quality, 'poor');
});

test('hip-below-knee counts as depth even when the knee angle alone would not', () => {
  const { tracker } = run(stream(172, [stand(1200), ...rep(172, 108), ...rep(172, 108)], { hipDepthBelow: 112 }));
  assert.equal(tracker.reps, 2);
});

test('hovering at the bottom threshold is one rep, not several', () => {
  const hover: Move[] = [];
  for (let i = 0; i < 12; i++) hover.push({ to: i % 2 ? 106 : 94, ms: 120 }); // crosses the depth line every frame or two
  const { tracker, results } = run(stream(172, [stand(1200), { to: 98, ms: 1500 }, ...hover, { to: 172, ms: 1500 }, stand(600)]));
  assert.equal(tracker.reps, 1);
  assert.equal(results.length, 1);
});

test('a bounce at the bottom stays one rep', () => {
  const { tracker } = run(stream(172, [stand(1200), { to: 85, ms: 1600 }, { to: 112, ms: 400 }, { to: 85, ms: 400 }, { to: 172, ms: 1500 }, stand(500)]));
  assert.equal(tracker.reps, 1);
});

test('back-to-back reps both count (the cooldown does not eat a real rep)', () => {
  const { tracker } = run(stream(172, [stand(1200), ...rep(172, 85, { rest: 100 }), ...rep(172, 85, { rest: 100 })]));
  assert.equal(tracker.reps, 2);
});

test('a joint that drops out mid-rep abandons that rep instead of counting a guess', () => {
  const frames = stream(172, [stand(1200), { to: 85, ms: 800 }, { to: 85, ms: 1600, vis: 0.15 }, { to: 172, ms: 1400 }, stand(600)]);
  const { tracker, results } = run(frames);
  assert.equal(results.length, 0);
  assert.equal(tracker.reps, 0);
  assert.match(tracker.debug().lastReject ?? '', /lost tracking/);
});

test('a short flicker in visibility does not break the rep', () => {
  const { tracker } = run(stream(172, [stand(1200), { to: 85, ms: 900 }, { to: 85, ms: 300, vis: 0.1 }, { to: 85, ms: 300 }, { to: 172, ms: 1400 }, stand(500)]));
  assert.equal(tracker.reps, 1);
});

test('walking out of frame mid-rep makes no phantom rep, and counting resumes', () => {
  const frames = stream(172, [stand(1200), { to: 120, ms: 700 }, { to: 120, ms: 2000, gone: true }, stand(1200), ...reps(2)]);
  const { tracker } = run(frames);
  assert.equal(tracker.reps, 2);
});

test('a rep that never finishes is abandoned, and the next one still counts', () => {
  const frames = stream(172, [stand(1200), { to: 85, ms: 1600 }, { to: 85, ms: 16_000 }, { to: 172, ms: 1500 }, stand(800)]);
  const { tracker, results } = run(frames);
  assert.equal(results.length, 0);
  assert.match(tracker.debug().lastReject ?? '', /too long/);
  const after = run(stream(172, [stand(1200), ...reps(1)]), tracker);
  assert.equal(after.tracker.reps, 1);
});

test('tempo is measured: a slow descent and a fast one read differently', () => {
  const slow = run(stream(172, [stand(1200), ...rep(172, 85, { down: 3000, up: 1500 })])).results[0];
  const fast = run(stream(172, [stand(1200), ...rep(172, 85, { down: 700, up: 1500 })])).results[0];
  assert.ok(slow.tempo.downMs > fast.tempo.downMs + 800, `${slow.tempo.downMs} vs ${fast.tempo.downMs}`);
  assert.ok(fast.notes.some((n) => /Fast rep|Rushed/.test(n)));
  assert.ok(!slow.notes.some((n) => /Fast rep|Rushed/.test(n)));
});

test('tempo covers the whole movement: a normal 1.7 s descent is not reported as fast', () => {
  const { results } = run(stream(172, [stand(1200), ...reps(4)]));
  assert.equal(results.length, 4);
  for (const r of results) {
    assert.ok(r.tempo.downMs >= 900 && r.tempo.downMs <= 1500, `down ${r.tempo.downMs}`);
    assert.ok(r.tempo.upMs >= 500 && r.tempo.upMs <= 1100, `up ${r.tempo.upMs}`);
    assert.ok(r.durationMs >= 2400, `whole rep ${r.durationMs}`);
  }
  const s = summarizeSet('squat', results, 14_000, 1)!;
  assert.ok(!s.cues.some((c) => /Descents averaged/.test(c)), s.cues.join(' | '));
});

test('reset clears the count and starts waiting for a stand again', () => {
  const t = run(stream(172, [stand(1200), ...reps(2)])).tracker;
  assert.equal(t.reps, 2);
  t.reset();
  assert.equal(t.reps, 0);
  assert.equal(t.currentPhase, 'idle');
});

test('AngleSmoother removes a one-frame spike and settles on a steady value', () => {
  const s = new AngleSmoother(70);
  const out = [100, 100, 100, 175, 100, 100, 100].map((v, i) => s.push(v, i * DT));
  assert.ok(Math.max(...out) < 110, `spike leaked: ${Math.max(...out)}`);
  const steady = [90, 90, 90, 90, 90, 90].map((v, i) => s.push(v, 1000 + i * DT));
  assert.ok(Math.abs(steady[steady.length - 1] - 90) < 3);
});

// --- Visibility ------------------------------------------------------------------------------------------------------

function pose(visibility: Partial<Record<number, number>> = {}, base = 0.95): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.1 + i * 0.02, visibility: visibility[i] ?? base }));
}

test('with one side hidden, the better-seen side is used', () => {
  const m = frameMetrics(pose({ 25: 0.1 }), 640, 480, 'squat')!; // left knee hidden, right side clear
  assert.equal(m.side, 'right');
  assert.ok(m.jointVisibility > 0.9);
});

test('frameMetrics reports the weakest joint, not just the average', () => {
  const lm = pose({ 25: 0.1, 26: 0.1 }); // both knees hidden, everything else clear
  const m = frameMetrics(lm, 640, 480, 'squat');
  assert.ok(m);
  assert.ok(m.confidence > 0.6, 'the average still looks fine');
  assert.ok(m.jointVisibility < 0.2, 'but the angle joint is hidden');
  assert.deepEqual(weakJoints(lm, 'squat'), ['knee']);
  assert.deepEqual(weakJoints(pose(), 'squat'), []);
  assert.match(visibilityHint(['knee', 'ankle']) ?? '', /knee and ankle/);
  assert.equal(visibilityHint([]), null);
});

test('a hidden joint makes the tracker skip the frame', () => {
  const t = new FormTracker(EXERCISES.squat);
  const m = frameMetrics(pose({ 25: 0.1 }), 640, 480, 'squat')!;
  assert.equal(t.update(m, 0), null);
  assert.equal(t.currentPhase, 'idle');
});

// --- Summary and storage -------------------------------------------------------------------------------------------------

const mk = (kind: RepResult['kind'], minAngle: number, downMs: number, upMs: number, quality: RepResult['quality'] = 'good', n = 1): RepResult => ({
  n, kind, minAngle, durationMs: downMs + upMs, barDrift: 0.1, depthOk: kind === 'rep', quality, notes: [], tempo: { downMs, pauseMs: 200, upMs },
});

test('summarizeSet: counts, depth, tempo and plain cues', () => {
  const s = summarizeSet('squat', [mk('rep', 90, 1800, 1200), mk('rep', 86, 1900, 1300), mk('partial', 125, 1500, 1100, 'poor')], 21_000, 1_700_000_000_000)!;
  assert.equal(s.reps, 2);
  assert.equal(s.partials, 1);
  assert.equal(s.avgDepth, 88);
  assert.equal(s.bestDepth, 86);
  assert.equal(s.avgDownMs, 1850);
  assert.equal(s.quality.good, 2);
  assert.match(s.cues[0], /1 of 3 reps were partials/);
  assert.ok(s.cues.length <= 3);
});

test('summarizeSet: fast descents and a fading set are called out; a clean set is praised', () => {
  const fast = summarizeSet('squat', [mk('rep', 88, 600, 1000), mk('rep', 88, 650, 1000), mk('rep', 88, 700, 1000)], 9000, 1)!;
  assert.ok(fast.cues.some((c) => /Descents averaged/.test(c)));
  const fading = summarizeSet('squat', [mk('rep', 88, 1800, 1000), mk('rep', 88, 1800, 1100), mk('rep', 88, 1800, 1700), mk('rep', 88, 1800, 1900)], 12_000, 1)!;
  assert.ok(fading.cues.some((c) => /slowed/.test(c)));
  const clean = summarizeSet('squat', [mk('rep', 88, 1800, 1200), mk('rep', 88, 1900, 1200)], 8000, 1)!;
  assert.match(clean.cues[0], /Consistent set/);
  assert.equal(summarizeSet('squat', [], 1000, 1), null);
});

test('a stored summary holds only numbers and short text: it passes the cloud privacy guard', () => {
  const s = summarizeSet('deadlift', [mk('rep', 130, 1500, 1500)], 5000, 1)!;
  assert.equal(findForbidden(s), null);
  assert.ok(JSON.stringify(s).length < 600, 'a compact record, no series of angles or points');
});

test('cleanFormSet validates and clamps what it is given', () => {
  const ok = summarizeSet('pushup', [mk('rep', 90, 1200, 1000)], 4000, 5)!;
  assert.deepEqual(cleanFormSet(JSON.parse(JSON.stringify(ok))), ok);
  assert.equal(cleanFormSet(null), null);
  assert.equal(cleanFormSet({ exercise: 'snatch', at: 1, reps: 1, partials: 0 }), null);
  assert.equal(cleanFormSet({ exercise: 'squat', at: 'now', reps: 1, partials: 0 }), null);
  const wild = cleanFormSet({ exercise: 'squat', at: 5, reps: 99999, partials: -4, avgDepth: 9999, cues: ['x'.repeat(500), 7, 'a', 'b', 'c', 'd'], landmarks: [1, 2, 3], image: 'data:image/png;base64,AAAA' })!;
  assert.equal(wild.reps, 500);
  assert.equal(wild.partials, 0);
  assert.equal(wild.avgDepth, 180);
  assert.equal(wild.cues[0].length, 140);
  assert.equal(wild.cues.length, 4);
  assert.equal('landmarks' in wild || 'image' in wild, false, 'unknown fields are dropped');
});

// --- Lighting ----------------------------------------------------------------------------------------------------------------

test('lightingHint spots darkness, backlight and glare, and stays quiet otherwise', () => {
  assert.match(lightingHint({ mean: 30, center: 30, edge: 30 }) ?? '', /too dark/);
  assert.match(lightingHint({ mean: 120, center: 60, edge: 200 }) ?? '', /backlight/);
  assert.match(lightingHint({ mean: 245, center: 245, edge: 245 }) ?? '', /overexposed/);
  assert.equal(lightingHint({ mean: 120, center: 125, edge: 115 }), null);
});
