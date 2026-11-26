import type * as OrtNs from 'onnxruntime-web';
import { DetectionResponse, ImageMetadata } from '../types';
import { computeLetterbox, inferOutputLayout, decodeOutput, groupByClass, classColorHex, rgbaToChw, PAD_VALUE, Detection } from '../utils/onnxDetect';
import { layoutLabel, readableTextColor } from '../utils/videoOverlay';
import { ORT_WASM_BASE_URL, modelFileUrl } from '../utils/modelUrls';
import {
  BrowserModelConfig,
  DEFAULT_MODEL_CONFIG,
  anchorsForSize,
  classNamesFor,
  configKey,
  modelFileName,
  sameConfig,
} from '../utils/browserModels';

/**
 * Object detection that runs entirely in the visitor's browser: YOLO11n as an
 * ONNX model on onnxruntime-web, WebGPU first with WASM as the fallback.
 *
 * Nothing is sent anywhere. The first use downloads the ONNX Runtime wasm
 * (about 30 MB) and the model (about 10 MB); the browser caches both, so later
 * visits start much faster. ONNX Runtime itself is imported lazily, so none of
 * this touches the app's initial bundle.
 */

// Model files come from VITE_MODEL_BASE_URL (default /models); the runtime wasm from
// VITE_ORT_WASM_BASE_URL (default: bundled at /ort/, see vite.config.ts and utils/modelUrls.ts).
export const modelUrl = (cfg: BrowserModelConfig) => modelFileUrl(modelFileName(cfg));
const ORT_ASSET_BASE = ORT_WASM_BASE_URL;
/** Larger images are downscaled before inference; the model only sees 640 px anyway. */
export const MAX_BROWSER_IMAGE_DIM = 4096;

type Ort = typeof OrtNs;
export type BrowserBackend = 'webgpu' | 'wasm';
export type PhaseCallback = (message: string) => void;

export interface BrowserModel {
  /** Which model file and input size this session runs (may differ from the one asked for after a fallback). */
  config: BrowserModelConfig;
  session: OrtNs.InferenceSession;
  backend: BrowserBackend;
  /** Why WebGPU was not used, when it was not. */
  fallbackReason?: string;
}

export interface BrowserDetectOptions {
  /** Model and input size; defaults to the one last selected with setActiveBrowserModel. */
  modelConfig?: BrowserModelConfig;
  confidenceThreshold?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  onPhase?: PhaseCallback;
}

// --- Loading ----------------------------------------------------------------------

let ortPromise: Promise<Ort> | null = null;
// One loaded session per (model, size); only the default and the latest pick are kept.
const modelPromises = new Map<string, Promise<BrowserModel>>();
const modelBytesCache = new Map<string, Uint8Array>();
const availabilityCache = new Map<string, Promise<boolean>>();
let activeConfig: BrowserModelConfig = DEFAULT_MODEL_CONFIG;

/** The model file is not on this host (as opposed to a download or runtime failure). */
class ModelMissingError extends Error {}

/** What loadBrowserModel() and detectFrameInBrowser() use when not told otherwise. */
export function setActiveBrowserModel(cfg: BrowserModelConfig): void {
  activeConfig = cfg;
}
export function getActiveBrowserModel(): BrowserModelConfig {
  return activeConfig;
}

/** Whether public/models/ has the file for this config. Cached; a missing file is never an error here. */
export function isModelAvailable(cfg: BrowserModelConfig): Promise<boolean> {
  const key = configKey(cfg);
  let p = availabilityCache.get(key);
  if (!p) {
    p = fetch(modelUrl(cfg), { method: 'HEAD' })
      .then((res) => res.ok && !(res.headers.get('content-type') || '').includes('text/html'))
      .catch(() => false);
    availabilityCache.set(key, p);
  }
  return p;
}

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

async function fetchModel(cfg: BrowserModelConfig, onPhase?: PhaseCallback): Promise<Uint8Array> {
  const key = configKey(cfg);
  const cached = modelBytesCache.get(key);
  if (cached) return cached;
  const url = modelUrl(cfg);
  const res = await fetch(url);
  if (res.status === 404) {
    throw new ModelMissingError(`The model file is missing on this host (${url}).`);
  }
  if (!res.ok) {
    throw new Error(`Could not download the model (${url}: HTTP ${res.status}).`);
  }
  // A static host that rewrites unknown paths to index.html answers 200 with HTML.
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    throw new ModelMissingError(`The model file is missing on this host (${url} returned a web page).`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer());
    modelBytesCache.set(key, all);
    return all;
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
    const name = modelFileName(cfg);
    onPhase?.(total ? `Downloading ${name} ${mb(received)} / ${mb(total)} MB…` : `Downloading ${name} ${mb(received)} MB…`);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  modelBytesCache.set(key, bytes);
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
async function warmUp(ort: Ort, session: OrtNs.InferenceSession, size: number): Promise<void> {
  const blank = new ort.Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size]);
  await session.run({ [session.inputNames[0]]: blank });
}

