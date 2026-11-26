import { Suspense } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Home, CalendarCheck, Dumbbell, LineChart, UserRound } from 'lucide-react';
import { FitnessProvider, useFitness } from './FitnessProvider';
import { FitnessAuthProvider, useFitnessAuth } from './FitnessAuthProvider';
import RestTimerBar from './RestTimerBar';
import UndoBar from './UndoBar';
import Onboarding from './Onboarding';
import SiteLink from '../SiteLink';
import { isStandalone, linkTo } from '../../utils/site';
import { fitnessStatus } from '../../utils/entitlements';
import { useEntitlements } from '../../utils/useEntitlements';

const TABS = [
  { to: '/fitness', label: 'Today', Icon: CalendarCheck, end: true },
  { to: '/fitness/progress', label: 'Progress', Icon: LineChart, end: false },
  { to: '/fitness/profile', label: 'Profile', Icon: UserRound, end: false },
] as const;

const TITLES: Record<string, string> = {
  '/fitness': 'Today',
  '/fitness/progress': 'Progress',
  '/fitness/profile': 'Profile',
};

/** One-click Portfolio, the current view, and the active athlete. */
function AppBar() {
  const { athlete } = useFitness();
  const { pathname } = useLocation();
  const pro = fitnessStatus(useEntitlements()).active;
  const { status: authStatus, sync, user } = useFitnessAuth();
  const title = TITLES[pathname.replace(/\/+$/, '') || '/fitness'] ?? 'Fitness';
  // A standalone fitness site with no hub URL configured has no portfolio to go back to.
  const hub = linkTo('hub');
  const hasHub = !isStandalone || hub.external;

  return (
    <header className="f-top">
      {hasHub ? (
        <SiteLink to={hub} className="f-btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }} data-testid="back-to-portfolio" aria-label="Back to the portfolio home page">
          <Home className="h-4 w-4" /> Portfolio
        </SiteLink>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold f-muted" data-testid="brand-mark">
          <Dumbbell className="h-4 w-4 f-accent" /> Fitness
        </span>
      )}
      <h1 className="f-title" data-testid="view-title">
        {title}
      </h1>
      {athlete ? (
        <Link to="/fitness/profile" className="f-athlete" data-testid="athlete-chip" aria-label={`Athlete profile: ${athlete.name}${athlete.mode === 'guest' ? ' (guest)' : ''}`}>
          <span className="f-avatar" aria-hidden="true">
            {athlete.name.charAt(0).toUpperCase()}
          </span>
          {athlete.mode === 'guest' ? <span className="f-guesttag">Guest</span> : <span className="f-athlete-name">{athlete.name}</span>}
          {pro && <span className="f-guesttag" style={{ color: 'var(--f-accent)', borderColor: 'var(--f-accent)' }} data-testid="pro-badge">Pro</span>}
          {authStatus === 'signedIn' && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: sync.phase === 'error' ? 'var(--f-bad)' : sync.phase === 'syncing' ? 'var(--f-gold)' : 'var(--f-good)' }}
              title={`Cloud sync: ${user?.email ?? 'signed in'} (${sync.phase})`}
              data-testid="sync-dot"
              data-phase={sync.phase}
            />
          )}
        </Link>
      ) : (
        <span />
      )}
    </header>
  );
}

function Shell() {
  const { status, error, seeded, athlete } = useFitness();
  const ready = status === 'ready' && athlete !== undefined;
  const onboarding = status === 'ready' && athlete === null;

  return (
    <div className="f-root">
      {!onboarding && <AppBar />}
      {seeded && !onboarding && (
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-3 px-4 pt-3 text-[11px]" data-testid="sample-banner">
          <span className="f-muted">Showing sample data.</span>
          <Link to="/fitness/profile" className="inline-flex min-h-[32px] items-center font-bold f-accent hover:underline" data-testid="sample-pill">
            Start fresh or reset
          </Link>
        </div>
      )}

      <main className="f-main">
        {(status === 'loading' || (status === 'ready' && athlete === undefined)) && <p className="f-small" data-testid="fitness-loading">Opening your training log…</p>}
        {status === 'error' && (
          <div className="f-card" role="alert" data-testid="fitness-db-error">
            <h2 className="f-h">Storage is not available</h2>
            <p className="f-small mt-1">
              This page keeps your training log in your browser's IndexedDB, which is blocked or unavailable here (private
              browsing and some privacy settings do this). Try a normal window, or allow site data for this page.
            </p>
            <p className="f-small mt-2">Details: {error}</p>
          </div>
        )}
        {onboarding && <Onboarding />}
        {ready && athlete && (
          <Suspense fallback={<p className="f-small">Loading…</p>}>
            <Outlet />
          </Suspense>
        )}
      </main>

      {ready && athlete && (
        <>
          <RestTimerBar />
          <UndoBar />
          <nav className="f-bottomnav" aria-label="Fitness navigation">
            {TABS.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="f-nav-item" data-testid={`tab-${label.toLowerCase()}`}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

/** The standalone fitness app shell: its own theme, app bar and dock, and a one-click way back to the portfolio. */
export default function FitnessLayout({ onNotify }: { onNotify: (type: 'success' | 'error' | 'info', message: string) => void }) {
  return (
    <div data-theme="fitness">
      <FitnessProvider notify={onNotify}>
        <FitnessAuthProvider>
          <Shell />
        </FitnessAuthProvider>
      </FitnessProvider>
    </div>
  );
}
