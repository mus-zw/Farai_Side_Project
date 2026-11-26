/**
 * IndexedDB storage for the Fitness module, via Dexie.
 *
 *   sessions  saved workouts (exercises and sets embedded)
 *   meals     one row per meal, with its date
 *   weights   one weigh-in per day
 *   kv        settings, the in-progress session ("draft"), and flags
 *
 * First run: if the old localStorage log (farai_fitness_v1) exists it is
 * imported once (and left in place); otherwise sample data is seeded so a
 * guest sees a working, filled-in app. Everything stays in this browser.
 */
import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'react';
import {
  DAY_TYPES,
  DEFAULT_CUES,
  DEFAULT_SETTINGS,
  DEFAULT_TARGETS,
  DayType,
  Athlete,
  Goal,
  MAX_CUE_LENGTH,
  Meal,
  Session,
  SetEntry,
  Schedule,
  Settings,
  Unit,
  WeightEntry,
  cleanAthleteName,
  cueKey,
  cleanSession,
  clampNum,
  countedSets,
  deriveTargets,
  isObj,
  kcalFromMacros,
  newId,
  newSession,
  num,
  parseFitnessData,
  shiftDate,
  str,
  toISODate,
} from './fitness';
import { estimate1RM, parseCSV, toCSV } from './fitnessMath';
import { cleanFormSet, type FormSetSummary } from './poseMath';

interface KV {
  key: string;
  value: unknown;
}

class FitnessDB extends Dexie {
  sessions!: Table<Session, string>;
  meals!: Table<Meal, string>;
  weights!: Table<WeightEntry, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('farai_fitness');
    this.version(1).stores({
      sessions: 'id, date, day',
      meals: 'id, date',
      weights: 'date',
      kv: 'key',
    });
  }
}

export const db = new FitnessDB();

// Dexie does not fire per-row hooks for Table.clear(), so operations that clear and rewrite many rows
// announce themselves here. Cloud sync listens and mirrors the result (see lib/fitnessSync.ts).
const bulkListeners = new Set<() => void>();
export function onBulkChange(cb: () => void): () => void {
  bulkListeners.add(cb);
  return () => bulkListeners.delete(cb);
}
const notifyBulkChange = () => bulkListeners.forEach((l) => l());

const LEGACY_KEY = 'farai_fitness_v1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- Cleaning (never trust stored or imported data) -----------------------------------------

export function cleanMeal(v: unknown, fallbackDate?: string): Meal | null {
  if (!isObj(v)) return null;
  const date = typeof v.date === 'string' && DATE_RE.test(v.date) ? v.date : fallbackDate;
  if (!date) return null;
  const protein = clampNum(v.protein, 0, 1000);
  const carbs = clampNum(v.carbs, 0, 2000);
  const fat = clampNum(v.fat, 0, 1000);
  let kcal = clampNum(v.kcal, 0, 20000);
  if (!kcal) kcal = kcalFromMacros(protein, carbs, fat);
  return { id: str(v.id, newId(), 40), date, name: str(v.name, 'Meal', 60), kcal, protein, carbs, fat };
}

