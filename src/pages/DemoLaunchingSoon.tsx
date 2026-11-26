import { useEffect, useState } from 'react';
import { Check, Lock, Mail } from 'lucide-react';
import PreviewSlider from '../components/hub/PreviewSlider';
import { CAPABILITIES } from '../data/demoPreview';
import { DEMO_PREVIEW_CONFIGURED, tryUnlockDemo } from '../utils/demoGate';
import { CONTACT_EMAIL } from '../utils/site';

/**
 * What visitors to /demo see until the CV Auto-Labeler launches: what it can do so far, with real
 * before/after examples. It does not load the demo itself, the model or the runtime.
 */
export default function DemoLaunchingSoon() {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep this page out of search results while the demo is not public.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    const previous = document.title;
    document.title = 'CV Auto-Labeler: Launching Soon';
    return () => {
      meta.remove();
      document.title = previous;
    };
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await tryUnlockDemo(phrase);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600)); // a small delay makes guessing tedious
      setError('That passphrase is not right.');
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12 sm:px-6 lg:px-8" data-testid="demo-launching-soon">
      <header className="space-y-4">
        <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">Launching Soon</span>
        <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
          The CV Auto-Labeler is <span className="text-[#32FF00]">launching soon</span>
        </h1>
        <p className="max-w-2xl text-base text-neutral-400" data-testid="demo-soon-pitch">
          Label images and video with an object detector that runs on your own device, then export training data. The public version is not open yet; here is what it can already do.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('CV Auto-Labeler: launch updates')}&body=${encodeURIComponent('Please let me know when the CV Auto-Labeler launches.')}`}
            className="btn-lime inline-flex min-h-[46px] items-center gap-2 rounded-xl px-5 text-sm font-bold"
            data-testid="demo-soon-notify"
          >
            <Mail className="h-4 w-4" /> Get launch updates
          </a>
          <span className="text-[11px] text-neutral-500">Opens a pre-filled email in your mail app; nothing is sent from this page.</span>
        </div>
      </header>

      <section className="space-y-6" aria-labelledby="sofar">
        <h2 id="sofar" className="font-display text-xl font-bold text-white">
          What it can do so far
        </h2>
        <PreviewSlider />
        <div className="grid gap-4 sm:grid-cols-2" data-testid="demo-capabilities">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-2xl border border-[#16213E] bg-[#16213E]/30 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Check className="h-4 w-4 text-[#32FF00]" /> {c.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {DEMO_PREVIEW_CONFIGURED && (
        <div className="text-center">
          {!ownerOpen ? (
            <button type="button" className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300" onClick={() => setOwnerOpen(true)} data-testid="demo-owner-toggle">
              <Lock className="h-3 w-3" /> Owner access
            </button>
          ) : (
            <form onSubmit={unlock} className="mx-auto flex max-w-xs gap-2" data-testid="demo-owner-form">
              <input
                className="min-h-[40px] w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none"
                type="password"
                autoComplete="off"
                autoFocus
                placeholder="Preview passphrase"
                aria-label="Preview passphrase"
                value={phrase}
                onChange={(e) => {
                  setPhrase(e.target.value);
                  setError('');
                }}
                data-testid="demo-owner-input"
              />
              <button type="submit" className="min-h-[40px] rounded-lg border border-neutral-700 px-4 text-sm font-semibold text-neutral-200 hover:border-neutral-500 disabled:opacity-40" disabled={!phrase.trim() || busy} data-testid="demo-owner-submit">
                Unlock
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-1 text-[11px] text-rose-300" data-testid="demo-owner-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
