import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFitnessAuth } from './FitnessAuthProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email/password and Google sign-in and sign-up for the fitness app. Renders nothing if cloud sync is not set up. */
export default function AuthPanel() {
  const { status, busy, error, notice, signUp, signIn, signInGoogle, resetPassword, clearMessages, backendKind } = useFitnessAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [f, setF] = useState({ email: '', password: '', name: '' });
  const [local, setLocal] = useState('');

  if (status === 'disabled' || status === 'signedIn') return null;

  const up = tab === 'signup';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocal('');
    if (!EMAIL_RE.test(f.email.trim())) return setLocal('Enter a valid email address.');
    if (f.password.length < (up ? 8 : 1)) return setLocal(up ? 'Choose a password of at least 8 characters.' : 'Enter your password.');
    const ok = up ? await signUp(f.email, f.password, f.name) : await signIn(f.email, f.password);
    if (ok) setF({ email: '', password: '', name: '' });
  };
  const forgot = async () => {
    setLocal('');
    if (!EMAIL_RE.test(f.email.trim())) return setLocal('Type your email first, then choose "Forgot password".');
    await resetPassword(f.email);
  };

  return (
    <div className="space-y-3" data-testid="auth-panel">
      {backendKind === 'mock' && (
        <p className="rounded-lg border border-dashed px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--f-gold)', color: 'var(--f-gold)' }} data-testid="auth-mock-banner">
          Development mock: accounts and cloud data are kept in this browser only. No real Firebase project is connected.
        </p>
      )}
      <div className="flex gap-1.5" role="tablist" aria-label="Sign in or create an account">
        {(['signin', 'signup'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} className="f-chip" data-testid={`auth-tab-${t}`} onClick={() => { setTab(t); setLocal(''); clearMessages(); }}>
            {t === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <button type="button" className="f-btn w-full" style={{ minHeight: 44 }} disabled={busy} data-testid="auth-google" onClick={() => void signInGoogle()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9a6.1 6.1 0 1 1 0-12.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.9H12z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-2 text-[11px] f-muted">
        <span className="h-px flex-1" style={{ background: 'var(--f-border)' }} /> or with email <span className="h-px flex-1" style={{ background: 'var(--f-border)' }} />
      </div>

      <form onSubmit={submit} className="space-y-2" noValidate>
        {up && <input className="f-input" placeholder="Your name (optional)" aria-label="Your name" maxLength={40} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="auth-name" />}
        <input className="f-input" type="email" placeholder="Email" aria-label="Email" autoComplete="email" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="auth-email" />
        <input className="f-input" type="password" placeholder={up ? 'Password (8+ characters)' : 'Password'} aria-label="Password" autoComplete={up ? 'new-password' : 'current-password'} maxLength={128} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="auth-password" />
        <button type="submit" className="f-btn-primary w-full" style={{ minHeight: 44 }} disabled={busy} data-testid="auth-submit">
          {busy ? 'One moment…' : up ? 'Create account' : 'Sign in'}
        </button>
        {!up && (
          <button type="button" className="inline-flex min-h-[32px] items-center text-[11px] font-semibold f-accent hover:underline" onClick={() => void forgot()} data-testid="auth-forgot">
            Forgot password?
          </button>
        )}
      </form>

      {(local || error) && (
        <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="auth-error">
          {local || error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs" style={{ color: 'var(--f-good)' }} data-testid="auth-notice">
          {notice}
        </p>
      )}
      <p className="f-small">
        An account syncs your fitness data (profile, plan, workouts and sets, meals, weigh-ins) to your private cloud area so you can use another device. Camera frames, video and body data are never uploaded, and sample data is never synced.{' '}
        <Link to="/privacy" className="f-accent hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}
