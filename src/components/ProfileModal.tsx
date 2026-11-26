import { useEffect, useRef, useState } from 'react';
import { X, LogOut } from 'lucide-react';
import { useProfile } from './ProfileProvider';
import { INTERESTS } from '../utils/interests';

/** Account / interests dialog. Everything is stored in this browser only. */
export default function ProfileModal() {
  const { profile, profileOpen, closeProfile, signIn, signOut, toggleInterest } = useProfile();
  const [name, setName] = useState(profile.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start from the saved name each time it opens, and put the cursor in the box.
  useEffect(() => {
    if (!profileOpen) return;
    setName(profile.name);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProfile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileOpen, closeProfile]);

  if (!profileOpen) return null;

  const trimmed = name.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" data-testid="profile-modal">
      <div className="absolute inset-0 bg-black/70" onClick={closeProfile} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        className="relative w-full max-w-md rounded-t-2xl border border-[#16213E] bg-[#0F1419] p-6 shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={closeProfile}
          aria-label="Close profile"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="profile-title" className="text-lg font-bold text-white">
          {profile.signedIn ? `Hi, ${profile.name}` : 'Your profile'}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Saved in this browser only. There is no account or server; this just personalises the site for you.
        </p>

        <form
          className="mt-5 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) signIn(trimmed);
          }}
        >
          <label htmlFor="profile-name" className="text-xs font-semibold text-neutral-300">
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="profile-name"
              ref={inputRef}
              data-testid="profile-name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Farai"
              className="min-h-[40px] flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none"
            />
            <button
              type="submit"
              data-testid="profile-save"
              disabled={!trimmed || (profile.signedIn && trimmed === profile.name)}
              className="min-h-[40px] rounded-lg bg-[#32FF00] px-4 text-sm font-bold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {profile.signedIn ? 'Update' : 'Sign in'}
            </button>
          </div>
        </form>

        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-neutral-300">Interests</legend>
          <p className="mt-0.5 text-[11px] text-neutral-500">Matching sections are listed first in the menu and on the home page.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = profile.interests.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  data-testid={`interest-${i.id}`}
                  aria-pressed={on}
                  onClick={() => toggleInterest(i.id)}
                  className={`min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                    on
                      ? 'border-[#32FF00] bg-[#32FF00]/15 text-[#32FF00]'
                      : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {i.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-between">
          {profile.signedIn ? (
            <button
              type="button"
              data-testid="profile-signout"
              onClick={() => {
                signOut();
                setName('');
              }}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <span className="text-[11px] text-neutral-600">Not signed in</span>
          )}
          <button
            type="button"
            onClick={closeProfile}
            className="min-h-[36px] rounded-lg border border-neutral-700 px-4 text-xs font-semibold text-neutral-200 hover:border-neutral-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
