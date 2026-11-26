import { DetectionScoreBreakdown } from '../types';
import { COCO_CLASSES } from './cocoClasses';

/**
 * The pure part of in-browser YOLO inference: letterboxing, tensor layout,
 * decoding the model's raw output, and non-maximum suppression. No DOM and no
 * ONNX Runtime here, so it can be tested in plain Node.
 *
 * Model: Ultralytics YOLO11n exported to ONNX at a fixed 640x640.
 *   input  "images"  float32 [1, 3, 640, 640]  RGB, 0-1, CHW
 *   output "output0" float32 [1, 84, 8400]     channels-first: rows 0-3 are the
 *                                              box (cx, cy, w, h in letterboxed
 *                                              pixels), rows 4-83 the 80 class
 *                                              scores. 8400 = 80*80 + 40*40 + 20*20.
 * The scores are already sigmoid-activated and there is no objectness row.
 */

export const INPUT_SIZE = 640;
export const NUM_CLASSES = 80;
export const NUM_ANCHORS = 8400;
export const PAD_VALUE = 114; // the grey Ultralytics pads with
export const DEFAULT_IOU_THRESHOLD = 0.45; // matches the backend's IOU_THRESHOLD
export const MAX_DETECTIONS = 300;
// Bounds the quadratic NMS pass when the confidence threshold is very low.
const MAX_NMS_CANDIDATES = 3000;

export interface Letterbox {
  /** Source image size. */
  srcW: number;
  srcH: number;
  /** Uniform scale applied to the source to fit the square. */
  scale: number;
  /** Size of the scaled image inside the square. */
  newW: number;
  newH: number;
  /** Where its top-left corner sits in the square (centred, as Ultralytics does). */
  left: number;
  top: number;
}

/** How to fit a srcW x srcH image into a size x size square without distortion. */
export function computeLetterbox(srcW: number, srcH: number, size: number = INPUT_SIZE): Letterbox {
  const scale = Math.min(size / srcH, size / srcW);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const dw = (size - newW) / 2;
  const dh = (size - newH) / 2;
  // The -0.1 matches Ultralytics' letterbox, so a half-pixel gap pads the
  // extra pixel on the right/bottom instead of the left/top.
  // `+ 0` turns the -0 that Math.round(-0.1) gives (no padding on that axis) into 0.
  return { srcW, srcH, scale, newW, newH, left: Math.round(dw - 0.1) + 0, top: Math.round(dh - 0.1) + 0 };
}

/** RGBA pixels (as from canvas getImageData) -> float32 CHW in 0-1, ready for the model. */
export function rgbaToChw(rgba: ArrayLike<number>, size: number = INPUT_SIZE): Float32Array {
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    out[i] = rgba[p] / 255;
    out[plane + i] = rgba[p + 1] / 255;
    out[2 * plane + i] = rgba[p + 2] / 255;
  }
  return out;
}

export interface Detection {
  classId: number;
  className: string;
  score: number;
  /** [x1, y1, x2, y2] in pixels of the original (analysed) image. */
  box: [number, number, number, number];
}

export function iou(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  if (inter === 0) return 0;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

/** Greedy class-aware NMS: best score first, drop same-class boxes overlapping a kept one. */
export function nonMaxSuppression(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    let suppressed = false;
    for (const k of kept) {
      if (k.classId === d.classId && iou(k.box, d.box) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(d);
  }
  return kept;
}

export interface DecodeOptions {
  confidence: number;
  iouThreshold?: number;
  maxDetections?: number;
  numAnchors?: number;
  numClasses?: number;
  classNames?: readonly string[];
}

/**
 * Turn the raw output tensor into detections in original-image pixels:
 * score threshold, undo the letterbox, clamp to the image, NMS.
 */
export function decodeOutput(output: Float32Array, lb: Letterbox, opts: DecodeOptions): Detection[] {
  const n = opts.numAnchors ?? NUM_ANCHORS;
  const nc = opts.numClasses ?? NUM_CLASSES;
  const names = opts.classNames ?? COCO_CLASSES;
  if (output.length !== (4 + nc) * n) {
    throw new Error(
      `Unexpected model output size ${output.length}; expected ${(4 + nc) * n} (1 x ${4 + nc} x ${n}).`
    );
  }

  const candidates: Detection[] = [];
  for (let i = 0; i < n; i++) {
    // Best class for this anchor. Channels-first: class c of anchor i is at (4 + c) * n + i.
    let best = 0;
    let bestScore = -Infinity;
    for (let c = 0; c < nc; c++) {
      const s = output[(4 + c) * n + i];
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (bestScore < opts.confidence) continue;

    const cx = output[i];
    const cy = output[n + i];
    const w = output[2 * n + i];
    const h = output[3 * n + i];
    // Letterboxed pixels -> original pixels, clamped to the image.
    const x1 = Math.max(0, (cx - w / 2 - lb.left) / lb.scale);
    const y1 = Math.max(0, (cy - h / 2 - lb.top) / lb.scale);
    const x2 = Math.min(lb.srcW, (cx + w / 2 - lb.left) / lb.scale);
    const y2 = Math.min(lb.srcH, (cy + h / 2 - lb.top) / lb.scale);
    if (x2 <= x1 || y2 <= y1) continue;
    candidates.push({ classId: best, className: names[best] ?? `class_${best}`, score: bestScore, box: [x1, y1, x2, y2] });
  }

  if (candidates.length > MAX_NMS_CANDIDATES) {
    candidates.sort((a, b) => b.score - a.score);
    candidates.length = MAX_NMS_CANDIDATES;
  }
  return nonMaxSuppression(candidates, opts.iouThreshold ?? DEFAULT_IOU_THRESHOLD).slice(
    0,
    opts.maxDetections ?? MAX_DETECTIONS
  );
}

// --- Colours and grouping, in the backend's shape -------------------------------

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  return [r, g, b];
}

/** Same golden-ratio palette as the backend, so a class has one colour in both engines. */
export function classColorHex(classId: number): string {
  const hue = (classId * 0.618033988749895) % 1;
  const [r, g, b] = hsvToRgb(hue, 0.85, 0.95);
  // Truncate, not round: the backend does int(x * 255), and the colours should match exactly.
  const hex = (x: number) => Math.floor(x * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** One entry per class (most frequent first), like the backend's `detections`. */
export function groupByClass(dets: Detection[]): Record<string, DetectionScoreBreakdown> {
  const grouped: Record<string, DetectionScoreBreakdown> = {};
  for (const d of dets) {
    const entry = (grouped[d.className] ??= {
      count: 0,
      confidence_scores: [],
      bounding_boxes: [],
      color: classColorHex(d.classId),
    });
    entry.count += 1;
    entry.confidence_scores.push(Math.round(d.score * 10000) / 10000);
    entry.bounding_boxes!.push(d.box.map((v) => Math.round(v * 100) / 100));
  }
  return Object.fromEntries(Object.entries(grouped).sort((a, b) => b[1].count - a[1].count));
}
