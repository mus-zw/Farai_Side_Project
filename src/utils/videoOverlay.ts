import { FrameDetection, VideoBox } from '../types';
import { frameIndexAtTime } from './videoFrames';

/**
 * Pure helpers for drawing the backend's per-frame detections over a playing
 * video. No DOM here, so they can be tested on their own.
 *
 * The backend analyses only every frame_stride-th frame. Showing the latest
 * analysed frame's boxes until the next one makes a moving subject sit still
 * and then jump. Instead, boxes are matched between the two analysed frames
 * either side of the playhead and moved smoothly from one to the other.
 */

export interface DrawBox extends VideoBox {
  /** 0-1. Boxes with no partner in the neighbouring frame fade rather than pop. */
  alpha: number;
}

export interface OverlayState {
  /** Index into frame_detections of the analysed frame at or before the playhead; -1 if none. */
  frameIndex: number;
  boxes: DrawBox[];
  /** Objects that count as on screen now (what the HUD and pills report). */
  activeCount: number;
}

type Rect = [number, number, number, number]; // x, y, w, h (any consistent unit)

const MATCH_IOU = 0.1;
const MATCH_CENTRE_DISTANCE = 0.8; // centre distance / mean box diagonal (second pass, leftovers only)

export function iou(a: Rect, b: Rect): number {
  const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  if (inter === 0) return 0;
  return inter / (a[2] * a[3] + b[2] * b[3] - inter);
}

function centreDistanceRatio(a: Rect, b: Rect): number {
  const dx = a[0] + a[2] / 2 - (b[0] + b[2] / 2);
  const dy = a[1] + a[3] / 2 - (b[1] + b[3] / 2);
  const diag = (Math.hypot(a[2], a[3]) + Math.hypot(b[2], b[3])) / 2;
  return diag > 0 ? Math.hypot(dx, dy) / diag : Infinity;
}

/**
 * One-to-one matches between two frames' boxes, same class only.
 * Overlap first (best IoU wins), then nearest centre for fast movers whose
 * boxes no longer overlap between analysed frames.
 */
export function matchBoxes(from: VideoBox[], to: VideoBox[]): Map<number, number> {
  const matches = new Map<number, number>(); // from index -> to index
  const usedTo = new Set<number>();

  const pairs: { i: number; j: number; score: number }[] = [];
  from.forEach((a, i) =>
    to.forEach((b, j) => {
      if (a.className === b.className) pairs.push({ i, j, score: iou(a.bbox, b.bbox) });
    })
  );
  pairs.sort((p, q) => q.score - p.score);
  for (const { i, j, score } of pairs) {
    if (score < MATCH_IOU) break;
    if (matches.has(i) || usedTo.has(j)) continue;
    matches.set(i, j);
    usedTo.add(j);
  }

  const rest: { i: number; j: number; d: number }[] = [];
  from.forEach((a, i) => {
    if (matches.has(i)) return;
    to.forEach((b, j) => {
      if (usedTo.has(j) || a.className !== b.className) return;
      rest.push({ i, j, d: centreDistanceRatio(a.bbox, b.bbox) });
    });
  });
  rest.sort((p, q) => p.d - q.d);
  for (const { i, j, d } of rest) {
    if (d > MATCH_CENTRE_DISTANCE) break;
    if (matches.has(i) || usedTo.has(j)) continue;
    matches.set(i, j);
    usedTo.add(j);
  }
  return matches;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The boxes to draw at `seconds`, interpolated between the analysed frames
 * either side of it. Before the first or after the last analysed frame the
 * nearest frame is shown as it is (no extrapolation).
 */
export function overlayAtTime(frames: FrameDetection[], seconds: number): OverlayState {
  if (frames.length === 0) return { frameIndex: -1, boxes: [], activeCount: 0 };

  const a = frameIndexAtTime(frames, seconds);
  const A = frames[a];
  const boxesA = A.boxes ?? [];
  const solid = (boxes: VideoBox[]): OverlayState => ({
    frameIndex: a,
    boxes: boxes.map((b) => ({ ...b, alpha: 1 })),
    activeCount: boxes.length,
  });

  const B = frames[a + 1];
  if (!B || seconds <= A.timestamp || B.timestamp <= A.timestamp) return solid(boxesA);

  const boxesB = B.boxes ?? [];
  const t = Math.min(1, Math.max(0, (seconds - A.timestamp) / (B.timestamp - A.timestamp)));
  const matches = matchBoxes(boxesA, boxesB);
  const matchedTo = new Set(matches.values());

  const out: DrawBox[] = [];
  let active = 0;
  boxesA.forEach((boxA, i) => {
    const j = matches.get(i);
    if (j !== undefined) {
      const boxB = boxesB[j];
      out.push({
        ...boxA,
        confidence: lerp(boxA.confidence, boxB.confidence, t),
        bbox: [
          lerp(boxA.bbox[0], boxB.bbox[0], t),
          lerp(boxA.bbox[1], boxB.bbox[1], t),
          lerp(boxA.bbox[2], boxB.bbox[2], t),
          lerp(boxA.bbox[3], boxB.bbox[3], t),
        ],
        alpha: 1,
      });
      active += 1;
    } else {
      out.push({ ...boxA, alpha: 1 - t }); // leaving: fades out
      if (t < 0.5) active += 1;
    }
  });
  boxesB.forEach((boxB, j) => {
    if (matchedTo.has(j)) return;
    out.push({ ...boxB, alpha: t }); // arriving: fades in
    if (t >= 0.5) active += 1;
  });

  return { frameIndex: a, boxes: out.filter((b) => b.alpha > 0.02), activeCount: active };
}

/** Per-class count of the boxes that are on screen now (same rule as activeCount). */
export function activeCountsByClass(state: OverlayState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of state.boxes) {
    if (b.alpha >= 0.5) counts[b.className] = (counts[b.className] ?? 0) + 1;
  }
  return counts;
}