async function doLoad(cfg: BrowserModelConfig, onPhase?: PhaseCallback): Promise<BrowserModel> {
  onPhase?.('Loading the ONNX runtime…');
  const ort = await importOrt();
  const bytes = await fetchModel(cfg, onPhase);

  let fallbackReason: string;
  if (await webgpuUsable()) {
    try {
      onPhase?.('Starting WebGPU…');
      const session = await createSession(ort, bytes, 'webgpu');
      await warmUp(ort, session, cfg.size);
      return { config: cfg, session, backend: 'webgpu' };
    } catch (err: any) {
      fallbackReason = `WebGPU failed (${err?.message || err}); using WASM.`;
    }
  } else {
    fallbackReason = 'WebGPU is not available in this browser; using WASM.';
  }

  onPhase?.('Starting WASM…');
  const session = await createSession(ort, bytes, 'wasm');
  await warmUp(ort, session, cfg.size);
  return { config: cfg, session, backend: 'wasm', fallbackReason };
}

/** Free the sessions of models that are neither the default nor the one just loaded. */
function evictOthers(keep: BrowserModelConfig): void {
  const keepKeys = new Set([configKey(keep), configKey(DEFAULT_MODEL_CONFIG)]);
  for (const [key, promise] of [...modelPromises]) {
    if (keepKeys.has(key)) continue;
    modelPromises.delete(key);
    modelBytesCache.delete(key);
    promise.then((m) => m.session.release()).catch(() => undefined);
  }
}

/**
 * Loads (once per model) the runtime and the requested model. Safe to call
 * repeatedly; a failure is not cached. If the requested file is not in
 * public/models/, the default (yolo11n at 640) is used instead and the
 * returned model says so in `fallbackReason`.
 */
export function loadBrowserModel(onPhase?: PhaseCallback, config: BrowserModelConfig = activeConfig): Promise<BrowserModel> {
  const key = configKey(config);
  let promise = modelPromises.get(key);
  if (!promise) {
    promise = doLoad(config, onPhase)
      .then((model) => {
        evictOthers(config);
        return model;
      })
      .catch(async (err) => {
        modelPromises.delete(key);
        if (err instanceof ModelMissingError && !sameConfig(config, DEFAULT_MODEL_CONFIG)) {
          onPhase?.(`${modelFileName(config)} is not available; loading ${modelFileName(DEFAULT_MODEL_CONFIG)} instead…`);
          const fallback = await loadBrowserModel(onPhase, DEFAULT_MODEL_CONFIG);
          return {
            ...fallback,
            fallbackReason: `${modelFileName(config)} is not in public/models/, so ${modelFileName(DEFAULT_MODEL_CONFIG)} at ${DEFAULT_MODEL_CONFIG.size}×${DEFAULT_MODEL_CONFIG.size} is used. ${fallback.fallbackReason ?? ''}`.trim(),
          };
        }
        throw err;
      });
    modelPromises.set(key, promise);
  }
  return promise;
}

/** Replace a WebGPU session that failed while running with a WASM one. */
async function fallBackToWasm(config: BrowserModelConfig, reason: string): Promise<BrowserModel> {
  const ort = await importOrt();
  const bytes = await fetchModel(config);
  const session = await createSession(ort, bytes, 'wasm');
  await warmUp(ort, session, config.size);
  const model: BrowserModel = {
    config,
    session,
    backend: 'wasm',
    fallbackReason: `WebGPU failed while running (${reason}); using WASM.`,
  };
  modelPromises.set(configKey(config), Promise.resolve(model));
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

// One 640x640 scratch canvas, reused so per-frame video inference allocates no canvases.
let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; size: number } | null = null;

function letterboxToTensorData(bitmap: CanvasImageSource, lb: ReturnType<typeof computeLetterbox>, size: number): Float32Array {
  if (!scratch || scratch.size !== size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('This browser could not create a 2D canvas.');
    scratch = { canvas, ctx: c, size };
  }
  const ctx = scratch.ctx;
  ctx.fillStyle = `rgb(${PAD_VALUE},${PAD_VALUE},${PAD_VALUE})`;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, lb.left, lb.top, lb.newW, lb.newH);
  return rgbaToChw(ctx.getImageData(0, 0, size, size).data, size);
}

