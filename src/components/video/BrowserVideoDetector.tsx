import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Play, Square, AlertTriangle } from 'lucide-react';
import ConfidenceSlider from '../ConfidenceSlider';
import { classColorHex, Detection } from '../../utils/onnxDetect';
import { layoutLabel, readableTextColor } from '../../utils/videoOverlay';

/**
 * Video detection that runs entirely in this browser: the chosen file is played
 * in a <video>, and frames are sent to the already-loaded YOLO11n ONNX session
 * (services/browserInference.ts). Nothing is uploaded and /api/detect is never
 * called.
 *
 * Frames are checked as the video presents them (requestVideoFrameCallback,
 * with requestAnimationFrame as the fallback). Inference is slower than
 * playback, so an `isInferring` guard drops frames while one is running:
 * there is no queue, so the boxes never fall further behind, and the session
 * is created once and reused.
 */

// Heavy files are refused, or allowed with a warning, before any decoding work.
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const WARN_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 10 * 60;
export const WARN_VIDEO_SECONDS = 90;

const STATS_INTERVAL_MS = 400;

interface Props {
  confidenceThreshold: number;
  onConfidenceChange: (value: number) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface Stats {
  analysed: number;
  dropped: number;
  fps: number;
  lastMs: number;
  objects: number;
  perClass: Record<string, number>;
  backend: 'webgpu' | 'wasm' | null;
}

const EMPTY_STATS: Stats = { analysed: 0, dropped: 0, fps: 0, lastMs: 0, objects: 0, perClass: {}, backend: null };

const fmtMB = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function BrowserVideoDetector({ confidenceThreshold, onConfidenceChange, onNotify }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; bytes: number; seconds: number; w: number; h: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [phase, setPhase] = useState('');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  // Mutable loop state lives in refs so the frame callbacks never see stale values.
  const detectingRef = useRef(false);
  const isInferringRef = useRef(false);
  const needRefreshRef = useRef(false); // a seek/pause landed while a frame was in flight
  const confidenceRef = useRef(confidenceThreshold);
  const generationRef = useRef(0); // bumped on stop/new file/unmount; stale results are ignored
  const callbackIdRef = useRef<number | null>(null);
  const callbackKindRef = useRef<'vfc' | 'raf' | null>(null);
  const lastRafTimeRef = useRef(-1);
  const liveStatsRef = useRef<Stats>({ ...EMPTY_STATS });
  const completionTimesRef = useRef<number[]>([]);
  const lastStatsPushRef = useRef(0);
  const lastDetectionsRef = useRef<Detection[]>([]);

  useEffect(() => {
    confidenceRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  // --- Drawing ------------------------------------------------------------------

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }, []);

  const drawDetections = useCallback((dets: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    // The canvas is in source-video pixels; CSS scales it exactly over the video.
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const shortSide = Math.min(w, h);
    const lineWidth = Math.max(2, Math.round(shortSide / 300));
    const fontPx = Math.min(48, Math.max(12, Math.round(shortSide / 40)));
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
  }, []);

  // --- Stats --------------------------------------------------------------------

  const pushStats = useCallback((force = false) => {
    const now = performance.now();
    if (!force && now - lastStatsPushRef.current < STATS_INTERVAL_MS) return;
    lastStatsPushRef.current = now;
    // FPS = completed inferences in the last second.
    const recent = completionTimesRef.current.filter((t) => now - t <= 1000);
    completionTimesRef.current = recent;
    liveStatsRef.current.fps = recent.length;
    setStats({ ...liveStatsRef.current, perClass: { ...liveStatsRef.current.perClass } });
  }, []);

  // --- The inference step (one frame at a time) ----------------------------------

  const inferCurrentFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || video.readyState < 2) return;
    isInferringRef.current = true;
    const generation = generationRef.current;
    try {
      const { detectFrameInBrowser } = await import('../../services/browserInference');
      const res = await detectFrameInBrowser(video, video.videoWidth, video.videoHeight, confidenceRef.current);
      if (generation !== generationRef.current) return; // stopped, replaced or unmounted meanwhile

      lastDetectionsRef.current = res.detections;
      drawDetections(res.detections);

      const perClass: Record<string, number> = {};
      for (const d of res.detections) perClass[d.className] = (perClass[d.className] ?? 0) + 1;
      const s = liveStatsRef.current;
      s.analysed += 1;
      s.lastMs = res.ms;
      s.objects = res.detections.length;
      s.perClass = perClass;
      s.backend = res.backend;
      completionTimesRef.current.push(performance.now());
      pushStats();
    } catch (err: any) {
      if (generation !== generationRef.current) return;
      setError(err?.message || 'In-browser video detection failed.');
      stopDetection();
    } finally {
      isInferringRef.current = false;
      // A seek or pause happened mid-inference: refresh once for the frame now showing.
      if (needRefreshRef.current && detectingRef.current && generation === generationRef.current) {
        needRefreshRef.current = false;
        void inferCurrentFrame();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDetections, pushStats]);

