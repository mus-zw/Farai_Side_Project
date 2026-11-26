/**
 * Offline and data-safety helpers for the Fitness app: install the offline shell, ask the browser to
 * keep the log, and keep track of when it was last backed up. Nothing here touches the log itself.
 */

const BACKUP_AT_KEY = 'farai_fitness_backup_at';
const SNOOZE_KEY = 'farai_fitness_backup_snooze_until';
const DAY_MS = 86_400_000;
/** A local-only log with no backup newer than this gets a reminder. */
export const BACKUP_STALE_DAYS = 30;
/** Fewer records than this is not worth a reminder yet. */
export const BACKUP_MIN_RECORDS = 5;
const SNOOZE_DAYS = 14;

const read = (key: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the reminder simply shows again.
  }
};

export const lastBackupAt = (): number | null => read(BACKUP_AT_KEY);
export const markBackup = (now: number = Date.now()) => write(BACKUP_AT_KEY, now);
export const snoozeBackup = (now: number = Date.now()) => write(SNOOZE_KEY, now + SNOOZE_DAYS * DAY_MS);

/**
 * Should the backup reminder show? Only for a log that lives on this device alone (no account), is the
 * person's own (not sample data), has something worth saving, and has no recent backup or snooze.
 */
export function backupDue(opts: { records: number; signedIn: boolean; seeded: boolean; lastBackup: number | null; snoozedUntil: number | null; now?: number }): boolean {
  const now = opts.now ?? Date.now();
  if (opts.signedIn || opts.seeded || opts.records < BACKUP_MIN_RECORDS) return false;
  if (opts.snoozedUntil && opts.snoozedUntil > now) return false;
  return !opts.lastBackup || now - opts.lastBackup > BACKUP_STALE_DAYS * DAY_MS;
}
export const snoozedUntil = (): number | null => read(SNOOZE_KEY);

/**
 * Ask the browser to keep this site's data when space runs short or the site goes unused (Safari
 * clears unprotected data after about a week). Safe to call often; true/false is the browser's answer,
 * null means it cannot say.
 */
export async function protectStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageStatus(): Promise<{ persisted: boolean | null; usedMB: number | null }> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    return { persisted, usedMB: est?.usage != null ? Math.round((est.usage / 1048576) * 10) / 10 : null };
  } catch {
    return { persisted: null, usedMB: null };
  }
}

/**
 * Make the Fitness app installable and usable offline: link its manifest and icon while it is open and,
 * in a production build, register the offline shell for /fitness only. Returns a cleanup.
 */
export function registerFitnessOffline(): () => void {
  const base = import.meta.env.BASE_URL;
  const links: HTMLLinkElement[] = [];
  const add = (rel: string, href: string) => {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    document.head.appendChild(l);
    links.push(l);
  };
  add('manifest', `${base}fitness.webmanifest`);
  add('apple-touch-icon', `${base}fitness-icon-192.png`);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${base}fitness-sw.js`, { scope: `${base}fitness` }).catch(() => undefined);
  }
  return () => links.forEach((l) => l.remove());
}

/** True when a failure looks like "no connection" rather than a real fault. */
export function looksOffline(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as { message?: string })?.message ?? err);
  return /failed to fetch|networkerror|load failed|network request failed|dynamically imported module|err_internet_disconnected/i.test(msg);
}
