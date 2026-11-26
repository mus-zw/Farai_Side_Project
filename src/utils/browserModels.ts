/**
 * Which ONNX models and input resolutions the in-browser detector can use.
 * Pure data and helpers (no DOM, no ONNX Runtime), so it is easy to test.
 *
 * The exported ONNX graphs have a FIXED input size: a model exported at 640
 * cannot be fed 960 pixels. So each (model, size) pair is its own file in
 * public/models/:
 *
 *   yolo11n.onnx, yolo11s.onnx, yolo11m.onnx            exported at imgsz=640
 *   yolo11n-960.onnx, yolo11s-960.onnx, yolo11m-960.onnx exported at imgsz=960
 *
 * Only yolo11n.onnx ships in the repo. Anything else is optional; when its
 * file is missing the loader falls back to DEFAULT_MODEL_CONFIG (yolo11n @ 640).
 * See public/models/README.md for the export commands.
 */

export type BrowserModelId = 'yolo11n' | 'yolo11s' | 'yolo11m';
export type BrowserInputSize = 640 | 960;

export interface BrowserModelConfig {
  modelId: BrowserModelId;
  size: BrowserInputSize;
}

export interface BrowserModelInfo {
  id: BrowserModelId;
  label: string;
  /** Approximate fp32 file size at 640, for the UI. A 960 export is about the same size. */
  approxMB: number;
}

export const BROWSER_MODELS: readonly BrowserModelInfo[] = [
  { id: 'yolo11n', label: 'YOLO11n (fastest)', approxMB: 11 },
  { id: 'yolo11s', label: 'YOLO11s (balanced)', approxMB: 38 },
  { id: 'yolo11m', label: 'YOLO11m (most accurate)', approxMB: 80 },
];

export const BROWSER_INPUT_SIZES: readonly BrowserInputSize[] = [640, 960];

/** The model that ships with the app; the fallback for everything else. */
export const DEFAULT_MODEL_CONFIG: BrowserModelConfig = { modelId: 'yolo11n', size: 640 };

export function isBrowserModelId(v: unknown): v is BrowserModelId {
  return BROWSER_MODELS.some((m) => m.id === v);
}

export function isBrowserInputSize(v: unknown): v is BrowserInputSize {
  return v === 640 || v === 960;
}

/** File name under public/models/ for a config. */
export function modelFileName(cfg: BrowserModelConfig): string {
  return cfg.size === 640 ? `${cfg.modelId}.onnx` : `${cfg.modelId}-${cfg.size}.onnx`;
}

export function configKey(cfg: BrowserModelConfig): string {
  return `${cfg.modelId}@${cfg.size}`;
}

export function sameConfig(a: BrowserModelConfig, b: BrowserModelConfig): boolean {
  return a.modelId === b.modelId && a.size === b.size;
}

/** Number of predictions a YOLO11 head makes at `size`: strides 8, 16 and 32. 640 -> 8400, 960 -> 18900. */
export function anchorsForSize(size: number): number {
  return [8, 16, 32].reduce((sum, stride) => sum + (size / stride) ** 2, 0);
}

/** A stored or typed config, or the default if it is not a valid one. */
export function parseConfig(modelId: unknown, size: unknown): BrowserModelConfig {
  const s = Number(size);
  return isBrowserModelId(modelId) && isBrowserInputSize(s) ? { modelId, size: s } : DEFAULT_MODEL_CONFIG;
}
