import type { CloudBackend } from './cloud';
import { firebaseConfig } from './firebaseConfig';

let loading: Promise<CloudBackend | null> | null = null;

/**
 * The configured cloud backend, or null for local-only mode. Loaded on demand so neither the
 * Firebase SDK nor the dev mock is fetched until the fitness app asks.
 */
export function loadCloudBackend(): Promise<CloudBackend | null> {
  loading ??= (async () => {
    // Written out in full (not via a shared constant) so a production build can drop the mock entirely.
    if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_MOCK === 'true') {
      return (await import('./mockCloud')).createMockBackend();
    }
    if (firebaseConfig) return (await import('./firebase')).createFirebaseBackend(firebaseConfig);
    return null;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
