/**
 * The consent record for camera and video analysis. It holds only two booleans
 * and timestamps: no video, no keypoints, nothing about the body. Pure; storage
 * is handled by ConsentProvider.
 *
 * Two scopes, because they are different data flows:
 *   local   frames are processed in this browser only (Form Coach, in-browser detection)
 *   upload  the video is sent to the analysis backend (backend video mode)
 */

export const CONSENT_KEY = 'farai_consent_v1';
/** Bump when the wording changes materially: everyone is asked again. */
export const CONSENT_VERSION = 1;

export type ConsentKind = 'local' | 'upload';

export interface ConsentRecord {
  version: number;
  /** "I am 18 or older." */
  age18: boolean;
  /** Exercise / software disclaimer accepted. */
  disclaimer: boolean;
  localAt?: string;
  uploadAt?: string;
}

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** A stored value, or null if it is missing, malformed or from an older wording. */
export function parseConsent(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || v.version !== CONSENT_VERSION) return null;
    return {
      version: CONSENT_VERSION,
      age18: v.age18 === true,
      disclaimer: v.disclaimer === true,
      localAt: isIso(v.localAt) ? v.localAt : undefined,
      uploadAt: isIso(v.uploadAt) ? v.uploadAt : undefined,
    };
  } catch {
    return null;
  }
}

export function hasConsent(rec: ConsentRecord | null, kind: ConsentKind): boolean {
  if (!rec || !rec.age18 || !rec.disclaimer) return false;
  return Boolean(kind === 'local' ? rec.localAt : rec.uploadAt);
}

/** The record after the visitor accepts `kind` (both checkboxes must have been ticked). */
export function grantConsent(rec: ConsentRecord | null, kind: ConsentKind, now: Date = new Date()): ConsentRecord {
  const at = now.toISOString();
  return {
    ...(rec ?? { version: CONSENT_VERSION, age18: true, disclaimer: true }),
    version: CONSENT_VERSION,
    age18: true,
    disclaimer: true,
    ...(kind === 'local' ? { localAt: at } : { uploadAt: at }),
  };
}
