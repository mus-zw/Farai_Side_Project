import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { CONSENT_KEY, ConsentKind, ConsentRecord, grantConsent, hasConsent, parseConsent } from '../utils/consent';

interface EnsureOptions {
  /** For the upload scope: where the video will be sent, shown to the visitor. */
  uploadHost?: string;
}

interface ConsentContextValue {
  record: ConsentRecord | null;
  /** Resolves true if the visitor has consented (now or earlier) to this kind of processing. */
  ensure: (kind: ConsentKind, options?: EnsureOptions) => Promise<boolean>;
  revoke: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readRecord(): ConsentRecord | null {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

interface Pending {
  kind: ConsentKind;
  options: EnsureOptions;
  resolve: (ok: boolean) => void;
}

/**
 * One pre-camera consent dialog for the whole site. Anything that is about to
 * start a camera or analyse a video calls `ensure()` first; it resolves false if
 * the visitor declines, and the feature simply does not start.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<ConsentRecord | null>(readRecord);
  const [pending, setPending] = useState<Pending | null>(null);
  const recordRef = useRef(record);
  recordRef.current = record;

  const persist = useCallback((next: ConsentRecord | null) => {
    setRecord(next);
    try {
      if (next) localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
      else localStorage.removeItem(CONSENT_KEY);
    } catch {
      // Storage blocked: consent holds for this page view only.
    }
  }, []);

  const ensure = useCallback((kind: ConsentKind, options: EnsureOptions = {}) => {
    if (hasConsent(recordRef.current, kind)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        prev?.resolve(false); // a newer request replaces an unanswered one
        return { kind, options, resolve };
      });
    });
  }, []);

  const revoke = useCallback(() => persist(null), [persist]);

  // Another tab accepted or withdrew.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) setRecord(parseConsent(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const answer = (ok: boolean) => {
    if (!pending) return;
    if (ok) persist(grantConsent(recordRef.current, pending.kind));
    pending.resolve(ok);
    setPending(null);
  };

  const value = useMemo(() => ({ record, ensure, revoke }), [record, ensure, revoke]);
  return (
    <ConsentContext.Provider value={value}>
      {children}
      {pending && <ConsentDialog pending={pending} onAnswer={answer} />}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside <ConsentProvider>.');
  return ctx;
}

function ConsentDialog({ pending, onAnswer }: { pending: Pending; onAnswer: (ok: boolean) => void }) {
  const upload = pending.kind === 'upload';
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnswer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" data-testid="consent-modal">
      <div className="absolute inset-0 bg-black/80" onClick={() => onAnswer(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-700 bg-[#0F1419] p-6 text-[#CCCCCC] shadow-2xl sm:rounded-2xl"
      >
        <button type="button" onClick={() => onAnswer(false)} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="h-5 w-5 text-[#32FF00]" />
          <h2 id="consent-title" className="text-lg font-bold">
            {upload ? 'Before this video is uploaded' : 'Before the camera or video starts'}
          </h2>
        </div>

        {upload ? (
          <ul className="mt-4 space-y-3 text-sm leading-relaxed" data-testid="consent-upload-text">
            <li>
              <strong className="text-white">This mode sends your video to a server.</strong> The file is uploaded to{' '}
              <code className="rounded bg-neutral-800 px-1 text-xs">{pending.options.uploadHost || 'the configured analysis server'}</code> and the detections come back. Switch to “In this browser” if you want nothing to leave your device.
            </li>
            <li>
              <strong className="text-white">What happens to it there is up to that server&apos;s operator.</strong> This site does not store your video, but the server may log or keep uploads. Do not upload anything sensitive.
            </li>
            <li>
              <strong className="text-white">Only upload video you have the right to share.</strong> If other people appear in it, you need their permission.
            </li>
          </ul>
        ) : (
          <ul className="mt-4 space-y-3 text-sm leading-relaxed" data-testid="consent-local-text">
            <li>
              <strong className="text-white">It all happens on your device.</strong> Video frames, the AI&apos;s working numbers (WebGPU tensors) and the body keypoints it finds are processed in your browser&apos;s memory. No video is uploaded, and nothing is stored on any server.
            </li>
            <li>
              <strong className="text-white">We don&apos;t keep your video.</strong> Frames are not written to your device&apos;s storage either; when you stop or leave, they are gone. A snapshot or export is only made if you press its button, and it goes straight to your downloads.
            </li>
            <li>
              <strong className="text-white">What is saved on your device:</strong> this consent choice and your own training logs and settings. Nothing that identifies you or your body.
            </li>
          </ul>
        )}

        <div className="mt-5 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#32FF00]" checked={age} onChange={(e) => setAge(e.target.checked)} data-testid="consent-age" />
            <span>I am 18 years old or older.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#32FF00]" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="consent-disclaimer" />
            <span>
              {upload
                ? 'I have the right to upload this video (including permission from anyone shown in it), and I understand the results are automated and may be wrong.'
                : 'I understand exercise carries a risk of injury, and that this software gives general guidance only: it is not medical advice or professional coaching, it can be wrong, and I use it at my own risk. I will stop if I feel pain and check with a doctor if unsure.'}
            </span>
          </label>
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          You can withdraw this any time from the{' '}
          <Link to="/privacy" onClick={() => onAnswer(false)} className="text-[#32FF00] underline-offset-2 hover:underline">
            privacy page
          </Link>{' '}
          or your Profile.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onAnswer(false)} className="min-h-[44px] rounded-xl border border-neutral-700 px-5 text-sm font-semibold text-neutral-200 hover:border-neutral-500" data-testid="consent-cancel">
            Not now
          </button>
          <button
            type="button"
            disabled={!age || !agree}
            onClick={() => onAnswer(true)}
            className="min-h-[44px] rounded-xl bg-[#32FF00] px-5 text-sm font-bold text-[#0F1419] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="consent-accept"
          >
            Agree &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
