import { cloudConfigured } from '../lib/firebaseConfig';

/**
 * Delete everything this site has stored on this device: every localStorage
 * entry it owns (all keys start with "farai") and the fitness database. Used by
 * the "delete my data" button on the privacy page.
 */
export async function clearAllLocalData(): Promise<void> {
  // Signed in to the fitness cloud? Sign out so no login stays behind. (This does not delete the cloud
  // copy: that is a separate, explicit action in the fitness Profile.)
  if (cloudConfigured) {
    try {
      const backend = await (await import('../lib/cloudBackend')).loadCloudBackend();
      await backend?.auth.signOut();
    } catch {
      // Nothing to sign out of.
    }
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.toLowerCase().startsWith('farai')) localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was stored.
  }
  try {
    // Loaded on demand: visitors who never use the fitness app should not download its database code.
    const { db } = await import('./fitnessDb');
    db.close();
    await db.delete();
  } catch {
    // No database to delete.
  }
  // The Firebase SDK keeps its own sign-in and offline cache in IndexedDB.
  try {
    for (const info of (await indexedDB.databases?.()) ?? []) {
      if (info.name && /^(firebase|firestore)/i.test(info.name)) indexedDB.deleteDatabase(info.name);
    }
  } catch {
    // Browser cannot list databases: nothing more to clear.
  }
}
