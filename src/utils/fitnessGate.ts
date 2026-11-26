/**
 * The gate in front of /fitness. See previewGate.ts for how the mechanism works and its limits.
 * Opens with VITE_FITNESS_PREVIEW_KEY; VITE_FITNESS_LAUNCHED=true removes it.
 */
import { createPreviewGate } from './previewGate';

export {
  sha256Hex,
  safeEqual,
  matchesPreviewKey,
  previewParam,
  withoutPreviewParam,
  gateIsActive,
  type GateStatus,
} from './previewGate';

export const PREVIEW_STORAGE_KEY = 'farai_fitness_preview';

const FITNESS_HASH: string = typeof __FITNESS_PREVIEW_SHA256__ === 'string' ? __FITNESS_PREVIEW_SHA256__ : '';

export const fitnessGate = createPreviewGate({
  storageKey: PREVIEW_STORAGE_KEY,
  hashes: [FITNESS_HASH],
  launched: import.meta.env.VITE_FITNESS_LAUNCHED === 'true',
  dev: Boolean(import.meta.env.DEV),
});

export const GATE_ACTIVE = fitnessGate.active;
export const PREVIEW_CONFIGURED = fitnessGate.configured;
export const tryUnlock = fitnessGate.tryUnlock;
export const lockAgain = fitnessGate.lockAgain;
export const useFitnessGate = fitnessGate.useGate;
