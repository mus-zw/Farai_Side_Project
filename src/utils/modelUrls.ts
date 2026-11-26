/**
 * Where the large model and runtime files are fetched from.
 *
 * Cloudflare Pages rejects any single file over 25 MiB, and two of ours are
 * bigger or close: the ONNX Runtime WebGPU wasm is about 28 MiB, and larger
 * YOLO exports (yolo11m, anything at 960) run tens of MB. Point these at object
 * storage (Cloudflare R2, a CDN) for production and the static build stays small.
 *
 *   VITE_MODEL_BASE_URL         .onnx and MediaPipe .task files. Default: /models
 *   VITE_ORT_WASM_BASE_URL      ONNX Runtime wasm.               Default: /ort/ (bundled)
 *   VITE_MEDIAPIPE_WASM_BASE_URL MediaPipe wasm.                 Default: /mediapipe/wasm (bundled)
 *
 * Cross-origin hosts must send CORS headers (Access-Control-Allow-Origin).
 */

const trimEnd = (s: string) => s.trim().replace(/\/+$/, '');

/** `configured` if it is a non-empty string, else `fallback`; never a trailing slash. */
export function resolveBase(configured: unknown, fallback: string): string {
  return typeof configured === 'string' && configured.trim() ? trimEnd(configured) : trimEnd(fallback);
}

const SITE_BASE = import.meta.env.BASE_URL.replace(/\/+$/, ''); // "" at the root, "/sub" under a sub-path

export const MODEL_BASE_URL = resolveBase(import.meta.env.VITE_MODEL_BASE_URL, `${SITE_BASE}/models`);
export const ORT_WASM_BASE_URL = resolveBase(import.meta.env.VITE_ORT_WASM_BASE_URL, `${SITE_BASE}/ort`) + '/';
export const MEDIAPIPE_WASM_BASE_URL = resolveBase(import.meta.env.VITE_MEDIAPIPE_WASM_BASE_URL, `${SITE_BASE}/mediapipe/wasm`);

/** A file in the model folder, e.g. "yolo11n.onnx". */
export const modelFileUrl = (file: string): string => `${MODEL_BASE_URL}/${file}`;

/** The MediaPipe pose model for a variant, in the pose/ subfolder. */
export const poseModelUrl = (variant: 'full' | 'lite'): string => `${MODEL_BASE_URL}/pose/pose_landmarker_${variant}.task`;

/** True when models are served from somewhere other than this site. */
export const modelsAreExternal = /^https?:\/\//i.test(MODEL_BASE_URL);
