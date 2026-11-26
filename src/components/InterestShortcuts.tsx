import { Link } from 'react-router-dom';
import { ArrowRight, Dumbbell, ScanLine, UserCircle2 } from 'lucide-react';
import { useProfile } from './ProfileProvider';
import { INTERESTS, InterestId, orderByInterests } from '../utils/interests';
import LaunchBadge from './LaunchBadge';

const ICONS: Record<InterestId, typeof ScanLine> = { cv: ScanLine, fitness: Dumbbell };

/** Home-page shortcuts, with the visitor's chosen interests first. */
export default function InterestShortcuts() {
  const { profile, openProfile } = useProfile();
  const items = orderByInterests(
    INTERESTS.map((i) => ({ ...i, interest: i.id })),
    profile.interests
  );

  return (
    <section id="for-you" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8" data-testid="interest-shortcuts">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          {profile.signedIn ? `Welcome back, ${profile.name}` : 'Explore'}
        </h2>
        <button type="button" onClick={openProfile} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#32FF00] hover:underline">
          <UserCircle2 className="h-4 w-4" /> {profile.interests.length ? 'Change interests' : 'Choose your interests'}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          const picked = profile.interests.includes(item.id);
          return (
            <Link
              key={item.id}
              to={item.path}
              data-testid={`shortcut-${item.id}`}
              className={`group flex items-start gap-4 rounded-2xl border p-5 transition-colors ${
                picked ? 'border-[#32FF00]/60 bg-[#32FF00]/5' : 'border-[#16213E] bg-[#16213E]/40 hover:border-neutral-600'
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#32FF00]/40 bg-[#32FF00]/10 text-[#32FF00]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  {item.label}
                  {item.id === 'fitness' && <LaunchBadge />}
                  {picked && <span className="rounded-full bg-[#32FF00]/15 px-2 py-0.5 text-[10px] font-semibold text-[#32FF00]">Your interest</span>}
                </span>
                <span className="mt-1 block text-xs text-neutral-400">{item.blurb}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#32FF00]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
