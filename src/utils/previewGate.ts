/**
 * A "Launching Soon" gate with a private owner preview, shared by /fitness and /demo.
 *
 * IMPORTANT: this is a client-side, soft gate. It suits "show a professional coming-soon page to
 * people holding old links, and let the owner in to test". It is NOT security: the app's code can
 * still be fetched by someone who finds it, and the check can be bypassed by reading the bundle.
 * Real access control needs a server.
 *
 * Preview keys are never shipped. vite.config.ts hashes each one (SHA-256) at build time and only
 * the hashes are compiled in; a build guard fails if a raw key shows up in the output. Use long,
 * random keys: a hash of a short phrase can be guessed offline.
 *
 * The owner unlocks with ?preview=<key> in the URL (it is removed from the address bar at once) or
 * by typing the key on the coming-soon page. It is remembered per gate in sessionStorage: this tab,
 * until it is closed.
 */
import { useSyncExternalStore } from 'react';

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time-ish string compare, so timing does not reveal how much of a hash matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Does `input` (trimmed) hash to the expected SHA-256 hex? An empty expected hash never matches. */
export async function matchesPreviewKey(input: string, expectedHash: string): Promise<boolean> {
  const key = input.trim();
  if (!key || !expectedHash) return false;
  return safeEqual(await sha256Hex(key), expectedHash.toLowerCase());
}

/** Does `input` match ANY of the hashes? Every hash is compared, so timing does not reveal which one matched. */
export async function matchesAnyPreviewKey(input: string, hashes: readonly string[]): Promise<boolean> {
  const results = await Promise.all(hashes.map((h) => matchesPreviewKey(input, h)));
  return results.some(Boolean);
}

/** The value of ?preview= in a query string, or null. */
export function previewParam(search: string): string | null {
  const v = new URLSearchParams(search).get('preview');
  return v && v.trim() ? v : null;
}

/** The URL with ?preview= removed (other params and the hash are kept). */
export function withoutPreviewParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('preview');
  return url.pathname + url.search + url.hash;
}

/**
 * Whether a gate is up. Down once launched. Otherwise up in production always, and in development
 * only if a preview key is configured for it (so `npm run dev` stays open by default).
 */
export function gateIsActive(opts: { launched: boolean; dev: boolean; hasKey: boolean }): boolean {
  if (opts.launched) return false;
  return !opts.dev || opts.hasKey;
}

export type GateStatus = 'checking' | 'locked' | 'unlocked';

// The ?preview= value is read ONCE, before any gate strips it, so every gate can try it. It is taken
// out of the address bar right away, whether it turns out to be right or wrong.
const initialParam: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const p = previewParam(window.location.search);
  if (p) window.history.replaceState(null, '', withoutPreviewParam(window.location.href));
  return p;
})();

export interface PreviewGate {
  /** True when the gate is up for this build (not launched, and production or a key is set). */
  active: boolean;
  /** True when at least one owner key exists, so "Owner access" can be offered. */
  configured: boolean;
  getStatus: () => GateStatus;
  tryUnlock: (key: string) => Promise<boolean>;
  lockAgain: () => void;
  /** React hook: current state. `badge` is true only for visitors who should see "Launching Soon". */
  useGate: () => { active: boolean; status: GateStatus; badge: boolean };
}

export function createPreviewGate(opts: { storageKey: string; hashes: readonly string[]; launched: boolean; dev: boolean }): PreviewGate {
  const hashes = opts.hashes.filter(Boolean).map((h) => h.toLowerCase());
  const configured = hashes.length > 0;
  const active = gateIsActive({ launched: opts.launched, dev: opts.dev, hasKey: configured });

  let status: GateStatus = active ? 'checking' : 'unlocked';
  const listeners = new Set<() => void>();
  const setStatus = (s: GateStatus) => {
    if (s === status) return;
    status = s;
    listeners.forEach((l) => l());
  };

  const read = (): string | null => {
    try {
      return sessionStorage.getItem(opts.storageKey);
    } catch {
      return null;
    }
  };
  const write = (k: string | null) => {
    try {
      if (k) sessionStorage.setItem(opts.storageKey, k);
      else sessionStorage.removeItem(opts.storageKey);
    } catch {
      // Storage blocked: the unlock lasts for this page view only.
    }
  };

  async function tryUnlock(key: string): Promise<boolean> {
    const ok = await matchesAnyPreviewKey(key, hashes);
    if (ok) {
      write(key.trim());
      setStatus('unlocked');
    }
    return ok;
  }

  function lockAgain() {
    write(null);
    if (active) setStatus('locked');
  }

  async function init() {
    if (!active || typeof window === 'undefined') return;
    if (initialParam && (await tryUnlock(initialParam))) return;
    const stored = read();
    if (stored && (await matchesAnyPreviewKey(stored, hashes))) return setStatus('unlocked');
    if (stored) write(null); // a stale or wrong value
    setStatus('locked');
  }
  void init();

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };

  return {
    active,
    configured,
    getStatus: () => status,
    tryUnlock,
    lockAgain,
    useGate: () => {
      const s = useSyncExternalStore(subscribe, () => status, () => status);
      return { active, status: s, badge: active && s === 'locked' };
    },
  };
}