  /** A frame the video has presented: check it unless one is already running (then drop it). */
  const onFrame = useCallback(() => {
    if (!detectingRef.current) return;
    if (isInferringRef.current) {
      liveStatsRef.current.dropped += 1;
      pushStats();
      return;
    }
    void inferCurrentFrame();
  }, [inferCurrentFrame, pushStats]);

  // --- Frame scheduling: requestVideoFrameCallback, else requestAnimationFrame ----

  const cancelScheduled = useCallback(() => {
    const video = videoRef.current;
    const id = callbackIdRef.current;
    if (id !== null) {
      if (callbackKindRef.current === 'vfc') video?.cancelVideoFrameCallback?.(id);
      else cancelAnimationFrame(id);
    }
    callbackIdRef.current = null;
    callbackKindRef.current = null;
  }, []);

  const scheduleNext = useCallback(() => {
    const video = videoRef.current;
    if (!video || !detectingRef.current || callbackIdRef.current !== null) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      callbackKindRef.current = 'vfc';
      callbackIdRef.current = video.requestVideoFrameCallback(() => {
        callbackIdRef.current = null;
        if (!detectingRef.current) return;
        scheduleNext(); // schedule first so no presented frame is missed
        onFrame();
      });
    } else {
      callbackKindRef.current = 'raf';
      callbackIdRef.current = requestAnimationFrame(() => {
        callbackIdRef.current = null;
        if (!detectingRef.current) return;
        scheduleNext();
        // rAF fires at display rate; only act when the video has moved on.
        if (!video.paused && !video.ended && video.currentTime !== lastRafTimeRef.current) {
          lastRafTimeRef.current = video.currentTime;
          onFrame();
        }
      });
    }
  }, [onFrame]);

  // --- Start / stop ---------------------------------------------------------------

  function stopDetection() {
    generationRef.current += 1;
    detectingRef.current = false;
    needRefreshRef.current = false;
    cancelScheduled();
    isInferringRef.current = false;
    clearCanvas();
    setDetecting(false);
    setPhase('');
    pushStats(true);
  }

  const startDetection = async () => {
    const video = videoRef.current;
    if (!video || detectingRef.current) return;
    setError(null);
    generationRef.current += 1;
    const generation = generationRef.current;
    detectingRef.current = true;
    setDetecting(true);
    liveStatsRef.current = { ...EMPTY_STATS };
    completionTimesRef.current = [];
    setStats(EMPTY_STATS);

    try {
      const { loadBrowserModel } = await import('../../services/browserInference');
      const model = await loadBrowserModel(setPhase);
      if (generation !== generationRef.current) return;
      liveStatsRef.current.backend = model.backend;
      setPhase('');
    } catch (err: any) {
      if (generation !== generationRef.current) return;
      setError(err?.message || 'Could not start in-browser detection.');
      stopDetection();
      return;
    }

    lastRafTimeRef.current = -1;
    scheduleNext();
    // Paused (or just opened): check the frame on screen now; playing frames follow by callback.
    if (video.paused) void inferCurrentFrame();
  };

  // --- Video element events -------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const refreshStill = () => {
      if (!detectingRef.current) return;
      if (isInferringRef.current) needRefreshRef.current = true;
      else void inferCurrentFrame();
    };
    const onSeeking = () => {
      // Boxes belong to the old frame; hide them until the new one is checked.
      if (detectingRef.current) clearCanvas();
    };
    const onPlay = () => {
      if (detectingRef.current) {
        lastRafTimeRef.current = -1;
        scheduleNext();
      }
    };
    const onEnded = () => {
      if (detectingRef.current) pushStats(true);
    };

    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', refreshStill);
    video.addEventListener('pause', refreshStill);
    video.addEventListener('play', onPlay);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', refreshStill);
      video.removeEventListener('pause', refreshStill);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('ended', onEnded);
    };
  }, [url, inferCurrentFrame, scheduleNext, clearCanvas, pushStats]);

  // Unmount: stop everything, release the video and its object URL.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      detectingRef.current = false;
      const video = videoRef.current;
      const id = callbackIdRef.current;
      if (id !== null) {
        if (callbackKindRef.current === 'vfc') video?.cancelVideoFrameCallback?.(id);
        else cancelAnimationFrame(id);
      }
      video?.pause();
      video?.removeAttribute('src');
      video?.load();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // --- File selection and the size guard ---------------------------------------------

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setWarning(null);

    if (!file.type.startsWith('video/')) {
      setError(`"${file.name}" is not a video file.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`This video is ${fmtMB(file.size)}. In-browser detection accepts up to ${fmtMB(MAX_VIDEO_BYTES)}; trim it or use the backend.`);
      return;
    }

    // Start over: stop the loop and drop the old file's state.
    stopDetection();
    setStats(EMPTY_STATS);
    liveStatsRef.current = { ...EMPTY_STATS };
    setFileInfo(null);

    const next = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const seconds = probe.duration;
      const w = probe.videoWidth;
      const h = probe.videoHeight;
      probe.removeAttribute('src');
      probe.load();
      if (!Number.isFinite(seconds) || !w || !h) {
        URL.revokeObjectURL(next);
        setError('Could not read this video (unsupported codec or a live stream). Try an MP4 (H.264) or WebM file.');
        return;
      }
      if (seconds > MAX_VIDEO_SECONDS) {
        URL.revokeObjectURL(next);
        setError(`This video is ${fmtTime(seconds)} long. In-browser detection accepts up to ${fmtTime(MAX_VIDEO_SECONDS)}.`);
        return;
      }
      const notes: string[] = [];
      if (seconds > WARN_VIDEO_SECONDS) notes.push(`${fmtTime(seconds)} long`);
      if (file.size > WARN_VIDEO_BYTES) notes.push(fmtMB(file.size));
      if (Math.max(w, h) > 1920) notes.push(`${w}×${h}`);
      if (notes.length) {
        setWarning(`Large video (${notes.join(', ')}). Detection will still work, but expect a low frame rate. A short clip is best.`);
      }
      setFileInfo({ name: file.name, bytes: file.size, seconds, w, h });
      setUrl(next); // the effect above revokes the previous URL
    };
    probe.onerror = () => {
      URL.revokeObjectURL(next);
      setError('Could not read this video (unsupported codec). Try an MP4 (H.264) or WebM file.');
    };
    probe.src = next;
  };

  // --- Render ---------------------------------------------------------------------

  const classPills = Object.entries(stats.perClass).sort((a, b) => b[1] - a[1]);
  const aspect = fileInfo ? `${fileInfo.w} / ${fileInfo.h}` : '16 / 9';

  return (
    <div className="space-y-5 animate-in fade-in" data-testid="browser-video-detector">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Video detection in your browser</h3>
            <p className="text-[11px] text-neutral-500">
              The video stays on this device. Frames are checked locally and never sent to /api/detect.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              data-testid="browser-video-input"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-neutral-700 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-500"
            >
              <Upload className="h-3.5 w-3.5" /> {url ? 'Choose another video' : 'Choose a video'}
            </button>
            {url && (
              <button
                type="button"
                data-testid="browser-video-toggle"
                onClick={() => (detecting ? stopDetection() : void startDetection())}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold ${
                  detecting ? 'bg-rose-500 text-white' : 'bg-[#32FF00] text-neutral-950'
                }`}
              >
                {detecting ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {detecting ? 'Stop detection' : 'Start detection'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-2 text-xs text-rose-300" role="alert" data-testid="browser-video-error">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
        {warning && !error && (
          <p className="flex items-start gap-2 text-xs text-amber-300" data-testid="browser-video-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
          </p>
        )}
        {!url && !error && (
          <p className="text-xs text-neutral-500">
            Pick a short clip (MP4 or WebM). Up to {fmtMB(MAX_VIDEO_BYTES)} and {fmtTime(MAX_VIDEO_SECONDS)}; under 30 seconds works best.
          </p>
        )}
      </div>

      {url && fileInfo && (
        <>
          <div
            className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-black"
            style={{ aspectRatio: aspect }}
          >
            <video
              ref={videoRef}
              src={url}
              controls
              muted
              playsInline
              preload="auto"
              data-testid="browser-video"
              className="absolute inset-0 h-full w-full"
            />
            {/* Sits over the picture but leaves the native control bar clickable. */}
            <canvas
              ref={canvasRef}
              data-testid="browser-video-canvas"
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-300"
            data-testid="browser-video-stats"
            aria-live="polite"
          >
            <span className="font-semibold text-neutral-400">{fileInfo.name}</span>
            <span>
              {fmtTime(fileInfo.seconds)} · {fileInfo.w}×{fileInfo.h} · {fmtMB(fileInfo.bytes)}
            </span>
            <span className={detecting ? 'text-[#32FF00]' : 'text-neutral-500'}>
              {detecting ? (phase || 'Detecting') : 'Detection off'}
            </span>
            {detecting && !phase && (
              <>
                <span>{stats.fps} fps</span>
                <span>{stats.analysed} frames checked</span>
                <span>{stats.dropped} skipped</span>
                <span>{stats.lastMs ? `${Math.round(stats.lastMs)} ms/frame` : '…'}</span>
                {stats.backend && <span>{stats.backend === 'webgpu' ? 'WebGPU' : 'WASM (CPU)'}</span>}
              </>
            )}
          </div>

          {detecting && classPills.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="browser-video-classes">
              {classPills.map(([name, n]) => (
                <span key={name} className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200">
                  {name} × {n}
                </span>
              ))}
            </div>
          )}

          <ConfidenceSlider
            value={confidenceThreshold}
            onChange={onConfidenceChange}
            totalAvailable={stats.objects}
            shownCount={stats.objects}
          />
          <p className="text-[11px] text-neutral-500">
            The model is slower than playback, so some frames are skipped; boxes follow the most recent frame checked.
            Use pause or the seek bar to inspect a single frame.
          </p>
        </>
      )}
    </div>
  );
}