export function cleanWeight(v: unknown): WeightEntry | null {
  if (!isObj(v) || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return null;
  const value = clampNum(v.value, 0, 700);
  return value > 0 ? { date: v.date, value } : null;
}

export function cleanSettings(v: unknown): Settings {
  const o = isObj(v) ? v : {};
  const t = isObj(o.targets) ? o.targets : {};
  const goals: Goal[] = ['lose', 'maintain', 'gain'];
  return {
    unit: o.unit === 'lb' ? 'lb' : 'kg',
    schedule: o.schedule === 'ppl3' ? 'ppl3' : 'ppl6',
    goal: goals.includes(o.goal as Goal) ? (o.goal as Goal) : DEFAULT_SETTINGS.goal,
    restSeconds: Math.min(600, Math.max(15, Math.round(clampNum(o.restSeconds, DEFAULT_SETTINGS.restSeconds, 600)))),
    autoRest: o.autoRest !== false,
    goalWeight: Math.round(clampNum(o.goalWeight, 0, 700) * 10) / 10,
    targets: {
      kcal: clampNum(t.kcal, DEFAULT_TARGETS.kcal, 20000),
      protein: clampNum(t.protein, DEFAULT_TARGETS.protein, 1000),
      carbs: clampNum(t.carbs, DEFAULT_TARGETS.carbs, 2000),
      fat: clampNum(t.fat, DEFAULT_TARGETS.fat, 1000),
      meals: Math.round(clampNum(t.meals, DEFAULT_TARGETS.meals, 12)),
    },
  };
}

// --- Settings and draft -----------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  return cleanSettings((await db.kv.get('settings'))?.value);
}

export async function saveSettings(next: Settings): Promise<void> {
  await db.kv.put({ key: 'settings', value: cleanSettings(next) });
}

export type SettingsPatch = Partial<Omit<Settings, 'targets'>> & { targets?: Partial<Settings['targets']> };

/**
 * Change some settings. The read-merge-write runs in one transaction, so quick
 * successive changes (tap a split, then a unit) never overwrite each other the
 * way merging against a cached copy would.
 */
export async function patchSettings(patch: SettingsPatch): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = cleanSettings((await db.kv.get('settings'))?.value);
    await db.kv.put({ key: 'settings', value: cleanSettings({ ...current, ...patch, targets: { ...current.targets, ...patch.targets } }) });
  });
}

// --- Athlete profile ---------------------------------------------------------------------------------

export function cleanAthlete(v: unknown): Athlete | null {
  if (!isObj(v)) return null;
  const name = cleanAthleteName(v.name);
  if (!name) return null;
  return { name, mode: v.mode === 'guest' ? 'guest' : 'athlete', createdAt: clampNum(v.createdAt, Date.now(), Number.MAX_SAFE_INTEGER) };
}

/** The saved athlete, or null before onboarding has been completed. */
export async function getAthlete(): Promise<Athlete | null> {
  return cleanAthlete((await db.kv.get('athlete'))?.value);
}

export async function renameAthlete(name: string): Promise<void> {
  const current = await getAthlete();
  const clean = cleanAthleteName(name);
  if (!current || !clean) return;
  await db.kv.put({ key: 'athlete', value: { ...current, name: clean } });
}

export interface OnboardingInput {
  name: string;
  schedule: Schedule;
  unit: Unit;
  kcal: number;
  protein: number;
  meals: number;
}

/** Finish onboarding with a real profile: an empty log with the chosen plan, units and targets. */
export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const name = cleanAthleteName(input.name);
  if (!name) throw new Error('Enter a name or handle to continue.');
  const settings = cleanSettings({ ...DEFAULT_SETTINGS, unit: input.unit, schedule: input.schedule, targets: deriveTargets(input.kcal, input.protein, input.meals) });
  await db.transaction('rw', db.sessions, db.meals, db.weights, db.kv, async () => {
    await Promise.all([db.sessions.clear(), db.meals.clear(), db.weights.clear(), db.kv.clear()]);
    await db.kv.bulkPut([
      { key: 'athlete', value: { name, mode: 'athlete', createdAt: Date.now() } satisfies Athlete },
      { key: 'settings', value: settings },
      { key: 'cues', value: DEFAULT_CUES },
      { key: 'seeded', value: false },
      { key: 'initialized', value: true },
    ]);
  });
}

/** Continue as a guest: sample data, default settings, no setup. */
export async function continueAsGuest(): Promise<void> {
  await seedSampleData();
  await db.kv.put({ key: 'athlete', value: { name: 'Guest', mode: 'guest', createdAt: Date.now() } satisfies Athlete });
}

