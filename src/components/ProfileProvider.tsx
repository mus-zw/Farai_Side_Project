import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { InterestId, isInterestId } from '../utils/interests';

/**
 * A local-only profile: a display name, interest tags and a signed-in flag, kept
 * in localStorage. There is no account, server or password; "sign in" just means
 * "use this name on this browser". Interests are kept even when signed out.
 */

const PROFILE_KEY = 'farai_profile_v1';
const MAX_NAME = 40;

export interface Profile {
  signedIn: boolean;
  name: string;
  interests: InterestId[];
}

const EMPTY_PROFILE: Profile = { signedIn: false, name: '', interests: [] };

/** A stored value, or the empty profile if it is missing or not the right shape. */
export function parseProfile(raw: string | null): Profile {
  if (!raw) return EMPTY_PROFILE;
  try {
    const v = JSON.parse(raw);
    const name = typeof v?.name === 'string' ? v.name.trim().slice(0, MAX_NAME) : '';
    const interests: InterestId[] = Array.isArray(v?.interests)
      ? [...new Set<InterestId>(v.interests.filter(isInterestId))]
      : [];
    return { signedIn: v?.signedIn === true && name !== '', name, interests };
  } catch {
    return EMPTY_PROFILE;
  }
}

function readProfile(): Profile {
  try {
    return parseProfile(localStorage.getItem(PROFILE_KEY));
  } catch {
    return EMPTY_PROFILE;
  }
}

interface ProfileContextValue {
  profile: Profile;
  signIn: (name: string) => void;
  signOut: () => void;
  toggleInterest: (id: InterestId) => void;
  profileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [profileOpen, setProfileOpen] = useState(false);

  // Persist every change. A browser with storage blocked just forgets on reload.
  useEffect(() => {
    try {
      // An empty profile is not worth a storage entry (and "delete my data" should leave nothing behind).
      if (!profile.signedIn && !profile.name && profile.interests.length === 0) localStorage.removeItem(PROFILE_KEY);
      else localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Not persisting is fine.
    }
  }, [profile]);

  // Another tab changed the profile: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_KEY) setProfile(parseProfile(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = useCallback((name: string) => {
    const clean = name.trim().slice(0, MAX_NAME);
    if (!clean) return;
    setProfile((p) => ({ ...p, signedIn: true, name: clean }));
  }, []);
  const signOut = useCallback(() => setProfile((p) => ({ ...p, signedIn: false, name: '' })), []);
  const toggleInterest = useCallback(
    (id: InterestId) =>
      setProfile((p) => ({
        ...p,
        interests: p.interests.includes(id) ? p.interests.filter((i) => i !== id) : [...p.interests, id],
      })),
    []
  );
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const value = useMemo(
    () => ({ profile, signIn, signOut, toggleInterest, profileOpen, openProfile, closeProfile }),
    [profile, signIn, signOut, toggleInterest, profileOpen, openProfile, closeProfile]
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>.');
  return ctx;
}
