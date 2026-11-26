import type * as OrtNs from 'onnxruntime-web';
import { DetectionResponse, ImageMetadata } from '../types';
import {
  INPUT_SIZE,
  NUM_ANCHORS,
  NUM_CLASSES,
  computeLetterbox,
  decodeOutput,
  groupByClass,
  classColorHex,
  rgbaToChw,
  PAD_VALUE,
  Detection,
} from '../utils/onnxDetect';
import { layoutLabel, readableTextColor } from '../utils/videoOverlay';

/**
 * Object detection that runs entirely in the visitor's browser: YOLO11n as an
 * ONNX model on onnxruntime-web, WebGPU first with WASM as the fallback.
 *
 * Nothing is sent anywhere. The first use downloads the ONNX Runtime wasm
 * (about 30 MB) and the model (about 10 MB); the browser caches both, so later
 * visits start much faster. ONNX Runtime itself is imported lazily, so none of
 * this touches the app's initial bundle.
 */

const BASE = import.meta.env.BASE_URL;
export const BROWSER_MODEL_URL = `${BASE}models/yolo11n.onnx`;
// vite.config.ts serves/emits the runtime's wasm files here.
const ORT_ASSET_BASE = `${BASE}ort/`;
export const BROWSER_MODEL_LABEL = 'yolo11n.onnx';
/** Larger images are downscaled before inference; the model only sees 640 px anyway. */
export const MAX_BROWSER_IMAGE_DIM = 4096;

type Ort = typeof OrtNs;
export type BrowserBackend = 'webgpu' | 'wasm';
export type PhaseCallback = (message: string) => void;

export interface BrowserModel {
  session: OrtNs.InferenceSession;
  backend: BrowserBackend;
  /** Why WebGPU was not used, when it was not. */
  fallbackReason?: string;
}

export interface BrowserDetectOptions {
  confidenceThreshold?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  onPhase?: PhaseCallback;
}

// --- Loading ----------------------------------------------------------------------

let ortPromise: Promise<Ort> | null = null;
let modelPromise: Promise<BrowserModel> | null = null;
let modelBytes: Uint8Array | null = null;

function importOrt(): Promise<Ort> {
  ortPromise ??= import('onnxruntime-web')
    .then((ort) => {
      ort.env.wasm.wasmPaths = ORT_ASSET_BASE;
      // Multithreaded wasm needs cross-origin isolation (COOP/COEP headers),
      // which most static hosts do not send; use one thread unless it is on.
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      ort.env.wasm.proxy = false;
      return ort;
    })
    .catch((err) => {
      ortPromise = null;
      throw new Error(`Could not load the ONNX Runtime: ${err?.message || err}`);
    });
  return ortPromise;
}