/**
 * Clear everything logged (sessions, meals, weigh-ins, the session in progress,
 * and any sample data) but keep the profile, plan, units and targets. A guest
 * becomes a regular athlete, since they are now logging their own data.
 */
export async function startFresh(): Promise<void> {
  await db.transaction('rw', db.sessions, db.meals, db.weights, db.kv, async () => {
    await Promise.all([db.sessions.clear(), db.meals.clear(), db.weights.clear(), db.kv.delete('draft'), db.kv.delete(FORMSETS_KEY)]);
    await db.kv.put({ key: 'seeded', value: false });
    const a = cleanAthlete((await db.kv.get('athlete'))?.value);
    if (a?.mode === 'guest') await db.kv.put({ key: 'athlete', value: { ...a, name: 'Athlete', mode: 'athlete' } satisfies Athlete });
  });
  notifyBulkChange();
}

/** Remove the profile and all data; the next screen is onboarding again. */
export async function resetEverything(): Promise<void> {
  await db.transaction('rw', db.sessions, db.meals, db.weights, db.kv, async () => {
    await Promise.all([db.sessions.clear(), db.meals.clear(), db.weights.clear(), db.kv.clear()]);
  });
}

/** Pinned exercise cues. Falls back to the built-in starting cues until you save your own. */
export async function getCues(): Promise<Record<string, string>> {
  return cleanCues((await db.kv.get('cues'))?.value, DEFAULT_CUES);
}

/** Pin (or, with empty text, unpin) a cue on an exercise. */
export async function setCue(exerciseName: string, text: string): Promise<void> {
  const cues = { ...(await getCues()) };
  const key = cueKey(exerciseName);
  const clean = text.trim().slice(0, MAX_CUE_LENGTH);
  if (clean) cues[key] = clean;
  else delete cues[key];
  await db.kv.put({ key: 'cues', value: cues });
}

export function cleanCues(v: unknown, fallback: Record<string, string> = {}): Record<string, string> {
  if (!isObj(v)) return fallback;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v).slice(0, 300)) {
    const key = k.trim().toLowerCase().slice(0, 80);
    const text = typeof val === 'string' ? val.trim().slice(0, MAX_CUE_LENGTH) : '';
    if (key && text) out[key] = text;
  }
  return out;
}

export async function getDraft(): Promise<Session | null> {
  return cleanSession((await db.kv.get('draft'))?.value);
}

export async function saveDraft(draft: Session | null): Promise<void> {
  if (draft) await db.kv.put({ key: 'draft', value: draft });
  else await db.kv.delete('draft');
}

export async function isSeeded(): Promise<boolean> {
  return (await db.kv.get('seeded'))?.value === true;
}

// --- Sample data (guest) -----------------------------------------------------------------------------

// A tiny deterministic generator, so the sample data is the same every time.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BASE_KG: [RegExp, number][] = [
  [/squat/, 100], [/romanian|deadlift/, 100], [/leg press/, 160], [/leg curl|leg extension/, 45], [/calf/, 70],
  [/bench/, 80], [/incline/, 28], [/overhead press|press/, 50], [/lateral/, 10], [/pushdown|extension/, 30],
  [/row/, 70], [/pull-up|pulldown/, 60], [/face pull/, 25], [/curl/, 30],
];
const baseFor = (name: string) => BASE_KG.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 30;