/** The source-video frame being shown at `seconds`, never outside [0, totalFrames). */
export function playbackFrameNumber(seconds: number, fps: number, totalFrames: number): number {
  if (!(fps > 0)) return 0;
  // A media time of exactly n/fps can land a hair under n after the multiply
  // (17/15 * 15 = 16.9999999), so allow a small epsilon (< 1.5 ms at 15 fps).
  const frame = Math.floor(seconds * fps + 0.02);
  const last = totalFrames > 0 ? totalFrames - 1 : frame;
  return Math.max(0, Math.min(last, frame));
}

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where to put a label chip so it is fully inside the frame.
 * Prefers just above the box; if there is no room, just inside its top edge;
 * always slid left or down as needed so it never crosses the right, left,
 * top or bottom edge. Coordinates are canvas pixels.
 */
export function layoutLabel(
  box: { x: number; y: number; w: number; h: number },
  chipW: number,
  chipH: number,
  frameW: number,
  frameH: number
): LabelRect {
  const w = Math.min(chipW, frameW);
  const h = Math.min(chipH, frameH);

  // Keep the box's own corner inside the frame first.
  const bx = Math.min(Math.max(box.x, 0), Math.max(0, frameW - 1));
  const by = Math.min(Math.max(box.y, 0), Math.max(0, frameH - 1));

  const x = Math.min(Math.max(bx, 0), frameW - w);
  const above = by - h;
  let y = above >= 0 ? above : by; // no room above: inside the box's top edge
  y = Math.min(Math.max(y, 0), frameH - h);
  return { x, y, w, h };
}

/** The box clipped to the frame, so strokes and labels never sit outside it. */
export function clampBox(box: Rect, frameW: number, frameH: number): Rect {
  const x1 = Math.min(Math.max(box[0], 0), frameW);
  const y1 = Math.min(Math.max(box[1], 0), frameH);
  const x2 = Math.min(Math.max(box[0] + box[2], 0), frameW);
  const y2 = Math.min(Math.max(box[1] + box[3], 0), frameH);
  return [x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1)];
}

/** Black or white, whichever reads better on a `#rrggbb` label background. */
export function readableTextColor(hex: string): '#0b1020' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.35 ? '#0b1020' : '#ffffff';
}

// --- Thinning a busy overlay ---------------------------------------------------

/** Boxes below this confidence are drawn lighter and get no label unless their class is isolated. */
export const WEAK_CONFIDENCE = 0.4;
/** Screen-pixel size under which a label would cover more than the box it names. */
export const MIN_LABEL_BOX_PX = { w: 36, h: 24 };

/**
 * Whether a box gets a text label. In a busy scene a label on every tiny or
 * weak box buries the picture. When the user has isolated one class (the
 * pills), every visible box is labelled: there is no clutter left to thin.
 */
export function shouldDrawLabel(
  screenW: number,
  screenH: number,
  confidence: number,
  classIsolated: boolean
): boolean {
  if (classIsolated) return true;
  return screenW >= MIN_LABEL_BOX_PX.w && screenH >= MIN_LABEL_BOX_PX.h && confidence >= WEAK_CONFIDENCE;
}

/** Opacity multiplier for a box: weak detections are present but quieter. */
export function weakBoxOpacity(confidence: number): number {
  return confidence < WEAK_CONFIDENCE ? 0.55 : 1;
}
