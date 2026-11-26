/**
 * What this visitor has unlocked, kept in localStorage. There is no server: an
 * unlock is a flag on the device, set by a trial, a license key (checked offline
 * against a public key) or, for testing only, the demo toggle.
 *
 * Be clear-eyed about what that means: anything checked in the browser can be
 * bypassed by someone determined. This is a friction-and-honesty layer for
 * client-side features, not DRM. Anything that costs real money to serve must be
 * enforced server-side.
 */

export const ENTITLEMENT_KEY = 'farai_entitlements_v1';
export const TRIAL_DAYS = 14;
const DAY_MS = 86_400_000;

export type FitnessPlan = 'trial' | 'solo_year' | 'solo_12week' | 'pilot' | 'demo';
export const FITNESS_PLAN_LABEL: Record<FitnessPlan, string> = {
  trial: '14-Day Trial',
  solo_year: 'Solo · Annual',
  solo_12week: '12-Week PPL + Form Coach Pass',
  pilot: 'Trainer Pilot',
  demo: 'Demo unlock (testing)',
};

export interface LabEntitlement {
  source: 'license' | 'demo';
  id?: string;
  /** Epoch ms, or undefined for no expiry. */
  expiresAt?: number;
}
export interface FitnessEntitlement {
  plan: FitnessPlan;
  source: 'trial' | 'license' | 'demo';
  id?: string;
  startedAt: number;
  /** Epoch ms, or undefined for no expiry (the demo toggle). */
  until?: number;
}
export interface Entitlements {
  lab?: LabEntitlement;
  fitness?: FitnessEntitlement;
  /** The free trial can only be started once per device. */
  trialUsed?: boolean;
}

const PLANS: FitnessPlan[] = ['trial', 'solo_year', 'solo_12week', 'pilot', 'demo'];
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
const str = (v: unknown, max = 80): string | undefined => (typeof v === 'string' && v ? v.slice(0, max) : undefined);

export function parseEntitlements(raw: string | null): Entitlements {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return {};
    const out: Entitlements = { trialUsed: v.trialUsed === true };
    if (v.lab && (v.lab.source === 'license' || v.lab.source === 'demo')) {
      out.lab = { source: v.lab.source, id: str(v.lab.id), expiresAt: num(v.lab.expiresAt) };
    }
    if (v.fitness && PLANS.includes(v.fitness.plan) && ['trial', 'license', 'demo'].includes(v.fitness.source)) {
      out.fitness = { plan: v.fitness.plan, source: v.fitness.source, id: str(v.fitness.id), startedAt: num(v.fitness.startedAt) ?? 0, until: num(v.fitness.until) };
    }
    return out;
  } catch {
    return {};
  }
}

export function isLabPro(e: Entitlements, now: number = Date.now()): boolean {
  return Boolean(e.lab && (!e.lab.expiresAt || e.lab.expiresAt > now));
}

export interface FitnessStatus {
  active: boolean;
  plan?: FitnessPlan;
  daysLeft?: number;
}

export function fitnessStatus(e: Entitlements, now: number = Date.now()): FitnessStatus {
  const f = e.fitness;
  if (!f || (f.until && f.until <= now)) return { active: false };
  return { active: true, plan: f.plan, daysLeft: f.until ? Math.max(1, Math.ceil((f.until - now) / DAY_MS)) : undefined };
}

/** Start the one-off free trial. Returns null if it was already used on this device. */
export function startTrial(e: Entitlements, now: number = Date.now()): Entitlements | null {
  if (e.trialUsed) return null;
  return { ...e, trialUsed: true, fitness: { plan: 'trial', source: 'trial', startedAt: now, until: now + TRIAL_DAYS * DAY_MS } };
}

export function setDemoLab(e: Entitlements, on: boolean): Entitlements {
  const next = { ...e };
  if (on) next.lab = { source: 'demo' };
  else if (next.lab?.source === 'demo') delete next.lab;
  return next;
}

export function setDemoFitness(e: Entitlements, on: boolean, now: number = Date.now()): Entitlements {
  const next = { ...e };
  if (on) next.fitness = { plan: 'demo', source: 'demo', startedAt: now };
  else if (next.fitness?.source === 'demo') delete next.fitness;
  return next;
}

// --- License keys ------------------------------------------------------------------------------------

/**
 * A key looks like  FARAI1.<payload>.<signature>  (base64url). The payload is
 * JSON {p: product, id, exp?: unix seconds}; the signature is ECDSA P-256 /
 * SHA-256 over the payload text, checked in the browser with WebCrypto against
 * the public key in VITE_LICENSE_PUBLIC_KEY. Keys are issued with
 * scripts/license.mjs, and the private key never goes near this repo or the site.
 */
export type Product = 'cv-pro' | 'fitness-solo_year' | 'fitness-solo_12week' | 'fitness-pilot';
const PRODUCTS: Product[] = ['cv-pro', 'fitness-solo_year', 'fitness-solo_12week', 'fitness-pilot'];

export type LicenseResult =
  | { ok: true; product: Product; id: string; expiresAt?: number }
  | { ok: false; reason: string };

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function verifyLicense(key: string, publicKeyJwk: string | undefined, now: number = Date.now()): Promise<LicenseResult> {
  if (!publicKeyJwk) return { ok: false, reason: 'License keys are not set up on this site yet.' };
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'FARAI1') return { ok: false, reason: 'That does not look like a license key.' };
  try {
    const jwk = JSON.parse(publicKeyJwk);
    const pub = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const payloadBytes = b64urlToBytes(parts[1]);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlToBytes(parts[2]) as BufferSource, payloadBytes as BufferSource);
    if (!valid) return { ok: false, reason: 'That key is not valid.' };
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!PRODUCTS.includes(payload.p)) return { ok: false, reason: 'That key is for something this site does not recognise.' };
    const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
    if (expiresAt && expiresAt <= now) return { ok: false, reason: 'That key has expired.' };
    return { ok: true, product: payload.p, id: String(payload.id ?? '').slice(0, 80), expiresAt };
  } catch {
    return { ok: false, reason: 'That key could not be read.' };
  }
}

/** The entitlements after a verified key is applied. */
export function applyLicense(e: Entitlements, r: Extract<LicenseResult, { ok: true }>, now: number = Date.now()): Entitlements {
  if (r.product === 'cv-pro') return { ...e, lab: { source: 'license', id: r.id, expiresAt: r.expiresAt } };
  const plan = r.product.slice('fitness-'.length) as FitnessPlan;
  return { ...e, fitness: { plan, source: 'license', id: r.id, startedAt: now, until: r.expiresAt } };
}