function sampleSessions(today: string): Session[] {
  const rand = rng(7);
  const out: Session[] = [];
  const plan: Record<number, DayType> = { 1: 'push', 2: 'pull', 3: 'legs', 4: 'push', 5: 'pull', 6: 'legs' };
  for (let back = 27; back >= 1; back--) {
    const date = shiftDate(today, -back);
    const [y, m, d] = date.split('-').map(Number);
    const day = plan[new Date(y, m - 1, d).getDay()];
    if (!day || rand() < 0.15) continue; // a rest day, or a missed one
    const week = Math.floor((27 - back) / 7); // a little progress each week
    const s = newSession(day, date);
    s.exercises = s.exercises.map((ex, exIdx) => {
      const base = Math.round((baseFor(ex.name) + week * 1.25) / 2.5) * 2.5;
      const lo = Number(ex.target?.split('-')[0]) || 8;
      const sets: SetEntry[] = Array.from({ length: 3 }, (_, i) => ({
        weight: String(base),
        reps: String(lo + Math.floor(rand() * 3) - (i === 2 ? 1 : 0)),
        done: true,
        type: 'normal',
      }));
      if (exIdx === 0) sets.unshift({ weight: String(Math.round((base * 0.6) / 2.5) * 2.5), reps: '8', done: true, type: 'warmup' });
      return { ...ex, sets };
    });
    s.savedAt = Date.parse(`${date}T18:00:00`);
    out.push(s);
  }
  return out;
}

function sampleMeals(today: string): Meal[] {
  const rand = rng(11);
  const out: Meal[] = [];
  const names = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Evening snack'];
  for (let back = 20; back >= 0; back--) {
    if (back % 9 === 5) continue; // a day nothing was logged
    const date = shiftDate(today, -back);
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const protein = Math.round(25 + rand() * 20);
      const carbs = Math.round(45 + rand() * 40);
      const fat = Math.round(12 + rand() * 14);
      out.push({ id: newId(), date, name: names[i], protein, carbs, fat, kcal: kcalFromMacros(protein, carbs, fat) });
    }
  }
  return out;
}

function sampleWeights(today: string): WeightEntry[] {
  const rand = rng(3);
  const out: WeightEntry[] = [];
  for (let back = 27; back >= 0; back--) {
    if (back % 5 === 3) continue;
    const trend = 82 - (0.45 * (27 - back)) / 7;
    out.push({ date: shiftDate(today, -back), value: Math.round((trend + (rand() - 0.5) * 1.2) * 10) / 10 });
  }
  return out;
}

/** Replace everything with sample data, as a guest would see on first visit. */
export async function seedSampleData(): Promise<void> {
  const today = toISODate();
  await db.transaction('rw', db.sessions, db.meals, db.weights, db.kv, async () => {
    // Sample data replaces the logs only: who you are and your plan, units and targets stay.
    const athlete = await db.kv.get('athlete');
    const settings = await db.kv.get('settings');
    await Promise.all([db.sessions.clear(), db.meals.clear(), db.weights.clear(), db.kv.clear()]);
    if (athlete) await db.kv.put(athlete);
    await db.sessions.bulkPut(sampleSessions(today));
    await db.meals.bulkPut(sampleMeals(today));
    await db.weights.bulkPut(sampleWeights(today));
    await db.kv.bulkPut([
      { key: 'settings', value: settings ? cleanSettings(settings.value) : DEFAULT_SETTINGS },
      { key: 'cues', value: DEFAULT_CUES },
      { key: 'seeded', value: true },
      { key: 'initialized', value: true },
    ]);
  });
}

/** One-time import of the old localStorage log. Returns true if there was anything to import. */
async function migrateLegacy(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const old = parseFitnessData(raw);
  const meals: Meal[] = [];
  for (const [date, list] of Object.entries(old.meals)) {
    for (const m of list) {
      const clean = cleanMeal(m, date);
      if (clean) meals.push(clean);
    }
  }
  // A lone empty draft is not worth keeping over the sample data: only real history counts.
  if (!old.sessions.length && !meals.length) return false;
  await db.transaction('rw', db.sessions, db.meals, db.kv, async () => {
    await db.sessions.bulkPut(old.sessions);
    await db.meals.bulkPut(meals);
    if (old.draft) await db.kv.put({ key: 'draft', value: old.draft });
    await db.kv.bulkPut([
      { key: 'settings', value: cleanSettings({ unit: old.unit, schedule: old.schedule, targets: old.targets }) },
      { key: 'cues', value: DEFAULT_CUES },
      { key: 'seeded', value: false },
      { key: 'initialized', value: true },
    ]);
  });
  return true;
}

