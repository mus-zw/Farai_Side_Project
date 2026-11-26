import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Athlete, DEFAULT_SETTINGS, Settings } from '../../utils/fitness';
import type { SettingsPatch } from '../../utils/fitnessDb';
import { getAthlete, getSettings, initFitnessDb, isSeeded, patchSettings, useLive } from '../../utils/fitnessDb';

type Notify = (type: 'success' | 'error' | 'info', message: string) => void;

interface RestState {
  /** performance.now()-based deadline in ms, or null when no timer is running. */
  endsAt: number | null;
  /** What the timer was started with (plus adjustments), for the progress ring. */
  total: number;
}

interface FitnessContextValue {
  status: 'loading' | 'ready' | 'error';
  error: string;
  settings: Settings;
  updateSettings: (patch: SettingsPatch) => void;
  seeded: boolean;
  /** undefined while loading, null before onboarding is done. */
  athlete: Athlete | null | undefined;
  notify: Notify;
  rest: RestState;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
}

const FitnessContext = createContext<FitnessContextValue | null>(null);

/** Opens the database, exposes settings, and owns the rest timer shared by the logger and the nav. */
export function FitnessProvider({ children, notify }: { children: ReactNode; notify: Notify }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [rest, setRest] = useState<RestState>({ endsAt: null, total: 0 });

  useEffect(() => {
    let alive = true;
    initFitnessDb()
      .then(() => alive && setStatus('ready'))
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'IndexedDB is not available in this browser.');
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Live queries only run once the database is ready.
  const settings = useLive(() => (status === 'ready' ? getSettings() : DEFAULT_SETTINGS), [status], DEFAULT_SETTINGS);
  const seeded = useLive(() => (status === 'ready' ? isSeeded() : false), [status], false);

  const athlete = useLive<Athlete | null | undefined>(() => (status === 'ready' ? getAthlete() : undefined), [status], undefined);

  const updateSettings = useCallback((patch: SettingsPatch) => {
    void patchSettings(patch);
  }, []);

  const startRest = useCallback((seconds: number) => {
    const s = Math.max(5, Math.round(seconds));
    setRest({ endsAt: performance.now() + s * 1000, total: s });
  }, []);
  const adjustRest = useCallback((delta: number) => {
    setRest((r) => {
      if (r.endsAt === null) return r;
      const endsAt = Math.max(performance.now() + 1000, r.endsAt + delta * 1000);
      return { endsAt, total: Math.max(r.total + delta, 5) };
    });
  }, []);
  const skipRest = useCallback(() => setRest({ endsAt: null, total: 0 }), []);

  const value = useMemo(
    () => ({ status, error, settings, updateSettings, seeded, athlete, notify, rest, startRest, adjustRest, skipRest }),
    [status, error, settings, updateSettings, seeded, athlete, notify, rest, startRest, adjustRest, skipRest]
  );
  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness(): FitnessContextValue {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error('useFitness must be used inside <FitnessProvider>.');
  return ctx;
}
