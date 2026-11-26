import { Link, Outlet } from 'react-router-dom';
import EngineeredBy from './EngineeredBy';

/**
 * The shell for a standalone spoke site (the CV Auto-Labeler on its own domain):
 * no portfolio navigation, just the tool, a privacy link and the one credit.
 */
export default function SpokeLayout({ title }: { title: string }) {
  return (
    <>
      <header className="border-b border-[#16213E] bg-[#0F1419]/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="font-display text-base font-bold tracking-tight text-white" data-testid="spoke-title">
            {title}
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[#16213E] py-5 text-center text-[#888888]">
        <div className="flex flex-col items-center gap-1.5">
          <EngineeredBy />
          <Link to="/privacy" className="text-[11px] opacity-70 hover:opacity-100 hover:underline" data-testid="spoke-privacy">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  );
}
