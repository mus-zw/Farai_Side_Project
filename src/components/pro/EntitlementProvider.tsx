import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import LabUnlockModal from './LabUnlockModal';
import FitnessProModal from './FitnessProModal';

interface Ctx {
  openLabUnlock: (reason?: string) => void;
  openFitnessPro: (tab?: 'solo' | 'pilot') => void;
}
const EntitlementUi = createContext<Ctx | null>(null);

/** Hosts the two unlock dialogs so any screen can open them. */
export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [lab, setLab] = useState<{ reason?: string } | null>(null);
  const [fit, setFit] = useState<{ tab: 'solo' | 'pilot' } | null>(null);
  const openLabUnlock = useCallback((reason?: string) => setLab({ reason }), []);
  const openFitnessPro = useCallback((tab: 'solo' | 'pilot' = 'solo') => setFit({ tab }), []);
  const value = useMemo(() => ({ openLabUnlock, openFitnessPro }), [openLabUnlock, openFitnessPro]);
  return (
    <EntitlementUi.Provider value={value}>
      {children}
      {lab && <LabUnlockModal reason={lab.reason} onClose={() => setLab(null)} />}
      {fit && <FitnessProModal initialTab={fit.tab} onClose={() => setFit(null)} />}
    </EntitlementUi.Provider>
  );
}

export function useUnlockUi(): Ctx {
  const ctx = useContext(EntitlementUi);
  if (!ctx) throw new Error('useUnlockUi must be used inside <EntitlementProvider>.');
  return ctx;
}