async function runModel(
  model: BrowserModel,
  input: Float32Array
): Promise<{ output: Float32Array; model: BrowserModel; numClasses: number; classNames: readonly string[] }> {
  const ort = await importOrt();
  const size = model.config.size;
  const feed = (m: BrowserModel) => ({
    [m.session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, size, size]),
  });

  let used = model;
  let results: OrtNs.InferenceSession.OnnxValueMapType;
  try {
    results = await used.session.run(feed(used));
  } catch (err: any) {
    if (used.backend !== 'webgpu') throw err;
    used = await fallBackToWasm(used.config, err?.message || String(err));
    results = await used.session.run(feed(used));
  }

  const tensor = results[used.session.outputNames[0]];
  // The class count is whatever the model outputs (80 for COCO, 1 for a penguin-only
  // checkpoint); only the anchor count has to match the input size.
  const { numClasses, numAnchors } = inferOutputLayout(tensor.dims);
  const anchors = anchorsForSize(size);
  if (numAnchors !== anchors) {
    throw new Error(
      `Unexpected model output shape ${tensor.dims.join('x')} for ${modelFileName(used.config)}: expected ${anchors} predictions at ${size}×${size}. ` +
        `Was the file exported at imgsz=${size}?`
    );
  }
  return { output: tensor.data as Float32Array, model: used, numClasses, classNames: classNamesFor(used.config, numClasses) };
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

export type BrowserDetectionResult = DetectionResponse & {
  inference_engine: BrowserBackend;
  /** The model file and size that actually ran (differs from the one picked after a fallback). */
  model_config: BrowserModelConfig;
  /** Why this is not the model or backend that was asked for, when it is not. */
  fallback_reason?: string;
  metadata?: ImageMetadata;
  /** The model's class names, index = class id (needed to export YOLO labels). */
  class_names: string[];
  /** Raw boxes in source pixels, with class ids, for exporting annotations. */
  raw_detections: { classId: number; className: string; score: number; box: [number, number, number, number] }[];
};

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
    let model = await loadBrowserModel(options.onPhase, options.modelConfig ?? activeConfig);
    if (options.signal?.aborted) throw canceled();
    options.onProgress?.(60);
    options.onPhase?.(`Running ${modelFileName(model.config)} on ${model.backend === 'webgpu' ? 'WebGPU' : 'WASM'}…`);

    const t0 = performance.now();
    const bitmap = await decodeForInference(file, meta, options.onPhase);
    try {
      const size = model.config.size;
      const lb = computeLetterbox(bitmap.width, bitmap.height, size);
      const input = letterboxToTensorData(bitmap, lb, size);
      const t1 = performance.now();

      const run = await runModel(model, input);
      model = run.model;
      const t2 = performance.now();
      if (options.signal?.aborted) throw canceled();

      const dets = decodeOutput(run.output, lb, {
        confidence,
        numAnchors: anchorsForSize(size),
        numClasses: run.numClasses,
        classNames: run.classNames,
      });
      const t3 = performance.now();

      options.onProgress?.(90);
      const annotated = renderAnnotated(bitmap, dets);
      options.onProgress?.(100);

      return {
        total_objects: dets.length,
        detections: groupByClass(dets),
        processing_time_ms: Math.round(t3 - t0),
        annotated_image_base64: annotated,
        model_name: `${modelFileName(model.config)} · ${size}px (in browser, ${model.backend})`,
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
        model_config: model.config,
        fallback_reason: model.fallbackReason,
        metadata: meta,
        class_names: [...run.classNames],
        raw_detections: dets,
      };
    } finally {
      bitmap.close();
    }
  });
}

export interface FrameDetectionResult {
  detections: Detection[];
  /** Source frame size the boxes are in. */
  width: number;
  height: number;
  classNames: readonly string[];
  backend: BrowserBackend;
  /** Preprocess + inference + decode, in ms. */
  ms: number;
}

/**
 * Detect objects in one video frame (or any canvas-drawable source) using the
 * already-loaded session. Returns boxes in source pixels (width x height).
 * Callers should drop frames while one is in flight (see BrowserVideoDetector's
 * isInferring guard); nothing here is sent over the network.
 */
export function detectFrameInBrowser(
  source: CanvasImageSource,
  width: number,
  height: number,
  confidence: number
): Promise<FrameDetectionResult> {
  return enqueue(async () => {
    const model = await loadBrowserModel();
    const t0 = performance.now();
    const size = model.config.size;
    const lb = computeLetterbox(width, height, size);
    const input = letterboxToTensorData(source, lb, size);
    const run = await runModel(model, input);
    const detections = decodeOutput(run.output, lb, {
      confidence,
      numAnchors: anchorsForSize(size),
      numClasses: run.numClasses,
      classNames: run.classNames,
    });
    return { detections, width, height, classNames: run.classNames, backend: run.model.backend, ms: performance.now() - t0 };
  });
}
