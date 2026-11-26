import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'farai_fitness_theme';

const readPref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};
const systemIsDark = (): boolean => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true);

interface ThemeCtx {
  pref: ThemePref;
  /** What is actually showing. */
  mode: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}
const Ctx = createContext<ThemeCtx>({ pref: 'system', mode: 'dark', setPref: () => undefined });

/** The fitness app's root: applies light or dark (your choice, or the device's) to everything inside it. */
export function FitnessTheme({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [dark, setDark] = useState(systemIsDark);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const mode: 'light' | 'dark' = pref === 'system' ? (dark ? 'dark' : 'light') : pref;
  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      // Not persisting the choice is fine.
    }
  }, []);
  const value = useMemo(() => ({ pref, mode, setPref }), [pref, mode, setPref]);
  return (
    <Ctx.Provider value={value}>
      <div data-theme="fitness" data-mode={mode}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export const useFitnessTheme = (): ThemeCtx => useContext(Ctx);
