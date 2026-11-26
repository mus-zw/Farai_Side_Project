/**
 * The "Launching Soon" gate in front of /fitness, with a private owner preview.
 *
 * IMPORTANT: this is a client-side, soft gate. It is right for "show a professional coming-soon
 * page to people holding old links, and let the owner in to test". It is NOT security: the app's
 * code is still served to the browser (just not run or linked), and the preview check can be
 * bypassed by someone who reads the bundle. Real access control needs a server.
 *
 * The preview key is never shipped. vite.config.ts hashes it (SHA-256) at build time and only the
 * hash is compiled in (__FITNESS_PREVIEW_SHA256__); a build guard fails if the raw key shows up in
 * the output. Use a long random key: a hash of a short phrase can be guessed offline.
 *
 * The owner unlocks with ?preview=<key> in the URL (then the key is removed from the address bar)
 * or by typing it on the coming-soon page. It is remembered in sessionStorage only: this tab,
 * until it is closed.
 */
import { useSyncExternalStore } from 'react';

export const PREVIEW_STORAGE_KEY = 'farai_fitness_preview';

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

/** The value of ?preview= in a query string, or null. */
export function previewParam(search: string): string | null {
  const v = new URLSearchParams(search).get('preview');
  return v && v.trim() ? v : null;
}

/** The URL with ?preview= removed (other params and the hash are kept), so the key does not linger in the address bar. */
export function withoutPreviewParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('preview');
  return url.pathname + url.search + url.hash;
}

/**
 * Whether the gate is up. It is down once launched. Otherwise it is up in production always, and in
 * development only if a preview key is configured (so `npm run dev` stays open by default, and the
 * gate can still be tried locally by setting a key).
 */
export function gateIsActive(opts: { launched: boolean; dev: boolean; hasKey: boolean }): boolean {
  if (opts.launched) return false;
  return !opts.dev || opts.hasKey;
}

// --- Browser state ---------------------------------------------------------------------------------

export type GateStatus = 'checking' | 'locked' | 'unlocked';

const EXPECTED_HASH: string = typeof __FITNESS_PREVIEW_SHA256__ === 'string' ? __FITNESS_PREVIEW_SHA256__ : '';
export const GATE_ACTIVE: boolean = gateIsActive({
  launched: import.meta.env.VITE_FITNESS_LAUNCHED === 'true',
  dev: Boolean(import.meta.env.DEV),
  hasKey: EXPECTED_HASH !== '',
});
/** True when an owner key exists, so the coming-soon page can offer "Owner access". */
export const PREVIEW_CONFIGURED = EXPECTED_HASH !== '';

let status: GateStatus = GATE_ACTIVE ? 'checking' : 'unlocked';
const listeners = new Set<() => void>();
const setStatus = (s: GateStatus) => {
  if (s === status) return;
  status = s;
  listeners.forEach((l) => l());
};

const read = (): string | null => {
  try {
    return sessionStorage.getItem(PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
};
const write = (k: string | null) => {
  try {
    if (k) sessionStorage.setItem(PREVIEW_STORAGE_KEY, k);
    else sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  } catch {
    // Storage blocked: the unlock lasts for this page view only.
  }
};

/** Check a typed or linked key; on success remember it for this tab. */
export async function tryUnlock(key: string): Promise<boolean> {
  const ok = await matchesPreviewKey(key, EXPECTED_HASH);
  if (ok) {
    write(key.trim());
    setStatus('unlocked');
  }
  return ok;
}

/** Re-lock this tab (forget the preview). */
export function lockAgain(): void {
  write(null);
  if (GATE_ACTIVE) setStatus('locked');
}

async function init() {
  if (!GATE_ACTIVE || typeof window === 'undefined') return;
  const fromUrl = previewParam(window.location.search);
  if (fromUrl) {
    // Take the key out of the address bar straight away, right or wrong.
    window.history.replaceState(null, '', withoutPreviewParam(window.location.href));
    if (await tryUnlock(fromUrl)) return;
  }
  const stored = read();
  if (stored && (await matchesPreviewKey(stored, EXPECTED_HASH))) return setStatus('unlocked');
  if (stored) write(null); // a stale or wrong value
  setStatus('locked');
}
void init();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Gate state for components. `badge` is true only for visitors who should see "Launching Soon". */
export function useFitnessGate(): { active: boolean; status: GateStatus; badge: boolean } {
  const s = useSyncExternalStore(subscribe, () => status, () => status);
  return { active: GATE_ACTIVE, status: s, badge: GATE_ACTIVE && s === 'locked' };
}