async function fetchModel(onPhase?: PhaseCallback): Promise<Uint8Array> {
  if (modelBytes) return modelBytes;
  const res = await fetch(BROWSER_MODEL_URL);
  if (!res.ok) {
    throw new Error(`Could not download the model (${BROWSER_MODEL_URL}: HTTP ${res.status}).`);
  }
  // A static host that rewrites unknown paths to index.html answers 200 with HTML.
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    throw new Error(`The model file is missing on this host (${BROWSER_MODEL_URL} returned a web page).`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    modelBytes = new Uint8Array(await res.arrayBuffer());
    return modelBytes;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const mb = (n: number) => (n / 1048576).toFixed(1);
    onPhase?.(total ? `Downloading model ${mb(received)} / ${mb(total)} MB…` : `Downloading model ${mb(received)} MB…`);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  modelBytes = bytes;
  return bytes;
}

async function webgpuUsable(): Promise<boolean> {
  const gpu = (navigator as any).gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function createSession(ort: Ort, bytes: Uint8Array, backend: BrowserBackend) {
  return ort.InferenceSession.create(bytes, {
    executionProviders: [backend],
    graphOptimizationLevel: 'all',
  });
}

/** One run on blank input. WebGPU problems (unsupported ops, shader compile) show up here, not at create(). */
async function warmUp(ort: Ort, session: OrtNs.InferenceSession): Promise<void> {
  const blank = new ort.Tensor('float32', new Float32Array(3 * INPUT_SIZE * INPUT_SIZE), [1, 3, INPUT_SIZE, INPUT_SIZE]);
  await session.run({ [session.inputNames[0]]: blank });
}

async function doLoad(onPhase?: PhaseCallback): Promise<BrowserModel> {
  onPhase?.('Loading the ONNX runtime…');
  const ort = await importOrt();
  const bytes = await fetchModel(onPhase);

  let fallbackReason: string;
  if (await webgpuUsable()) {
    try {
      onPhase?.('Starting WebGPU…');
      const session = await createSession(ort, bytes, 'webgpu');
      await warmUp(ort, session);
      return { session, backend: 'webgpu' };
    } catch (err: any) {
      fallbackReason = `WebGPU failed (${err?.message || err}); using WASM.`;
    }
  } else {
    fallbackReason = 'WebGPU is not available in this browser; using WASM.';
  }

  onPhase?.('Starting WASM…');
  const session = await createSession(ort, bytes, 'wasm');
  await warmUp(ort, session);
  return { session, backend: 'wasm', fallbackReason };
}

/** Loads (once) the runtime and model. Safe to call repeatedly; a failure is not cached. */
export function loadBrowserModel(onPhase?: PhaseCallback): Promise<BrowserModel> {
  modelPromise ??= doLoad(onPhase).catch((err) => {
    modelPromise = null;
    throw err;
  });
  return modelPromise;
}

/** Replace a WebGPU session that failed while running with a WASM one. */
async function fallBackToWasm(reason: string): Promise<BrowserModel> {
  const ort = await importOrt();
  const bytes = await fetchModel();
  const session = await createSession(ort, bytes, 'wasm');
  await warmUp(ort, session);
  const model: BrowserModel = { session, backend: 'wasm', fallbackReason: `WebGPU failed while running (${reason}); using WASM.` };
  modelPromise = Promise.resolve(model);
  return model;
}

// --- Running ----------------------------------------------------------------------

// A session runs one inference at a time, and the confidence slider can fire
// several requests in a row, so run them one after another.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

function canceled(): Error {
  return new Error('Request was canceled.');
}

async function decodeForInference(file: Blob, meta: ImageMetadata | undefined, onPhase?: PhaseCallback): Promise<ImageBitmap> {
  const longest = meta ? Math.max(meta.width, meta.height) : 0;
  if (meta && longest > MAX_BROWSER_IMAGE_DIM) {
    // Resize while decoding, so a huge image is never held at full size.
    const s = MAX_BROWSER_IMAGE_DIM / longest;
    onPhase?.(`Large image (${meta.width}×${meta.height}); downscaling to fit ${MAX_BROWSER_IMAGE_DIM}px…`);
    return createImageBitmap(file, {
      resizeWidth: Math.max(1, Math.round(meta.width * s)),
      resizeHeight: Math.max(1, Math.round(meta.height * s)),
      resizeQuality: 'high',
    });
  }
  const bitmap = await createImageBitmap(file);
  if (Math.max(bitmap.width, bitmap.height) <= MAX_BROWSER_IMAGE_DIM) return bitmap;

  // No metadata to size the decode: downscale after the fact.
  const s = MAX_BROWSER_IMAGE_DIM / Math.max(bitmap.width, bitmap.height);
  onPhase?.(`Large image (${bitmap.width}×${bitmap.height}); downscaling to fit ${MAX_BROWSER_IMAGE_DIM}px…`);
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: Math.max(1, Math.round(bitmap.width * s)),
    resizeHeight: Math.max(1, Math.round(bitmap.height * s)),
    resizeQuality: 'high',
  });
  bitmap.close();
  return resized;
}

function letterboxToTensorData(bitmap: ImageBitmap, lb: ReturnType<typeof computeLetterbox>): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser could not create a 2D canvas.');
  ctx.fillStyle = `rgb(${PAD_VALUE},${PAD_VALUE},${PAD_VALUE})`;
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, lb.left, lb.top, lb.newW, lb.newH);
  return rgbaToChw(ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data);
}

