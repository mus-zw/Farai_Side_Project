import { db } from './fitnessDb';

/**
 * Delete everything this site has stored on this device: every localStorage
 * entry it owns (all keys start with "farai") and the fitness database. Used by
 * the "delete my data" button on the privacy page.
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.toLowerCase().startsWith('farai')) localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was stored.
  }
  try {
    db.close();
    await db.delete();
  } catch {
    // No database to delete.
  }
}