let initPromise: Promise<void> | null = null;

/**
 * Open the database and run first-run setup once. Rejects if IndexedDB is
 * unavailable. A first-time visitor is NOT given sample data here: the
 * onboarding screen asks whether to create a profile or continue as a guest.
 * Anyone who already has data (the old localStorage log, or a database from an
 * earlier version of this page) is carried straight through with a profile.
 */
export function initFitnessDb(): Promise<void> {
  initPromise ??= (async () => {
    await db.open();
    const initialized = (await db.kv.get('initialized'))?.value === true;
    if (!initialized && (await migrateLegacy())) {
      await db.kv.put({ key: 'athlete', value: { name: 'Athlete', mode: 'athlete', createdAt: Date.now() } satisfies Athlete });
      return;
    }
    if (initialized && !(await getAthlete())) {
      const guest = (await db.kv.get('seeded'))?.value === true;
      await db.kv.put({ key: 'athlete', value: { name: guest ? 'Guest' : 'Athlete', mode: guest ? 'guest' : 'athlete', createdAt: Date.now() } satisfies Athlete });
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

// --- Backup: JSON and CSV ---------------------------------------------------------------------------------

export interface Backup {
  app: 'farai-fitness';
  version: 2;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
  meals: Meal[];
  weights: WeightEntry[];
  /** Pinned exercise cues. Absent in older backups. */
  cues?: Record<string, string>;
}

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export async function exportBackup(): Promise<Backup> {
  const [settings, cues, sessions, meals, weights] = await Promise.all([
    getSettings(),
    getCues(),
    db.sessions.orderBy('date').toArray(),
    db.meals.orderBy('date').toArray(),
    db.weights.orderBy('date').toArray(),
  ]);
  return { app: 'farai-fitness', version: 2, exportedAt: new Date().toISOString(), settings, sessions, meals, weights, cues };
}

export interface ImportSummary {
  sessions: number;
  meals: number;
  weights: number;
  skipped: number;
}

/**
 * Replace the database with a backup file's contents. Everything is validated
 * and sanitised first; anything malformed is skipped and counted, and a file
 * that is not one of ours is rejected before anything is touched.
 */
export async function importBackup(json: unknown): Promise<ImportSummary> {
  if (!isObj(json) || json.app !== 'farai-fitness' || ![1, 2].includes(Number(json.version))) {
    throw new Error('This is not a Farai Fitness backup file.');
  }
  let skipped = 0;
  const pick = <T,>(list: unknown, clean: (v: unknown) => T | null, max: number): T[] => {
    const out: T[] = [];
    for (const v of (Array.isArray(list) ? list : []).slice(0, max)) {
      const c = clean(v);
      if (c) out.push(c);
      else skipped += 1;
    }
    return out;
  };
  const sessions = pick(json.sessions, cleanSession, 2000);
  const meals = pick(json.meals, (v) => cleanMeal(v), 20000);
  const weights = pick(json.weights, cleanWeight, 5000);
  const settings = cleanSettings(json.settings);
  const cues = cleanCues(json.cues, DEFAULT_CUES);

  await db.transaction('rw', db.sessions, db.meals, db.weights, db.kv, async () => {
    const athlete = await db.kv.get('athlete'); // restoring a backup does not change who you are
    await Promise.all([db.sessions.clear(), db.meals.clear(), db.weights.clear(), db.kv.clear()]);
    if (athlete) await db.kv.put(athlete);
    await db.sessions.bulkPut(sessions);
    await db.meals.bulkPut(meals);
    await db.weights.bulkPut(weights);
    await db.kv.bulkPut([
      { key: 'settings', value: settings },
      { key: 'cues', value: cues },
      { key: 'seeded', value: false },
      { key: 'initialized', value: true },
    ]);
  });
  notifyBulkChange();
  return { sessions: sessions.length, meals: meals.length, weights: weights.length, skipped };
}

export interface CsvImportSummary {
  kind: 'workouts' | 'nutrition' | 'weight';
  added: number;
  skipped: number;
}

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_CSV_ROWS = 50000;

/**
 * Add rows from a CSV exported by this app (workouts, nutrition or body
 * weight; the header decides which). Unlike the JSON restore this ADDS to what
 * is there: workouts on a date and day you already have, and identical meals,
 * are skipped so importing your own export twice does not duplicate it.
 */
export async function importCsv(text: string): Promise<CsvImportSummary> {
  const rows = parseCSV(text).slice(0, MAX_CSV_ROWS + 1);
  if (rows.length < 2) throw new Error('That CSV has no data rows.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h === name || h.startsWith(name + '_'));
  const data = rows.slice(1);
  let skipped = 0;

  if (col('exercise') >= 0 && col('day') >= 0 && col('reps') >= 0) {
    const [iDate, iDay, iEx, iType, iW, iR] = [col('date'), col('day'), col('exercise'), col('type'), col('weight'), col('reps')];
    const existing = new Set((await db.sessions.toArray()).map((s) => `${s.date}|${s.day}`));
    const groups = new Map<string, Session>();
    for (const r of data) {
      const date = r[iDate]?.trim();
      const day = r[iDay]?.trim().toLowerCase();
      const name = r[iEx]?.trim().slice(0, 80);
      if (!date || !DATE_RE.test(date) || !DAY_TYPES.includes(day as DayType) || !name || existing.has(`${date}|${day}`)) {
        skipped += 1;
        continue;
      }
      const key = `${date}|${day}`;
      let s = groups.get(key);
      if (!s) {
        s = { id: newId(), date, day: day as DayType, exercises: [], notes: '', savedAt: Date.parse(`${date}T12:00:00`) || Date.now() };
        groups.set(key, s);
      }
      let ex = s.exercises.find((e) => e.name === name);
      if (!ex) {
        ex = { id: newId(), name, sets: [] };
        s.exercises.push(ex);
      }
      const type = ['normal', 'warmup', 'drop', 'failure'].includes(r[iType]) ? (r[iType] as SetEntry['type']) : 'normal';
      ex.sets.push({ weight: String(num(r[iW] ?? '') || ''), reps: String(Math.round(num(r[iR] ?? ''))), done: true, type });
    }
    const sessions = [...groups.values()].map((s) => cleanSession(s)).filter((s): s is Session => s !== null);
    await db.sessions.bulkPut(sessions);
    return { kind: 'workouts', added: sessions.length, skipped };
  }

  if (col('meal') >= 0 && col('kcal') >= 0) {
    const [iDate, iName, iK, iP, iC, iF] = [col('date'), col('meal'), col('kcal'), col('protein'), col('carbs'), col('fat')];
    const have = new Set((await db.meals.toArray()).map((m) => `${m.date}|${m.name}|${m.kcal}`));
    const meals: Meal[] = [];
    for (const r of data) {
      const m = cleanMeal({ date: r[iDate]?.trim(), name: r[iName], kcal: num(r[iK] ?? ''), protein: num(r[iP] ?? ''), carbs: num(r[iC] ?? ''), fat: num(r[iF] ?? '') });
      if (!m || have.has(`${m.date}|${m.name}|${m.kcal}`)) {
        skipped += 1;
        continue;
      }
      have.add(`${m.date}|${m.name}|${m.kcal}`);
      meals.push(m);
    }
    await db.meals.bulkPut(meals);
    return { kind: 'nutrition', added: meals.length, skipped };
  }

  if (col('weight') >= 0 && col('date') >= 0) {
    const [iDate, iW] = [col('date'), col('weight')];
    const weights: WeightEntry[] = [];
    for (const r of data) {
      const w = cleanWeight({ date: r[iDate]?.trim(), value: num(r[iW] ?? '') });
      if (w) weights.push(w);
      else skipped += 1;
    }
    await db.weights.bulkPut(weights); // one weigh-in per day: the same date is replaced
    return { kind: 'weight', added: weights.length, skipped };
  }

  throw new Error('Unrecognised CSV. Import a workouts, nutrition or body weight CSV exported from this app.');
}

/** One row per done set. */
export function workoutsCsv(sessions: readonly Session[], unit: string): string {
  const rows: (string | number)[][] = [['date', 'day', 'exercise', 'set', 'type', `weight_${unit}`, 'reps', `volume_${unit}`, `est_1rm_${unit}`]];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      countedSets(ex).forEach((set, i) => {
        const w = num(set.weight);
        const r = num(set.reps);
        const e = set.type === 'warmup' ? null : estimate1RM(w, r);
        rows.push([s.date, s.day, ex.name, i + 1, set.type, w, r, set.type === 'warmup' ? 0 : w * r, e ? Math.round(e.average * 10) / 10 : '']);
      });
    }
  }
  return toCSV(rows);
}

export function nutritionCsv(meals: readonly Meal[]): string {
  return toCSV([['date', 'meal', 'kcal', 'protein_g', 'carbs_g', 'fat_g'], ...meals.map((m) => [m.date, m.name, m.kcal, m.protein, m.carbs, m.fat])]);
}

export function weightsCsv(weights: readonly WeightEntry[], unit: string): string {
  return toCSV([['date', `weight_${unit}`], ...weights.map((w) => [w.date, w.value])]);
}

/** Saved sessions, newest first (ties on a date broken by when they were saved). */
export async function sessionsNewestFirst(): Promise<Session[]> {
  return (await db.sessions.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.savedAt - a.savedAt);
}

// --- React: live queries ---------------------------------------------------------------------------------------

/** Re-renders with the result of a Dexie query whenever the data it reads changes. */
export function useLive<T>(querier: () => Promise<T> | T, deps: readonly unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({ next: setValue, error: () => undefined });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

export { DAY_TYPES };

// --- Form Coach set summaries ----------------------------------------------------------------------------

/**
 * What the Form Coach keeps after a set: counts, depth and tempo, a few cues. Kept in the local key-value
 * store under a key that is not one of the synced preferences, so it stays on this device and is never
 * sent to the cloud. It holds no image, landmark or angle series, only the summary numbers.
 */
const FORMSETS_KEY = 'formsets';
const MAX_FORMSETS = 100;

export interface StoredFormSet extends FormSetSummary {
  id: string;
}

const readFormSets = async (): Promise<StoredFormSet[]> => {
  const raw = (await db.kv.get(FORMSETS_KEY))?.value;
  if (!Array.isArray(raw)) return [];
  const out: StoredFormSet[] = [];
  for (const r of raw) {
    const clean = cleanFormSet(r);
    const id = r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string' ? (r as { id: string }).id.slice(0, 40) : null;
    if (clean && id) out.push({ ...clean, id });
  }
  return out;
};

/** Saved sets, newest first. */
export async function getFormSets(): Promise<StoredFormSet[]> {
  return (await readFormSets()).sort((a, b) => b.at - a.at);
}

/** Keep a set (the newest 100 are kept) and return its id. */
export async function saveFormSet(summary: FormSetSummary): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.kv, async () => {
    const all = await readFormSets();
    const next = [...all, { ...summary, id }].sort((a, b) => a.at - b.at).slice(-MAX_FORMSETS);
    await db.kv.put({ key: FORMSETS_KEY, value: next });
  });
  return id;
}

export async function deleteFormSet(id: string): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: FORMSETS_KEY, value: (await readFormSets()).filter((s) => s.id !== id) });
  });
}

export async function clearFormSets(): Promise<void> {
  await db.kv.delete(FORMSETS_KEY);
}
