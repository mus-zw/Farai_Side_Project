import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** The last thing that can be undone, for a few seconds (a delete, or a one-tap add). */
  undo: UndoState | null;
  /** Offer to take an action back; `restore` reverses it. Replaces any earlier offer. */
  offerUndo: (label: string, restore: () => Promise<void>) => void;
  runUndo: () => Promise<void>;
  dismissUndo: () => void;
}

export interface UndoState {
  label: string;
  restore: () => Promise<void>;
}

const UNDO_MS = 8000;

// The rest timer runs on performance.now(), which restarts with the page, so its deadline is also kept as
// a wall-clock time and restored if it is still in the future after a reload.
const REST_KEY = 'farai_fitness_rest_v1';
function readRest(): RestState {
  try {
    const v = JSON.parse(localStorage.getItem(REST_KEY) || 'null');
    if (v && typeof v.endsAtWall === 'number' && typeof v.total === 'number' && v.endsAtWall > Date.now()) {
      return { endsAt: performance.now() + (v.endsAtWall - Date.now()), total: v.total };
    }
  } catch {
    // Unreadable: no timer.
  }
  return { endsAt: null, total: 0 };
}
function saveRest(r: RestState) {
  try {
    if (r.endsAt === null) localStorage.removeItem(REST_KEY);
    else localStorage.setItem(REST_KEY, JSON.stringify({ endsAtWall: Date.now() + (r.endsAt - performance.now()), total: r.total }));
  } catch {
    // Storage blocked: the timer just will not survive a reload.
  }
}

const FitnessContext = createContext<FitnessContextValue | null>(null);

/** Opens the database, exposes settings, and owns the rest timer shared by the logger and the nav. */
export function FitnessProvider({ children, notify }: { children: ReactNode; notify: Notify }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [rest, setRest] = useState<RestState>(readRest);
  useEffect(() => saveRest(rest), [rest]);

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

  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoTimer = useRef<number | null>(null);
  const dismissUndo = useCallback(() => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  }, []);
  const offerUndo = useCallback((label: string, restore: () => Promise<void>) => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    setUndo({ label, restore });
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }, []);
  const runUndo = useCallback(async () => {
    const u = undo;
    dismissUndo();
    if (u) await u.restore().catch(() => undefined);
  }, [undo, dismissUndo]);
  useEffect(() => () => {
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
  }, []);

  const value = useMemo(
    () => ({ status, error, settings, updateSettings, seeded, athlete, notify, rest, startRest, adjustRest, skipRest, undo, offerUndo, runUndo, dismissUndo }),
    [status, error, settings, updateSettings, seeded, athlete, notify, rest, startRest, adjustRest, skipRest, undo, offerUndo, runUndo, dismissUndo]
  );
  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness(): FitnessContextValue {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error('useFitness must be used inside <FitnessProvider>.');
  return ctx;
}
