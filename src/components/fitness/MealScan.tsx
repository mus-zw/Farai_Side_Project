import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, ScanLine, ShieldCheck, X } from 'lucide-react';
import { useConsent } from '../ConsentProvider';
import { DEFAULT_MODEL_CONFIG } from '../../utils/browserModels';
import { looksOffline } from '../../utils/offline';
import { MealDraft, SCAN_CONFIDENCE, describeItems, draftFromDetections } from '../../utils/mealScan';

/** A photo larger than this is refused before it is decoded. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

interface Props {
  /** Called with the estimate once a photo has been read; the caller shows it for editing. */
  onDraft: (draft: MealDraft) => void;
}

type Phase = 'idle' | 'camera' | 'working';

function cameraErrorMessage(err: unknown): string {
  switch ((err as { name?: string })?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings, or choose a photo instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. You can choose a photo instead.';
    case 'NotReadableError':
      return 'The camera is in use by another app. Close it and try again, or choose a photo instead.';
    default:
      return `Could not open the camera (${(err as { message?: string })?.message || 'unknown error'}). You can choose a photo instead.`;
  }
}

function scanErrorMessage(err: unknown): string {
  const msg = (err as { message?: string })?.message || String(err);
  if (looksOffline(err)) return 'You are offline, and the on-device detector has not been downloaded on this device yet. Connect once to download it (about 40 MB); after that photo scanning works offline. Or add the meal by hand.';
  if (/missing on this host|returned a web page/i.test(msg)) {
    return 'Photo scanning needs the on-device detector, which is not available on this site. Add the meal by hand.';
  }
  if (/ONNX Runtime/i.test(msg)) return 'The on-device detector could not start in this browser. Add the meal by hand.';
  return `Could not scan that photo (${msg}). Add the meal by hand.`;
}

/**
 * Scan a meal: take a photo or pick one, and get an editable estimate. The image is read in this
 * browser only. It is never uploaded or written to storage, nothing keeps it after the estimate, and
 * only the meal details the person confirms are saved. The camera runs only after a tap, stops the
 * moment a photo is taken, and is released if the panel closes, the tab hides or the page unmounts.
 */
