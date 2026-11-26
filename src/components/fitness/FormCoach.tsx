import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { AlertTriangle, Camera, Film, Square, Download, RotateCcw } from 'lucide-react';
import { EXERCISES, CoachExercise, FormSetSummary, FormTracker, FrameMetrics, Landmark, LumaSample, PoseSmoother, RepResult, TrackerDebug, frameMetrics, lightingHint, summarizeSet, visibilityHint, weakJoints } from '../../utils/poseMath';
import { clearFormSets, deleteFormSet, getFormSets, saveFormSet, useLive, type StoredFormSet } from '../../utils/fitnessDb';
import { downloadTextFile } from '../../utils/yoloLabels';
import { MEDIAPIPE_WASM_BASE_URL, poseModelUrl } from '../../utils/modelUrls';
import { useConsent } from '../ConsentProvider';

/**
 * Client-side form coach: MediaPipe Pose Landmarker on the camera (or a video
 * file you pick), with One-Euro smoothing, rep counting, depth and bar-path
 * feedback. The video never leaves this browser. The model and the wasm runtime
 * are loaded only when you press start, and every failure (no camera, no
 * permission, no model file, no GPU) ends in a message, not a crash.
 */

type Variant = 'full' | 'lite';
type Status = 'idle' | 'starting' | 'running';

// The runtime wasm and the .task files come from env-configurable bases (utils/modelUrls.ts), so a
// static host with a per-file size limit can serve them from object storage instead.
const WASM_BASE = MEDIAPIPE_WASM_BASE_URL;
const localModelUrl = (v: Variant) => poseModelUrl(v);
const remoteModelUrl = (v: Variant) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;

const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const FPS_CHOICES = [10, 15, 24] as const;

class ModelMissing extends Error {}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    // A static host that rewrites unknown paths to index.html answers 200 with HTML.
    return res.ok && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    // No connection: the offline shell may still hold the file from an earlier visit (it only handles GET).
    try {
      return Boolean(await caches.match(url));
    } catch {
      return false;
    }
  }
}

function cameraErrorMessage(err: any): string {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings, or analyse a video file instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. You can analyse a video file instead.';
    case 'NotReadableError':
      return 'The camera is in use by another app. Close it and try again.';
    default:
      return `Could not open the camera (${err?.message || err}). You can analyse a video file instead.`;
  }
}

const NO_SETS: StoredFormSet[] = [];
const sec = (ms: number) => (ms / 1000).toFixed(1);

/**
 * Average brightness of a 16x9 downsample of the current frame (everything, the middle, the border). It is
 * read once and thrown away: the pixels are never kept, shown or sent anywhere, and are only used to warn
 * about a dark room or a bright window behind you.
 */
function sampleLuma(video: HTMLVideoElement, canvasRef: { current: HTMLCanvasElement | null }): LumaSample {
  const W = 16;
  const H = 9;
  const c = (canvasRef.current ??= Object.assign(document.createElement('canvas'), { width: W, height: H }));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { mean: 128, center: 128, edge: 128 };
  ctx.drawImage(video, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let all = 0;
  let mid = 0;
  let border = 0;
  let nMid = 0;
  let nBorder = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      all += l;
      const inMid = x >= 5 && x < 11 && y >= 2 && y < 7;
      if (inMid) {
        mid += l;
        nMid += 1;
      } else if (x < 3 || x >= W - 3) {
        border += l;
        nBorder += 1;
      }
    }
  }
  return { mean: all / (W * H), center: mid / nMid, edge: border / nBorder };
}
const QUALITY_COLOR = { good: 'var(--f-good)', ok: 'var(--f-gold)', poor: 'var(--f-bad)' } as const;

