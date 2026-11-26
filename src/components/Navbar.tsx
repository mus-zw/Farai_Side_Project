import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, Terminal, Mail } from 'lucide-react';
import { useDemoGate } from '../utils/demoGate';
import { useFitnessGate } from '../utils/fitnessGate';

interface NavItem {
  name: string;
  /** Route, optionally with a #section. */
  to: string;
}

/**
 * The portfolio header. It only lists places a visitor can actually go: the Demo and Fitness links are
 * left out while those products are "Launching soon" (their pages stay reachable from the Projects
 * section) and appear on their own once they launch, or for the owner with a preview unlocked.
 */
export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const demoLocked = useDemoGate().badge;
  const fitnessLocked = useFitnessGate().badge;

  const navLinks: NavItem[] = [
    { name: 'Home', to: '/home' },
    { name: 'Projects', to: '/home#projects' },
    ...(demoLocked ? [] : [{ name: 'Demo', to: '/demo' }]),
    ...(fitnessLocked ? [] : [{ name: 'Fitness', to: '/fitness' }]),
    { name: 'About', to: '/about' },
    { name: 'Contact', to: '/contact' },
  ];

  // The main button never leads to a "coming soon" page: while the demo is locked it invites contact instead.
  const cta = demoLocked
    ? { to: '/home#work-with-me', label: 'Work with me', Icon: Mail }
    : { to: '/demo', label: 'Launch CV Demo', Icon: Sparkles };

  const onHome = location.pathname === '/' || location.pathname === '/home';
  const isActive = (item: NavItem): boolean => {
    if (item.to === '/home') return onHome && !location.hash;
    if (item.to === '/home#projects') return onHome && location.hash === '#projects';
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  };

  // Close the mobile drawer on route or hash changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const scrollTopIfHere = (item: NavItem) => {
    if (item.to === '/home' && onHome) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#16213E] bg-[#0F1419]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            to="/home"
            onClick={() => onHome && window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex shrink-0 items-center gap-2.5 py-2 font-display text-lg font-bold tracking-tight text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#32FF00]/40 bg-[#32FF00]/10 text-[#32FF00] transition-all group-hover:bg-[#32FF00] group-hover:text-[#0F1419]">
              <Terminal className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-base transition-colors group-hover:text-[#32FF00] sm:text-lg">Farai Bodias Musariri</span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main Navigation" className="hidden items-center gap-7 text-sm font-medium md:flex">
            {navLinks.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => scrollTopIfHere(item)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative whitespace-nowrap py-2 transition-colors duration-200 ${active ? 'font-semibold text-white' : 'text-[#CCCCCC] hover:text-white'}`}
                >
                  {item.name}
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#32FF00]" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to={cta.to}
              data-testid="nav-cta"
              className="btn-solid hidden min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm md:inline-flex"
            >
              <cta.Icon className="h-4 w-4" aria-hidden="true" />
              {cta.label}
            </Link>

            {/* Mobile menu trigger */}
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-[#16213E] bg-[#16213E]/50 text-[#CCCCCC] hover:border-[#32FF00]/40 hover:text-white md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="relative z-50 border-b border-[#16213E] bg-[#0F1419] px-4 pb-6 pt-3 md:hidden">
            <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1">
              {navLinks.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                      active ? 'border-l-2 border-[#32FF00] bg-[#16213E] font-semibold text-white' : 'text-[#CCCCCC] hover:bg-[#16213E]/60 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4">
                <Link to={cta.to} onClick={() => setMobileMenuOpen(false)} className="btn-solid flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm">
                  <cta.Icon className="h-4 w-4" aria-hidden="true" />
                  {cta.label}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop for the mobile drawer */}
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden" aria-hidden="true" />}
    </>
  );
}