export default function MealScan({ onDraft }: Props) {
  const { ensure } = useConsent();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [phaseText, setPhaseText] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ found: string; hints: string[] } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);

  /** Release the camera and clear the preview. Safe to call at any time, any number of times. */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
  }, []);

  // Leaving the page, or the tab going to the background, must release the camera.
  useEffect(() => {
    mounted.current = true;
    const release = () => {
      stopCamera();
      if (mounted.current) setPhase((p) => (p === 'camera' ? 'idle' : p));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', release);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', release);
      stopCamera();
    };
  }, [stopCamera]);

  // Show the live preview once the <video> exists.
  useEffect(() => {
    const v = videoRef.current;
    if (phase === 'camera' && v && streamRef.current) {
      v.srcObject = streamRef.current;
      v.muted = true;
      void v.play().catch(() => undefined);
    }
  }, [phase]);

  const close = () => {
    stopCamera();
    setPhase('idle');
    setPhaseText('');
    setError('');
    setSummary(null);
    setOpen(false);
  };

  /** Run the detector on an in-memory image, hand back a draft, then discard the image. */
  const analyse = async (source: CanvasImageSource, width: number, height: number, release: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setPhase('working');
    setError('');
    setSummary(null);
    try {
      const { setActiveBrowserModel, loadBrowserModel, detectFrameInBrowser } = await import('../../services/browserInference');
      setActiveBrowserModel(DEFAULT_MODEL_CONFIG); // the general (COCO) model, whatever the demo last picked
      await loadBrowserModel(setPhaseText, DEFAULT_MODEL_CONFIG);
      setPhaseText('Reading the photo…');
      const result = await detectFrameInBrowser(source, width, height, SCAN_CONFIDENCE);
      if (!mounted.current) return;
      const draft = draftFromDetections(result.detections.map((d) => ({ className: d.className, confidence: d.score })));
      setSummary({ found: draft.items.length ? describeItems(draft.items) : '', hints: draft.hints });
      onDraft(draft);
    } catch (err) {
      if (mounted.current) setError(scanErrorMessage(err));
    } finally {
      release(); // the pixels are dropped here, whatever happened
      busy.current = false;
      if (mounted.current) {
        setPhase('idle');
        setPhaseText('');
      }
    }
  };

  const startCamera = async () => {
    setError('');
    setSummary(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open a camera here (it needs a secure https page). Choose a photo instead.');
      return;
    }
    if (!(await ensure('local'))) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPhase('camera');
    } catch (err) {
      setError(cameraErrorMessage(err));
    }
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError('The camera is not ready yet. Wait a moment and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    stopCamera(); // the camera is off as soon as the frame is taken
    await analyse(canvas, canvas.width, canvas.height, () => {
      canvas.width = 0; // frees the pixels
      canvas.height = 0;
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // do not keep a reference to the chosen file
    if (!file) return;
    setSummary(null);
    if (!file.type.startsWith('image/')) {
      setError(`"${file.name}" is not an image. Choose a JPEG or PNG photo.`);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`That photo is ${(file.size / 1048576).toFixed(0)} MB; the limit is ${MAX_PHOTO_BYTES / 1048576} MB.`);
      return;
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      setError('That photo could not be read. Try a JPEG or PNG.');
      return;
    }
    await analyse(bitmap, bitmap.width, bitmap.height, () => bitmap.close());
  };

  if (!open) {
    return (
      <button type="button" className="f-btn" data-testid="scan-open" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>
        <ScanLine className="h-4 w-4" aria-hidden="true" /> Scan a meal
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="scan-panel">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">Scan a meal</h3>
        <button type="button" aria-label="Close meal scan" data-testid="scan-close" className="flex h-9 w-9 items-center justify-center f-muted hover:text-white" onClick={close}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="flex items-start gap-2 text-xs" data-testid="scan-privacy">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 f-accent" aria-hidden="true" />
        <span>
          <strong>Your photo stays on this device.</strong> It is read in your browser, never uploaded, and discarded as soon as the estimate is made. Only the meal details you confirm are saved. The camera only runs while you are taking the photo.
        </span>
      </p>

      {phase === 'camera' && (
        <div className="space-y-2">
          <video ref={videoRef} muted playsInline className="w-full rounded-lg bg-black" style={{ maxHeight: 320 }} data-testid="scan-video" aria-label="Camera preview" />
          <div className="flex gap-2">
            <button type="button" className="f-btn-primary" data-testid="scan-capture" style={{ minHeight: 44 }} onClick={() => void capture()}>
              <Camera className="h-4 w-4" aria-hidden="true" /> Take photo
            </button>
            <button
              type="button"
              className="f-btn"
              data-testid="scan-cancel-camera"
              style={{ minHeight: 44 }}
              onClick={() => {
                stopCamera();
                setPhase('idle');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="f-btn-primary" data-testid="scan-camera" style={{ minHeight: 44 }} onClick={() => void startCamera()}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Use camera
          </button>
          <button type="button" className="f-btn" data-testid="scan-upload" style={{ minHeight: 44 }} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Choose photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Choose a meal photo" data-testid="scan-file" onChange={(e) => void onFile(e)} />
        </div>
      )}

      {phase === 'working' && (
        <p className="f-small" role="status" data-testid="scan-working">
          {phaseText || 'Starting…'} <span className="f-muted">(the first scan downloads the on-device detector, about 40 MB)</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="scan-error">
          {error}
        </p>
      )}

      {summary && phase === 'idle' && (
        <div className="space-y-1 text-xs" role="status" data-testid="scan-summary">
          {summary.found && (
            <p>
              <strong>Found:</strong> {summary.found}
            </p>
          )}
          {summary.hints.map((h) => (
            <p key={h} className="f-small">
              {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
