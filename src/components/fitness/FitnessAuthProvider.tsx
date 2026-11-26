import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cloudConfigured } from '../../lib/firebaseConfig';
import type { AuthBackend, CloudBackend, CloudUser } from '../../lib/cloud';
import { toAuthError } from '../../lib/cloud';
import type { FitnessSync, SyncState } from '../../lib/fitnessSync';
import { db, getAthlete, isSeeded, renameAthlete, resetEverything, startFresh } from '../../utils/fitnessDb';
import { useFitness } from './FitnessProvider';

/**
 * Sign-in for the FITNESS app only. It lives inside the fitness shell: the portfolio, the CV lab
 * and the site profile know nothing about it, and it shares no login or data with them. With no
 * Firebase config this is simply "disabled" and the app stays in local guest / Dexie mode.
 */

export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

interface Ctx {
  status: AuthStatus;
  user: CloudUser | null;
  sync: SyncState;
  busy: boolean;
  error: string;
  notice: string;
  /** 'mock' in development without Firebase, else 'firebase'. */
  backendKind: CloudBackend['kind'] | null;
  signUp: (email: string, password: string, name?: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInGoogle: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  /** Sign out. `removeLocal` also wipes this device's copy and returns to setup (for shared devices). */
  signOut: (options?: { removeLocal?: boolean }) => Promise<void>;
  syncNow: () => Promise<void>;
  /** Delete everything stored in the cloud for this account, and the account itself. */
  deleteCloudAccount: () => Promise<boolean>;
  clearMessages: () => void;
}

const FitnessAuth = createContext<Ctx | null>(null);
const IDLE: SyncState = { phase: 'idle', queued: 0 };

export function FitnessAuthProvider({ children }: { children: ReactNode }) {
  const { status: dbStatus } = useFitness();
  const [status, setStatus] = useState<AuthStatus>(cloudConfigured ? 'loading' : 'disabled');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [sync, setSync] = useState<SyncState>(IDLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [backend, setBackend] = useState<CloudBackend | null>(null);
  const engineRef = useRef<FitnessSync | null>(null);
  const userRef = useRef<CloudUser | null>(null);
  userRef.current = user;
  const uid = user?.uid ?? null; // the engine's lifetime follows WHO is signed in, never the identity of the user object
  const runRef = useRef(0); // bumped on every sign-in/out so a slow start cannot outlive its user

  // Load the backend (and with it the Firebase SDK) only inside the fitness app, only if configured.
  useEffect(() => {
    if (!cloudConfigured) return;
    let alive = true;
    import('../../lib/cloudBackend')
      .then((m) => m.loadCloudBackend())
      .then((b) => {
        if (!alive) return;
        if (!b) return setStatus('disabled');
        setBackend(b);
      })
      .catch(() => alive && setStatus('disabled'));
    return () => {
      alive = false;
    };
  }, []);

  // Follow the sign-in state.
  useEffect(() => {
    if (!backend) return;
    return backend.auth.onAuthChange((u) => {
      setUser(u);
      setStatus(u ? 'signedIn' : 'signedOut');
    });
  }, [backend]);

  // While signed in (and the local database is ready), run the sync engine.
  useEffect(() => {
    const current = userRef.current;
    if (!backend || !uid || !current || dbStatus !== 'ready') return;
    const run = ++runRef.current;
    let engine: FitnessSync | null = null;
    (async () => {
      try {
        // Sample data is nobody's data: signing in replaces it with the account's own.
        if (await isSeeded()) await startFresh();
        // Data on this device that already belongs to a DIFFERENT account must never flow into this one
        // (a shared device): wipe it first. Data that was never tied to an account is the signed-in
        // person's own and is merged in.
        const owner = (await db.kv.get('cloudOwner'))?.value;
        if (typeof owner === 'string' && owner !== current.uid) await resetEverything();
        await db.kv.put({ key: 'cloudOwner', value: current.uid });
        const { FitnessSync } = await import('../../lib/fitnessSync');
        if (run !== runRef.current) return;
        engine = new FitnessSync(backend.store(current.uid), setSync);
        engineRef.current = engine;
        const { cloudHadAthlete } = await engine.start();
        if (run !== runRef.current) return engine.stop();
        // A brand-new account on a device with a placeholder profile: use the account's name.
        const local = await getAthlete();
        if (!cloudHadAthlete && local && current.displayName && ['Athlete', 'Guest'].includes(local.name)) await renameAthlete(current.displayName);
      } catch (e: any) {
        if (run === runRef.current) setError(e?.message || 'Could not start syncing.');
      }
    })();
    return () => {
      runRef.current++;
      engine?.stop();
      if (engineRef.current === engine) engineRef.current = null;
      setSync(IDLE);
    };
  }, [backend, uid, dbStatus]);

  const auth: AuthBackend | null = backend?.auth ?? null;

  const act = useCallback(
    async (fn: () => Promise<void>, doneNotice = ''): Promise<boolean> => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await fn();
        if (doneNotice) setNotice(doneNotice);
        return true;
      } catch (e) {
        setError(toAuthError(e).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const value = useMemo<Ctx>(
    () => ({
      status,
      user,
      sync,
      busy,
      error,
      notice,
      backendKind: backend?.kind ?? null,
      signUp: (email, password, name) => act(() => auth!.signUpEmail(email, password, name)),
      signIn: (email, password) => act(() => auth!.signInEmail(email, password)),
      signInGoogle: () => act(() => auth!.signInGoogle()),
      resetPassword: (email) => act(() => auth!.sendPasswordReset(email), 'If that email has an account, a reset link is on its way.'),
      signOut: async ({ removeLocal = false } = {}) => {
        runRef.current++;
        engineRef.current?.stop();
        await act(async () => {
          await auth?.signOut();
          if (removeLocal) await resetEverything();
        });
      },
      syncNow: async () => {
        try {
          await engineRef.current?.reconcile();
          await engineRef.current?.flush();
        } catch {
          /* the engine reports its own errors through `sync` */
        }
      },
      deleteCloudAccount: () =>
        act(async () => {
          if (!backend || !user) return;
          runRef.current++;
          engineRef.current?.stop();
          await backend.store(user.uid).deleteAll();
          await backend.auth.deleteAccount();
          await db.kv.delete('cloudOwner'); // the data left on this device is nobody's account's now
        }, 'Your cloud data and account were deleted. Your data on this device is unchanged.'),
      clearMessages: () => {
        setError('');
        setNotice('');
      },
    }),
    [status, user, sync, busy, error, notice, backend, auth, act]
  );

  return <FitnessAuth.Provider value={value}>{children}</FitnessAuth.Provider>;
}

export function useFitnessAuth(): Ctx {
  const ctx = useContext(FitnessAuth);
  if (!ctx) throw new Error('useFitnessAuth must be used inside <FitnessAuthProvider>.');
  return ctx;
}
