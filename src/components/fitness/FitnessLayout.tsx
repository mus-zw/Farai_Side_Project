import { NavLink, Link, Outlet } from 'react-router-dom';
import { Home, Dumbbell, Utensils, LineChart, ScanLine, Settings2, ScanSearch } from 'lucide-react';
import { FitnessProvider, useFitness } from './FitnessProvider';
import RestTimerBar from './RestTimerBar';

const TABS = [
  { to: '/fitness', label: 'Train', Icon: Dumbbell, end: true },
  { to: '/fitness/nutrition', label: 'Nutrition', Icon: Utensils, end: false },
  { to: '/fitness/progress', label: 'Progress', Icon: LineChart, end: false },
  { to: '/fitness/coach', label: 'Coach', Icon: ScanLine, end: false },
  { to: '/fitness/more', label: 'More', Icon: Settings2, end: false },
] as const;

function Shell() {
  const { status, error, seeded } = useFitness();
  return (
    <div className="f-root">
      <header className="f-top">
        <Link to="/" className="f-btn" style={{ minHeight: 34, padding: '0 11px', fontSize: 12 }} data-testid="back-to-portfolio" aria-label="Back to the portfolio home page">
          <Home className="h-4 w-4" /> Portfolio
        </Link>
        <span className="flex items-center gap-2 text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <Dumbbell className="h-4 w-4 f-accent" /> Fitness
        </span>
        <Link to="/demo" className="f-btn" style={{ minHeight: 34, padding: '0 11px', fontSize: 12 }} data-testid="to-demo" aria-label="Open the computer vision demo">
          <ScanSearch className="h-4 w-4" /> CV Demo
        </Link>
      </header>
      {seeded && (
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-3 px-4 pt-3 text-[11px]" data-testid="sample-banner">
          <span className="f-muted">Showing sample data.</span>
          <Link to="/fitness/more" className="font-bold f-accent hover:underline" data-testid="sample-pill">
            Start fresh or reset
          </Link>
        </div>
      )}

      <main className="f-main">
        {status === 'loading' && <p className="f-small" data-testid="fitness-loading">Opening your training log…</p>}
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
        {status === 'ready' && <Outlet />}
      </main>

      <RestTimerBar />

      <nav className="f-bottomnav" aria-label="Fitness navigation">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="f-nav-item" data-testid={`tab-${label.toLowerCase()}`}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** The isolated fitness shell: its own theme, a bottom tab bar, and a link back to the portfolio. */
export default function FitnessLayout({ onNotify }: { onNotify: (type: 'success' | 'error' | 'info', message: string) => void }) {
  return (
    <div data-theme="fitness">
      <FitnessProvider notify={onNotify}>
        <Shell />
      </FitnessProvider>
    </div>
  );
}
