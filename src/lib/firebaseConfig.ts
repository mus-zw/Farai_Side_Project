/**
 * Reads the Firebase web config from VITE_FIREBASE_* variables. Light on purpose: no firebase
 * import here, so the rest of the app can ask "is cloud sync set up?" without pulling the SDK
 * into the bundle. When any required value is missing, the fitness app simply stays in its
 * local-only (guest / Dexie) mode.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const val = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The config, or null unless apiKey, authDomain, projectId and appId are all present. Pure. */
export function readFirebaseConfig(env: Record<string, unknown>): FirebaseWebConfig | null {
  const apiKey = val(env.VITE_FIREBASE_API_KEY);
  const authDomain = val(env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = val(env.VITE_FIREBASE_PROJECT_ID);
  const appId = val(env.VITE_FIREBASE_APP_ID);
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const storageBucket = val(env.VITE_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = val(env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  return { apiKey, authDomain, projectId, appId, ...(storageBucket && { storageBucket }), ...(messagingSenderId && { messagingSenderId }) };
}

export const firebaseConfig: FirebaseWebConfig | null = readFirebaseConfig(import.meta.env as Record<string, unknown>);

/** True when the dev-only in-memory cloud is switched on (never in a production build). */
export const mockCloudRequested: boolean = Boolean(import.meta.env.DEV) && import.meta.env.VITE_FIREBASE_MOCK === 'true';

/** Whether any cloud backend is configured. False means local guest/Dexie mode only. */
export const cloudConfigured: boolean = firebaseConfig !== null || mockCloudRequested;
