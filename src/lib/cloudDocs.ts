/**
 * What goes to the cloud, and what is accepted back. Pure functions (no Firebase, no DOM).
 *
 * Every outgoing document is rebuilt from the app's own sanitisers, so only the known fitness
 * fields can leave the device: profile, plan and targets, workouts with their sets, meals, weigh-ins
 * and pinned cues. On top of that a guard refuses anything that looks like camera or body data
 * (image/video data, binary buffers, keypoint-like keys, long numeric vectors), so a frame or a
 * biometric vector cannot be uploaded even by mistake. Incoming documents are sanitised the same way.
 */
import { Athlete, Meal, Session, Settings, WeightEntry, MAX_CUE_LENGTH, cleanSession } from '../utils/fitness';
import { cleanAthlete, cleanCues, cleanMeal, cleanSettings, cleanWeight } from '../utils/fitnessDb';
import type { Coll } from './cloud';

export const CLOUD_SCHEMA = 1;
export type PrefId = 'settings' | 'cues' | 'athlete';
export const PREF_IDS: readonly PrefId[] = ['settings', 'cues', 'athlete'];

// --- The biometric / media guard ---------------------------------------------------------------

const FORBIDDEN_KEY = /landmark|keypoint|embedding|biometric|faceprint|descriptor|pixel|image|video|snapshot|frames?$/i;
const MAX_STRING = 2000;
const MAX_NUMBER_ARRAY = 64;

/**
 * A reason the value must not be uploaded, or null if it is fine. Looks for binary data, image and
 * video data URLs, very long strings, long arrays of numbers (a keypoint or embedding vector) and
 * object keys that name that kind of data.
 */
export function findForbidden(value: unknown, path = '', checkKeys = true): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (/^data:(image|video|audio|application\/octet)/i.test(value)) return `${path || 'value'} is a media data URL`;
    if (value.length > MAX_STRING) return `${path || 'value'} is a very long string`;
    return null;
  }
  if (typeof value !== 'object') return null;
  if ((typeof Blob !== 'undefined' && value instanceof Blob) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return `${path || 'value'} is binary data`;
  if (typeof ImageData !== 'undefined' && value instanceof ImageData) return `${path || 'value'} is image data`;
  if (Array.isArray(value)) {
    if (value.length > MAX_NUMBER_ARRAY && value.every((v) => typeof v === 'number')) return `${path || 'value'} is a long numeric vector`;
    for (let i = 0; i < value.length; i++) {
      const r = findForbidden(value[i], `${path}[${i}]`, checkKeys);
      if (r) return r;
    }
    return null;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (checkKeys && FORBIDDEN_KEY.test(k)) return `${path}.${k} looks like media or body data`;
    const r = findForbidden(v, path ? `${path}.${k}` : k, checkKeys);
    if (r) return r;
  }
  return null;
}

// --- Canonical form (so "did this change?" is a string compare) ---------------------------------

export function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val
  );
}

// --- Local value -> cloud document ----------------------------------------------------------------

export type ToCloud = { ok: true; id: string; data: Record<string, unknown> } | { ok: false; reason: string };

const strip = (o: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(o)); // drops undefined, which Firestore rejects

/** The document to store for a local value, or why it was refused. `id` is the doc id for prefs. */
export function toCloudDoc(coll: Coll, value: unknown, prefId?: PrefId): ToCloud {
  let id = '';
  let data: Record<string, unknown> | null = null;
  let checkKeys = true;

  if (coll === 'sessions') {
    const s = cleanSession(value);
    if (s) ({ id, data } = { id: s.id, data: strip(s) });
  } else if (coll === 'meals') {
    const m = cleanMeal(value);
    if (m) ({ id, data } = { id: m.id, data: strip(m) });
  } else if (coll === 'weights') {
    const w = cleanWeight(value);
    if (w) ({ id, data } = { id: w.date, data: strip(w) });
  } else if (prefId === 'settings') {
    data = strip(cleanSettings(value));
    id = 'settings';
  } else if (prefId === 'athlete') {
    const a = cleanAthlete(value);
    if (a) ({ id, data } = { id: 'athlete', data: strip(a) });
  } else if (prefId === 'cues') {
    // Stored as a list of pairs: exercise names are free text and make awkward map keys.
    const cues = cleanCues(value, {});
    data = { items: Object.entries(cues).map(([k, v]) => ({ k, v: v.slice(0, MAX_CUE_LENGTH) })) };
    id = 'cues';
    checkKeys = true; // keys are the fixed names "items", "k", "v": the exercise names are values
  }

  if (!data || !id) return { ok: false, reason: 'not a valid fitness record' };
  const forbidden = findForbidden(data, '', checkKeys);
  if (forbidden) return { ok: false, reason: `refused to upload: ${forbidden}` };
  return { ok: true, id, data: { ...data, _schema: CLOUD_SCHEMA } };
}

// --- Cloud document -> local value -------------------------------------------------------------------

export type FromCloud =
  | { coll: 'sessions'; value: Session }
  | { coll: 'meals'; value: Meal }
  | { coll: 'weights'; value: WeightEntry }
  | { coll: 'prefs'; pref: 'settings'; value: Settings }
  | { coll: 'prefs'; pref: 'cues'; value: Record<string, string> }
  | { coll: 'prefs'; pref: 'athlete'; value: Athlete };

/** A sanitised local value from a cloud document, or null if it is not usable. */
export function fromCloudDoc(coll: Coll, id: string, data: Record<string, unknown>): FromCloud | null {
  if (findForbidden(data) || (id.length > 120)) return null;
  const d = { ...data };
  delete d._schema;
  if (coll === 'sessions') {
    const s = cleanSession({ ...d, id });
    return s ? { coll, value: s } : null;
  }
  if (coll === 'meals') {
    const m = cleanMeal({ ...d, id });
    return m ? { coll, value: m } : null;
  }
  if (coll === 'weights') {
    const w = cleanWeight({ ...d, date: typeof d.date === 'string' ? d.date : id });
    return w ? { coll, value: w } : null;
  }
  if (id === 'settings') return { coll: 'prefs', pref: 'settings', value: cleanSettings(d) };
  if (id === 'athlete') {
    const a = cleanAthlete(d);
    return a ? { coll: 'prefs', pref: 'athlete', value: a } : null;
  }
  if (id === 'cues') {
    const items = Array.isArray(d.items) ? d.items : [];
    const obj: Record<string, string> = {};
    for (const it of items.slice(0, 300)) if (it && typeof it.k === 'string' && typeof it.v === 'string') obj[it.k] = it.v;
    return { coll: 'prefs', pref: 'cues', value: cleanCues(obj, {}) };
  }
  return null;
}

// --- Merge planning ---------------------------------------------------------------------------------------

/**
 * Compare two sets of documents by canonical form. `toLocal`: ids to copy cloud -> device (missing
 * here, or different, when the cloud wins). `toCloud`: ids to copy device -> cloud (missing there).
 */
export function planReconcile(local: ReadonlyMap<string, string>, cloud: ReadonlyMap<string, string>): { toLocal: string[]; toCloud: string[] } {
  const toLocal: string[] = [];
  const toCloud: string[] = [];
  for (const [id, c] of cloud) if (!local.has(id) || local.get(id) !== c) toLocal.push(id);
  for (const id of local.keys()) if (!cloud.has(id)) toCloud.push(id);
  return { toLocal, toCloud };
}