export default function FormCoach() {
  const { ensure } = useConsent();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const connectionsRef = useRef<{ start: number; end: number }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  // A model file the user picked, good only for the variant (Full or Lite) it was picked for.
  const customModelRef = useRef<{ variant: Variant; url: string } | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const usingGpuRef = useRef(false);
  const smootherRef = useRef(new PoseSmoother(1.0, 0.02));
  const trackerRef = useRef(new FormTracker(EXERCISES.squat));
  const lastProcRef = useRef(0);
  const lastStatRef = useRef(0);
  const procTimesRef = useRef<number[]>([]);
  const lastMetricsRef = useRef<FrameMetrics | null>(null);
  // Every rep of the set in progress (the screen keeps only the latest), and when the set began.
  const allRepsRef = useRef<RepResult[]>([]);
  const setStartRef = useRef(0);
  const debugOnRef = useRef(false);
  const lastHintRef = useRef(0);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightNoteRef = useRef<string | null>(null);
  const lastLightRef = useRef(0);

  const [exercise, setExercise] = useState<CoachExercise>('squat');
  const [variant, setVariant] = useState<Variant>('full');
  const [targetFps, setTargetFps] = useState<number>(15);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [modelMissing, setModelMissing] = useState(false);
  const [source, setSource] = useState<'camera' | 'file' | null>(null);
  const [reps, setReps] = useState<RepResult[]>([]);
  const [live, setLive] = useState({ angle: 0, fps: 0, person: false, delegate: '' });
  const [hint, setHint] = useState<string | null>(null);
  const [debugOn, setDebugOn] = useState(false);
  const [dbg, setDbg] = useState<TrackerDebug | null>(null);
  const [summary, setSummary] = useState<{ data: FormSetSummary; id?: string; saveFailed?: boolean } | null>(null);
  const history = useLive(getFormSets, [], NO_SETS);

  const exerciseRef = useRef(exercise);
  const variantRef = useRef(variant);
  const fpsRef = useRef(targetFps);
  exerciseRef.current = exercise;
  variantRef.current = variant;
  fpsRef.current = targetFps;
  debugOnRef.current = debugOn;

  // --- Drawing -------------------------------------------------------------------------

  const clearOverlay = useCallback(() => {
    const c = overlayRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }, []);

  const draw = useCallback((lm: Landmark[], m: FrameMetrics | null) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const line = Math.max(2, Math.round(Math.min(w, h) / 220));

    ctx.lineWidth = line;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    for (const { start, end } of connectionsRef.current) {
      const a = lm[start];
      const b = lm[end];
      if (!a || !b || (a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff5a1f';
    for (const p of lm) {
      if ((p.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, line * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bar path: earlier reps faint, the current rep bright.
    const draw = (pts: { x: number; y: number }[], color: string) => {
      if (pts.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = line;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    };
    for (const p of trackerRef.current.pastPaths) draw(p, 'rgba(255,176,32,0.25)');
    draw(trackerRef.current.currentPath, '#ffb020');

    if (m) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(Math.min(w, h) / 22)}px sans-serif`;
      ctx.fillText(`${EXERCISES[exerciseRef.current].angleName} ${Math.round(m.angle)}°`, 12, Math.round(Math.min(w, h) / 12));
    }
  }, []);

  // --- Lifecycle -----------------------------------------------------------------------

  const stop = useCallback(() => {
    // The set that just ended: summarise it and keep the summary on this device (numbers only).
    const done = allRepsRef.current;
    allRepsRef.current = [];
    if (runningRef.current && done.length > 0) {
      const data = summarizeSet(exerciseRef.current, done, performance.now() - setStartRef.current, Date.now());
      if (data) {
        setSummary({ data });
        saveFormSet(data).then(
          (id) => setSummary((s) => (s && s.data === data ? { ...s, id } : s)),
          () => setSummary((s) => (s && s.data === data ? { ...s, saveFailed: true } : s))
        );
      }
    }
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute('src');
      v.load();
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    try {
      landmarkerRef.current?.close();
    } catch {
      // Already closed.
    }
    landmarkerRef.current = null;
    clearOverlay();
    setStatus('idle');
    setSource(null);
    setLive((l) => ({ ...l, person: false, fps: 0 }));
    setHint(null);
  }, [clearOverlay]);

  // Leaving the page must release the camera and the model.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      if (customModelRef.current) URL.revokeObjectURL(customModelRef.current.url);
      try {
        landmarkerRef.current?.close();
      } catch {
        // Already closed.
      }
    };
  }, []);

  // A new exercise means new thresholds and a new count.
  useEffect(() => {
    trackerRef.current = new FormTracker(EXERCISES[exercise]);
    smootherRef.current.reset();
    allRepsRef.current = [];
    setReps([]);
    clearOverlay();
  }, [exercise, clearOverlay]);

  // --- Model ---------------------------------------------------------------------------------

  const createLandmarker = useCallback(async (v: Variant, allowRemote: boolean): Promise<PoseLandmarker> => {
    const vision = await import('@mediapipe/tasks-vision');
    connectionsRef.current = vision.PoseLandmarker.POSE_CONNECTIONS.map((c) => ({ start: c.start, end: c.end }));

    if (!(await urlExists(`${WASM_BASE}/vision_wasm_internal.wasm`))) {
      throw new Error(navigator.onLine === false ? 'You are offline, and the coach has not been downloaded on this device yet. Connect once to download it, and it will work offline after that.' : 'The MediaPipe runtime files are missing from this build (expected under /mediapipe/wasm/).');
    }
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);

    let modelPath: string;
    if (customModelRef.current?.variant === v) modelPath = customModelRef.current.url;
    else if (await urlExists(localModelUrl(v))) modelPath = localModelUrl(v);
    else if (allowRemote) modelPath = remoteModelUrl(v);
    else throw new ModelMissing(`pose_landmarker_${v}.task was not found in public/models/pose/.`);

    const make = (delegate: 'GPU' | 'CPU') =>
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    try {
      const lm = await make('GPU');
      usingGpuRef.current = true;
      return lm;
    } catch {
      usingGpuRef.current = false;
      return make('CPU');
    }
  }, []);

  // --- The frame loop ---------------------------------------------------------------------

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const lmk = landmarkerRef.current;
    if (video && video.ended && fileUrlRef.current) {
      stop(); // an analysed video reached its end: that is the end of the set
      return;
    }
    if (!video || !lmk || video.readyState < 2 || video.paused || video.ended) return;

    const now = performance.now();
    // Throttle: pose estimation is the expensive part, so run it at the chosen rate, not the display rate.
    if (now - lastProcRef.current < 1000 / fpsRef.current) return;
    lastProcRef.current = now;

    let result;
    try {
      result = lmk.detectForVideo(video, now);
    } catch (err: any) {
      setError(`Pose detection failed: ${err?.message || err}`);
      stop();
      return;
    }

    procTimesRef.current.push(now);
    procTimesRef.current = procTimesRef.current.filter((t) => now - t < 1000);

    const raw = result.landmarks?.[0] as Landmark[] | undefined;
    if (!raw) {
      clearOverlay();
      lastMetricsRef.current = null;
      trackerRef.current.lost(now, 'no person in view');
      if (now - lastStatRef.current > 300) {
        lastStatRef.current = now;
        setLive((l) => ({ ...l, person: false, fps: procTimesRef.current.length }));
      }
      return;
    }

    const smooth = smootherRef.current.smooth(raw, now);
    const m = frameMetrics(smooth, video.videoWidth, video.videoHeight, exerciseRef.current);
    lastMetricsRef.current = m;
    const rep = m ? trackerRef.current.update(m, now) : null;
    if (!m) trackerRef.current.lost(now, 'pose incomplete');
    if (rep) {
      allRepsRef.current.push(rep);
      setReps((r) => [...r.slice(-19), rep]);
    }
    draw(smooth, m);

    // Set-up advice, a couple of times a second: hidden joints first, then the light.
    if (now - lastHintRef.current > 600) {
      lastHintRef.current = now;
      if (now - lastLightRef.current > 1500) {
        lastLightRef.current = now;
        lightNoteRef.current = lightingHint(sampleLuma(video, lightCanvasRef));
      }
      setHint(visibilityHint(weakJoints(smooth, exerciseRef.current)) ?? lightNoteRef.current);
    }
    if (debugOnRef.current && now - lastStatRef.current > 150) setDbg(trackerRef.current.debug());

    if (now - lastStatRef.current > 200) {
      lastStatRef.current = now;
      setLive({ angle: m?.angle ?? 0, fps: procTimesRef.current.length, person: true, delegate: usingGpuRef.current ? 'GPU' : 'CPU' });
    }
  }, [clearOverlay, draw, stop]);

  const begin = async (kind: 'camera' | 'file', file?: File, allowRemote = false) => {
    // Nothing starts (no model download, no camera prompt) until the visitor has agreed.
    if (!(await ensure('local'))) return;
    setError('');
    setModelMissing(false);
    stop();
    setStatus('starting');
    const video = videoRef.current;
    if (!video) return;

    try {
      if (kind === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser cannot access a camera here (it needs a secure https page). You can analyse a video file instead.');
        }
      } else if (file) {
        if (!file.type.startsWith('video/')) throw new Error(`"${file.name}" is not a video file.`);
        if (file.size > MAX_VIDEO_BYTES) throw new Error(`That video is ${(file.size / 1048576).toFixed(0)} MB; the limit is ${MAX_VIDEO_BYTES / 1048576} MB.`);
      }

      // Model first: if it is missing we never ask for the camera.
      landmarkerRef.current = await createLandmarker(variantRef.current, allowRemote);

      if (kind === 'camera') {
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false });
        } catch (e) {
          throw new Error(cameraErrorMessage(e));
        }
        video.srcObject = streamRef.current;
        video.controls = false;
      } else if (file) {
        fileUrlRef.current = URL.createObjectURL(file);
        video.src = fileUrlRef.current;
        video.controls = true;
      }
      video.muted = true;
      await video.play().catch(() => undefined);

      trackerRef.current = new FormTracker(EXERCISES[exerciseRef.current]);
      smootherRef.current.reset();
      allRepsRef.current = [];
      setStartRef.current = performance.now();
      setSummary(null);
      setHint(null);
      setReps([]);
      procTimesRef.current = [];
      lastProcRef.current = 0;
      runningRef.current = true;
      setSource(kind);
      setStatus('running');
      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus('idle');
      if (err instanceof ModelMissing) {
        setModelMissing(true);
        setError(err.message);
      } else {
        setError(err?.message || 'Could not start the form coach.');
      }
    }
  };

  // Switching Full/Lite while running: load the other model and carry on, keeping the count.
  const changeVariant = async (next: Variant) => {
    if (next === variant) return;
    setVariant(next);
    variantRef.current = next;
    if (!runningRef.current) return;
    try {
      const fresh = await createLandmarker(next, false);
      const old = landmarkerRef.current;
      landmarkerRef.current = fresh;
      try {
        old?.close();
      } catch {
        // Already closed.
      }
    } catch (err: any) {
      if (err instanceof ModelMissing) {
        setModelMissing(true);
        setError(`${err.message} Still using the previous model.`);
        setVariant(variant);
        variantRef.current = variant;
      } else setError(err?.message || 'Could not switch model.');
    }
  };

  // --- Snapshot ---------------------------------------------------------------------------------

  const snapshot = () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    if (overlay) ctx.drawImage(overlay, 0, 0, c.width, c.height);
    const last = reps[reps.length - 1];
    const label = `${EXERCISES[exercise].label} · ${trackerRef.current.reps} reps${last ? ` · ${last.notes[0]}` : ''}`;
    const fontPx = Math.round(Math.min(c.width, c.height) / 22);
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, c.height - fontPx * 1.9, c.width, fontPx * 1.9);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, fontPx * 0.5, c.height - fontPx * 0.6);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-${exercise}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const exportReps = () => {
    const rows = ['rep,kind,quality,min_angle,duration_ms,bar_drift_pct,notes', ...reps.map((r, i) => `${i + 1},${r.kind},${r.quality},${Math.round(r.minAngle)},${Math.round(r.durationMs)},${Math.round(r.barDrift * 100)},"${r.notes.join(' ').replace(/"/g, '""')}"`)];
    downloadTextFile(`form-${exercise}-${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n') + '\n', 'text/csv;charset=utf-8');
  };

  const spec = EXERCISES[exercise];
  const goodReps = reps.filter((r) => r.kind === 'rep').length;
  const last = reps[reps.length - 1];
  const running = status === 'running';

  return (
    <div className="space-y-4" data-testid="form-coach">
      <section className="f-card space-y-3">
        <div>
          <h2 className="f-h">AI Form Coach</h2>
          <p className="f-small">Counts your reps and checks depth and bar path from your camera or a video. It runs entirely on this device: nothing is uploaded.</p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Exercise">
          {(Object.keys(EXERCISES) as CoachExercise[]).map((id) => (
            <button key={id} type="button" className="f-chip" aria-pressed={exercise === id} data-testid={`coach-ex-${id}`} onClick={() => setExercise(id)}>
              {EXERCISES[id].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 f-small">
          <span className="flex items-center gap-1.5" role="group" aria-label="Model size">
            Model
            {(['full', 'lite'] as const).map((v) => (
              <button key={v} type="button" className="f-chip" aria-pressed={variant === v} data-testid={`coach-model-${v}`} onClick={() => void changeVariant(v)}>
                {v === 'full' ? 'Full' : 'Lite (faster)'}
              </button>
            ))}
          </span>
          <label className="flex items-center gap-1.5">
            Analyse at
            <select className="f-select" style={{ width: 'auto', minHeight: 30 }} aria-label="Frames per second" data-testid="coach-fps" value={targetFps} onChange={(e) => setTargetFps(Number(e.target.value))}>
              {FPS_CHOICES.map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {running ? (
            <button type="button" className="f-btn-danger" data-testid="coach-stop" onClick={stop}>
              <Square className="h-4 w-4" /> Stop
            </button>
          ) : (
            <>
              <button type="button" className="f-btn-primary" data-testid="coach-start-camera" disabled={status === 'starting'} onClick={() => void begin('camera')}>
                <Camera className="h-4 w-4" /> {status === 'starting' ? 'Starting…' : 'Start camera'}
              </button>
              <label className="f-btn cursor-pointer" aria-disabled={status === 'starting'}>
                <Film className="h-4 w-4" /> Analyse a video
                <input type="file" accept="video/*" className="hidden" data-testid="coach-video-input" disabled={status === 'starting'} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void begin('file', f); }} />
              </label>
            </>
          )}
          <button type="button" className="f-btn" data-testid="coach-snapshot" disabled={!running} onClick={snapshot}>
            <Download className="h-4 w-4" /> Snapshot
          </button>
          <button
            type="button"
            className="f-btn"
            disabled={reps.length === 0}
            onClick={() => {
              trackerRef.current.reset();
              allRepsRef.current = [];
              setReps([]);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset reps
          </button>
          <button type="button" className="f-chip" style={{ minHeight: 40 }} aria-pressed={debugOn} data-testid="coach-debug-toggle" onClick={() => setDebugOn((v) => !v)}>
            Debug
          </button>
        </div>
        <div className="space-y-1" data-testid="coach-guide">
          <div className="f-small font-semibold" style={{ color: 'var(--f-text)' }}>
            Set up the shot
          </div>
          <ul className="list-disc space-y-0.5 pl-5 f-small">
            {spec.framing.map((t) => (
              <li key={t}>{t}</li>
            ))}
            <li>Light the room from the front or the side, and keep bright windows out of the background.</li>
            <li>Fitted clothes and a clear floor help it find your joints. It measures angles from one 2D view, so a side-on camera is the most accurate.</li>
          </ul>
        </div>
      </section>

      {error && (
        <section className="f-card space-y-3" role="alert" data-testid="coach-error" style={{ borderColor: 'var(--f-bad)' }}>
          <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--f-bad)' }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
          {modelMissing && (
            <div className="space-y-3 text-xs" data-testid="coach-model-help">
              <p className="f-muted">The pose model file (about 6 to 9 MB) is not part of this site. Pick one of these:</p>
              <ol className="list-decimal space-y-2 pl-5 f-muted">
                <li>
                  <strong style={{ color: 'var(--f-text)' }}>Choose a .task file</strong> you already have:{' '}
                  <label className="f-btn inline-flex cursor-pointer" style={{ minHeight: 30, padding: '0 10px', fontSize: 11 }}>
                    Pick file
                    <input
                      type="file"
                      accept=".task"
                      className="hidden"
                      data-testid="coach-model-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        if (customModelRef.current) URL.revokeObjectURL(customModelRef.current.url);
                        customModelRef.current = { variant: variantRef.current, url: URL.createObjectURL(f) };
                        setError('');
                        setModelMissing(false);
                      }}
                    />
                  </label>
                </li>
                <li>
                  <strong style={{ color: 'var(--f-text)' }}>Download it once from Google&apos;s model host</strong> (storage.googleapis.com) when you start:{' '}
                  <button type="button" className="f-btn" style={{ minHeight: 30, padding: '0 10px', fontSize: 11 }} data-testid="coach-allow-remote" onClick={() => void begin(source ?? 'camera', undefined, true)}>
                    Download and start camera
                  </button>
                </li>
                <li>
                  <strong style={{ color: 'var(--f-text)' }}>Host it yourself</strong>: save <code>pose_landmarker_{variant}.task</code> as <code>public/models/pose/pose_landmarker_{variant}.task</code> (see <code>public/models/README.md</code>).
                </li>
              </ol>
            </div>
          )}
        </section>
      )}

      <section className="f-card space-y-3">
        <div className="relative mx-auto w-full overflow-hidden rounded-xl" style={{ background: '#000', aspectRatio: '16 / 9', maxWidth: 720 }}>
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" data-testid="coach-video" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" data-testid="coach-overlay" />
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm" style={{ color: '#c9d1db' }}>
              {status === 'starting' ? 'Loading the pose model…' : 'Start the camera or pick a video to begin.'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center" data-testid="coach-hud">
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--f-accent)', background: 'var(--f-surface-2)' }}>
            <div className="f-small">Reps</div>
            <div className="text-3xl font-extrabold" data-testid="coach-reps">
              {goodReps}
            </div>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }}>
            <div className="f-small">{spec.angleName} angle</div>
            <div className="text-3xl font-extrabold tabular-nums">{running && live.person ? `${Math.round(live.angle)}°` : '–'}</div>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }}>
            <div className="f-small">Analysis</div>
            <div className="text-lg font-bold tabular-nums">{running ? `${live.fps} fps` : '–'}</div>
            <div className="f-small">{running ? live.delegate : ''}</div>
          </div>
        </div>
        {running && !live.person && <p className="f-small" data-testid="coach-no-person">No person detected. Step back so your whole body is in frame.</p>}
        {running && live.person && hint && (
          <p role="status" className="text-xs font-semibold" style={{ color: 'var(--f-gold)' }} data-testid="coach-hint">
            {hint}
          </p>
        )}
        {debugOn && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border p-3 font-mono text-[11px]" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="coach-debug">
            {running && dbg ? (
              <>
                <dt className="f-muted">Phase</dt>
                <dd data-testid="dbg-phase">{dbg.phase}</dd>
                <dt className="f-muted">Angle (smoothed / raw)</dt>
                <dd>
                  {Math.round(dbg.angle)}° / {Math.round(dbg.rawAngle)}°
                </dd>
                <dt className="f-muted">Weakest joint visibility</dt>
                <dd>{dbg.jointVisibility.toFixed(2)}</dd>
                <dt className="f-muted">Standing / starts below</dt>
                <dd>
                  {Math.round(dbg.standing)}° / {Math.round(dbg.startsBelow)}°
                </dd>
                <dt className="f-muted">Depth at / finishes at</dt>
                <dd>
                  {Math.round(dbg.depthAt)}° / {Math.round(dbg.finishesAt)}°
                </dd>
                <dt className="f-muted">Reps / partials</dt>
                <dd>
                  {dbg.reps} / {dbg.partials}
                </dd>
                <dt className="f-muted">Last event</dt>
                <dd>{dbg.lastEvent}</dd>
                <dt className="f-muted">Last ignored</dt>
                <dd data-testid="dbg-reject">{dbg.lastReject ?? 'none'}</dd>
              </>
            ) : (
              <dd className="col-span-2 f-muted">Start the coach to see what the counter is doing, frame by frame.</dd>
            )}
          </dl>
        )}
        {source === 'file' && <p className="f-small">Playing a file: pause it to inspect a frame, then take a snapshot.</p>}
      </section>

      {summary && (
        <section className="f-card space-y-3" data-testid="coach-summary" aria-label="Set summary">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="f-h">Set summary · {EXERCISES[summary.data.exercise].label}</h3>
            <span className="f-small">{sec(summary.data.durationMs)} s</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {(
              [
                ['Reps', String(summary.data.reps), 'summary-reps'],
                ['Partials', String(summary.data.partials), 'summary-partials'],
                [`Depth (${EXERCISES[summary.data.exercise].angleName})`, summary.data.reps ? `${summary.data.avgDepth}°` : '–', 'summary-depth'],
                ['Tempo down / pause / up', summary.data.reps ? `${sec(summary.data.avgDownMs)} / ${sec(summary.data.avgPauseMs)} / ${sec(summary.data.avgUpMs)} s` : '–', 'summary-tempo'],
              ] as const
            ).map(([label, value, id]) => (
              <div key={id} className="rounded-xl border p-2" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }}>
                <div className="f-small">{label}</div>
                <div className="text-lg font-extrabold tabular-nums" data-testid={id}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-xs" data-testid="summary-cues">
            {summary.data.cues.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
          <p className="f-small" data-testid="summary-saved">
            {summary.saveFailed ? 'Could not save this summary (storage may be full or blocked).' : summary.id ? 'Saved on this device only.' : 'Saving…'}{' '}
            {summary.id && (
              <button
                type="button"
                className="underline"
                style={{ minHeight: 32 }}
                data-testid="summary-delete"
                onClick={() => {
                  void deleteFormSet(summary.id!);
                  setSummary(null);
                }}
              >
                Delete
              </button>
            )}
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section className="f-card space-y-2" data-testid="coach-history">
          <div className="flex items-center justify-between gap-2">
            <h3 className="f-h">Recent form sets</h3>
            <button type="button" className="inline-flex min-h-[32px] items-center text-[11px] font-semibold f-accent hover:underline" data-testid="history-clear" onClick={() => void clearFormSets()}>
              Clear all
            </button>
          </div>
          <ul className="space-y-1.5">
            {history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-2 text-xs" data-testid="history-set">
                <span className="min-w-0">
                  <strong>{EXERCISES[h.exercise].label}</strong> · {h.reps} reps{h.partials ? ` · ${h.partials} partial` : ''}
                  <span className="block f-muted">
                    {new Date(h.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {h.reps ? ` · depth ${h.avgDepth}° · tempo ${sec(h.avgDownMs)}/${sec(h.avgPauseMs)}/${sec(h.avgUpMs)} s` : ''}
                  </span>
                </span>
                <button type="button" aria-label={`Delete this ${EXERCISES[h.exercise].label} set`} className="inline-flex min-h-[32px] shrink-0 items-center px-1 f-muted hover:text-white" onClick={() => void deleteFormSet(h.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="f-card space-y-2" data-testid="coach-feedback">
        <div className="flex items-center justify-between">
          <h3 className="f-h">Rep feedback</h3>
          {reps.length > 0 && (
            <button type="button" className="text-[11px] font-semibold f-accent hover:underline" onClick={exportReps}>
              Export CSV
            </button>
          )}
        </div>
        {reps.length === 0 ? (
          <p className="f-small">Reps appear here with depth and bar-path notes. “Bar” is tracked from your wrists, so hold the bar or your hands steady in view.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...reps].reverse().slice(0, 6).map((r, i) => (
              <li key={reps.length - i} className="flex gap-2 text-xs">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: QUALITY_COLOR[r.quality] }} />
                <span>
                  <strong>{r.kind === 'rep' ? `Rep ${r.n}` : 'Partial rep'}</strong> · {Math.round(r.minAngle)}° · {(r.durationMs / 1000).toFixed(1)}s
                  <span className="block f-muted">{r.notes.join(' ')}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {last && <span className="sr-only" aria-live="polite">{`Rep ${last.n}: ${last.notes.join(' ')}`}</span>}
        <p className="f-small">Feedback is a guide from a single 2D camera angle, not a substitute for a coach. Stop if something hurts.</p>
      </section>
    </div>
  );
}
