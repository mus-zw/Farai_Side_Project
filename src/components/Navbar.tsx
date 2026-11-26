import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, Terminal, Dumbbell, UserCircle2 } from 'lucide-react';
import { useProfile } from './ProfileProvider';
import { InterestId, orderByInterests } from '../utils/interests';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { profile, openProfile } = useProfile();

  // Home first, then Demo and Fitness with the visitor's interests on top, then About and Contact.
  const interestLinks: { name: string; path: string; interest?: InterestId }[] = orderByInterests(
    [
      { name: 'Demo', path: '/demo', interest: 'cv' as InterestId },
      { name: 'Fitness', path: '/fitness', interest: 'fitness' as InterestId },
    ],
    profile.interests
  );
  const navLinks = [
    { name: 'Home', path: '/home' },
    ...interestLinks,
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];
  // The big button points at the first interest picked (the CV demo by default).
  const cta =
    profile.interests[0] === 'fitness'
      ? { to: '/fitness', label: 'Open Fitness', Icon: Dumbbell }
      : { to: '/demo', label: 'Launch CV Demo', Icon: Sparkles };
  const initial = profile.signedIn ? profile.name.charAt(0).toUpperCase() : '';

  // Helper to determine if Home link should be active when user visits '/'
  const isLinkActive = (path: string, routerIsActive: boolean) => {
    if (path === '/home' && (location.pathname === '/' || location.pathname === '/home')) {
      return !location.hash;
    }
    return routerIsActive;
  };

  // Close mobile drawer on route or hash changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#16213E] bg-[#0F1419]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Wordmark / Logo */}
          <Link
            to="/home"
            onClick={() => {
              if (location.pathname === '/home' || location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="group flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white py-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#32FF00]/10 border border-[#32FF00]/40 text-[#32FF00] group-hover:bg-[#32FF00] group-hover:text-[#0F1419] transition-all">
              <Terminal className="h-4 w-4" />
            </span>
            <span className="text-white group-hover:text-[#32FF00] transition-colors">
              Farai Bodias Musariri
            </span>
          </Link>

          {/* Desktop Navigation using React Router's NavLink */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => {
                  if (
                    location.pathname === link.path ||
                    (link.path === '/home' && location.pathname === '/')
                  ) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={({ isActive }) => {
                  const active = isLinkActive(link.path, isActive);
                  return `transition-colors duration-200 relative py-2 ${
                    active
                      ? 'text-[#32FF00] font-semibold'
                      : 'text-[#CCCCCC] hover:text-white'
                  }`;
                }}
              >
                {({ isActive }) => {
                  const active = isLinkActive(link.path, isActive);
                  return (
                    <>
                      <span>{link.name}</span>
                      {active && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#32FF00] rounded-full shadow-[0_0_8px_#32FF00]" />
                      )}
                    </>
                  );
                }}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
          {/* Primary Action Button */}
          <div className="hidden md:flex items-center gap-4">
            <NavLink
              to={cta.to}
              data-testid="nav-cta"
              className="btn-lime min-h-[40px] flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-[0_0_15px_rgba(50,255,0,0.3)] transition-all active:scale-95"
            >
              <cta.Icon className="h-3.5 w-3.5 fill-current" />
              <span>{cta.label}</span>
            </NavLink>
          </div>

          {/* Account / interests */}
          <button
            type="button"
            data-testid="account-button"
            onClick={openProfile}
            aria-label={profile.signedIn ? `Profile: ${profile.name}` : 'Sign in or set interests'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 rounded-lg border border-[#16213E] bg-[#16213E]/50 px-2 text-[#CCCCCC] hover:text-[#32FF00] hover:border-[#32FF00]/40 cursor-pointer"
          >
            {initial ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#32FF00] text-xs font-bold text-[#0F1419]">{initial}</span>
            ) : (
              <UserCircle2 className="h-5 w-5" />
            )}
          </button>

          {/* Mobile menu trigger */}
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#16213E] bg-[#16213E]/50 text-[#CCCCCC] hover:text-[#32FF00] hover:border-[#32FF00]/40 md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          </div>
        </div>

        {/* Mobile Drawer using React Router's NavLink */}
        {mobileMenuOpen && (
          <div className="border-b border-[#16213E] bg-[#0F1419] px-4 pt-3 pb-6 md:hidden animate-in fade-in slide-in-from-top-2 relative z-50">
            <nav aria-label="Mobile Navigation" className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => {
                    const active = isLinkActive(link.path, isActive);
                    return `min-h-[44px] w-full flex items-center justify-between px-3 py-2 text-base font-medium rounded-lg transition-colors ${
                      active
                        ? 'bg-[#16213E] text-[#32FF00] font-semibold border-l-2 border-[#32FF00]'
                        : 'text-[#CCCCCC] hover:bg-[#16213E]/60 hover:text-white'
                    }`;
                  }}
                >
                  {({ isActive }) => {
                    const active = isLinkActive(link.path, isActive);
                    return (
                      <>
                        <span>{link.name}</span>
                        {active && <span className="h-2 w-2 rounded-full bg-[#32FF00]" />}
                      </>
                    );
                  }}
                </NavLink>
              ))}
              <div className="pt-4">
                <NavLink
                  to={cta.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-lime min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold shadow-md"
                >
                  <cta.Icon className="h-4 w-4 fill-current" />
                  <span>{cta.label}</span>
                </NavLink>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
}
