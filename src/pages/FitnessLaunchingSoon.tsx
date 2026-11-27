import { useEffect, useState } from 'react';
import { Dumbbell, Utensils, ScanLine, ArrowLeft, Mail, Lock } from 'lucide-react';
import SiteLink from '../components/SiteLink';
import EngineeredBy from '../components/EngineeredBy';
import { PREVIEW_CONFIGURED, tryUnlock } from '../utils/fitnessGate';
import { useDemoGate } from '../utils/demoGate';
import { CONTACT_EMAIL, isStandalone, linkTo } from '../utils/site';

const FEATURES = [
  { Icon: Dumbbell, title: 'Push / Pull / Legs, logged properly', body: 'A fast set-by-set logger with last-time prefill, warm-up and drop sets, and a rest timer that keeps up with you.' },
  { Icon: Utensils, title: 'Nutrition and trend weight', body: 'Calories, protein and meals against your targets, plus a trend line and a calorie target that adapts to what your body actually does.' },
  { Icon: ScanLine, title: 'An AI Form Coach that stays on your device', body: 'Rep counting, depth and bar-path feedback from your camera. Your video never leaves your phone.' },
] as const;

/**
 * What visitors to a (possibly old, shared) /fitness link see until the app launches. It does not
 * load the app, its database or any sign-in code.
 */
export default function FitnessLaunchingSoon() {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const demoLocked = useDemoGate().badge; // no point offering a demo that is also Launching Soon
  const hub = linkTo('hub');
  const lab = linkTo('lab');
  const showHub = !isStandalone || hub.external;

  // Keep this page out of search results while the app is not public.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    const previous = document.title;
    document.title = 'Fitness Hub: Launching Soon';
    return () => {
      meta.remove();
      document.title = previous;
    };
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await tryUnlock(phrase);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600)); // a small delay makes guessing tedious
      setError('That passphrase is not right.');
    }
    setBusy(false);
  };

  return (
    <div data-theme="fitness" data-testid="fitness-launching-soon">
      <div className="f-root">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8" style={{ minHeight: '100dvh' }}>
          <header className="flex items-center justify-between">
            {showHub ? (
              <SiteLink to={hub} className="f-btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }} data-testid="soon-portfolio">
                <ArrowLeft className="h-4 w-4" /> Portfolio
              </SiteLink>
            ) : (
              <span />
            )}
            <span className="f-guesttag" style={{ color: 'var(--f-gold)', borderColor: 'var(--f-gold)' }}>
              Launching Soon
            </span>
          </header>

          <main className="flex flex-1 flex-col justify-center py-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--f-accent-soft)', color: 'var(--f-accent)' }}>
              <Dumbbell className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
              Fitness Hub is <span className="f-accent">launching soon</span>
            </h1>
            <p className="mt-3 max-w-xl text-base f-muted" data-testid="soon-pitch">
              Training, nutrition and an on-device AI Form Coach in one private app. We are putting the finishing touches on it and it is not open to the public yet.
            </p>

            <ul className="mt-8 space-y-3">
              {FEATURES.map(({ Icon, title, body }) => (
                <li key={title} className="f-card flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 f-accent" />
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <p className="f-small mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Fitness Hub: launch updates')}&body=${encodeURIComponent('Please let me know when the Fitness app launches.')}`} className="f-btn-primary" style={{ minHeight: 46, padding: '0 20px' }} data-testid="soon-notify">
                <Mail className="h-4 w-4" /> Get launch updates
              </a>
              {(!isStandalone || lab.external) && !demoLocked && (
                <SiteLink to={lab} className="f-btn" style={{ minHeight: 46 }} data-testid="soon-lab">
                  Try the CV Auto-Labeler meanwhile
                </SiteLink>
              )}
            </div>
            <p className="f-small mt-2">The button opens a pre-filled email in your mail app; nothing is sent from this page.</p>
          </main>

          <footer className="space-y-3 pb-2 text-center">
            {PREVIEW_CONFIGURED && (
              <div>
                {!ownerOpen ? (
                  <button type="button" className="inline-flex items-center gap-1 text-[11px] f-muted opacity-60 hover:opacity-100" onClick={() => setOwnerOpen(true)} data-testid="owner-access-toggle">
                    <Lock className="h-3 w-3" /> Owner access
                  </button>
                ) : (
                  <form onSubmit={unlock} className="mx-auto flex max-w-xs gap-2" data-testid="owner-access-form">
                    <input className="f-input" type="password" autoComplete="off" autoFocus placeholder="Preview passphrase" aria-label="Preview passphrase" value={phrase} onChange={(e) => { setPhrase(e.target.value); setError(''); }} data-testid="owner-access-input" />
                    <button type="submit" className="f-btn" disabled={!phrase.trim() || busy} data-testid="owner-access-submit">
                      Unlock
                    </button>
                  </form>
                )}
                {error && (
                  <p role="alert" className="mt-1 text-[11px]" style={{ color: 'var(--f-bad)' }} data-testid="owner-access-error">
                    {error}
                  </p>
                )}
              </div>
            )}
            <EngineeredBy className="f-muted" />
          </footer>
        </div>
      </div>
    </div>
  );
}
