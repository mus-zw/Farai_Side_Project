/**
 * The gate in front of /demo (the CV Auto-Labeler). Same mechanism as the fitness gate, with its own
 * unlock state. It opens with VITE_DEMO_PREVIEW_KEY, or with VITE_FITNESS_PREVIEW_KEY, so one key is
 * enough to preview both while two are allowed. VITE_DEMO_LAUNCHED=true removes the gate.
 */
import { createPreviewGate } from './previewGate';

const DEMO_HASH: string = typeof __DEMO_PREVIEW_SHA256__ === 'string' ? __DEMO_PREVIEW_SHA256__ : '';
const FITNESS_HASH: string = typeof __FITNESS_PREVIEW_SHA256__ === 'string' ? __FITNESS_PREVIEW_SHA256__ : '';

export const DEMO_PREVIEW_STORAGE_KEY = 'farai_demo_preview';

export const demoGate = createPreviewGate({
  storageKey: DEMO_PREVIEW_STORAGE_KEY,
  hashes: [DEMO_HASH, FITNESS_HASH],
  launched: import.meta.env.VITE_DEMO_LAUNCHED === 'true',
  dev: Boolean(import.meta.env.DEV),
});

export const DEMO_GATE_ACTIVE = demoGate.active;
export const DEMO_PREVIEW_CONFIGURED = demoGate.configured;
export const tryUnlockDemo = demoGate.tryUnlock;
export const useDemoGate = demoGate.useGate;