async function runModel(model: BrowserModel, input: Float32Array): Promise<{ output: Float32Array; model: BrowserModel }> {
  const ort = await importOrt();
  const feed = (m: BrowserModel) => ({
    [m.session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });

  let used = model;
  let results: OrtNs.InferenceSession.OnnxValueMapType;
  try {
    results = await used.session.run(feed(used));
  } catch (err: any) {
    if (used.backend !== 'webgpu') throw err;
    used = await fallBackToWasm(err?.message || String(err));
    results = await used.session.run(feed(used));
  }

  const tensor = results[used.session.outputNames[0]];
  const dims = tensor.dims.join('x');
  if (dims !== `1x${4 + NUM_CLASSES}x${NUM_ANCHORS}`) {
    throw new Error(`Unexpected model output shape ${dims}; expected 1x${4 + NUM_CLASSES}x${NUM_ANCHORS}.`);
  }
  return { output: tensor.data as Float32Array, model: used };
}

function renderAnnotated(bitmap: ImageBitmap, dets: Detection[]): string {
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not create a 2D canvas.');
  ctx.drawImage(bitmap, 0, 0);

  // Scale line and text with the image so a 4000 px photo and a thumbnail both read well.
  const shortSide = Math.min(w, h);
  const lineWidth = Math.max(1, Math.round(shortSide / 400));
  const fontPx = Math.min(90, Math.max(12, Math.round(shortSide / 48)));
  const padX = fontPx * 0.4;
  const chipH = fontPx * 1.35;
  ctx.font = `600 ${fontPx}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = lineWidth;

  for (const d of dets) {
    const color = classColorHex(d.classId);
    const [x1, y1, x2, y2] = d.box;
    ctx.strokeStyle = color;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    const label = `${d.className} ${d.score.toFixed(2)}`;
    const chip = layoutLabel({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, ctx.measureText(label).width + padX * 2, chipH, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
    ctx.fillStyle = readableTextColor(color);
    ctx.fillText(label, chip.x + padX, chip.y + chip.h / 2);
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type BrowserDetectionResult = DetectionResponse & { inference_engine: BrowserBackend; metadata?: ImageMetadata };

/**
 * Detect objects in an image, in the browser. The result has the same shape
 * as the backend's, so the rest of the page does not care which engine ran.
 * `processing_time_ms` covers preprocess + inference + postprocess (model
 * load and drawing the annotated image are not included), like the backend's.
 */
export function detectInBrowser(
  file: Blob,
  options: BrowserDetectOptions = {},
  meta?: ImageMetadata
): Promise<BrowserDetectionResult> {
  return enqueue(async () => {
    if (options.signal?.aborted) throw canceled();
    const confidence = options.confidenceThreshold ?? 0.25;

    options.onProgress?.(30);
    let model = await loadBrowserModel(options.onPhase);
    if (options.signal?.aborted) throw canceled();
    options.onProgress?.(60);
    options.onPhase?.(`Running ${BROWSER_MODEL_LABEL} on ${model.backend === 'webgpu' ? 'WebGPU' : 'WASM'}…`);

    const t0 = performance.now();
    const bitmap = await decodeForInference(file, meta, options.onPhase);
    try {
      const lb = computeLetterbox(bitmap.width, bitmap.height);
      const input = letterboxToTensorData(bitmap, lb);
      const t1 = performance.now();

      const run = await runModel(model, input);
      model = run.model;
      const t2 = performance.now();
      if (options.signal?.aborted) throw canceled();

      const dets = decodeOutput(run.output, lb, { confidence });
      const t3 = performance.now();

      options.onProgress?.(90);
      const annotated = renderAnnotated(bitmap, dets);
      options.onProgress?.(100);

      return {
        total_objects: dets.length,
        detections: groupByClass(dets),
        processing_time_ms: Math.round(t3 - t0),
        annotated_image_base64: annotated,
        model_name: `${BROWSER_MODEL_LABEL} (in browser, ${model.backend})`,
        confidence_threshold: confidence,
        image_width: lb.srcW,
        image_height: lb.srcH,
        cached: false,
        stage_timings: {
          preprocess_ms: round2(t1 - t0),
          inference_ms: round2(t2 - t1),
          postprocess_ms: round2(t3 - t2),
        },
        supports_segmentation: false,
        nms_free: false,
        inference_engine: model.backend,
        metadata: meta,
      };
    } finally {
      bitmap.close();
    }
  });
}
