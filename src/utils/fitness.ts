/**
 * Data model and pure helpers for the Fitness page: a Push/Pull/Legs plan, a
 * session logger and a daily nutrition tracker. No DOM and no React here.
 * Everything is stored in localStorage by useFitnessData; nothing leaves the browser.
 */

export type DayType = 'push' | 'pull' | 'legs';
export type Unit = 'kg' | 'lb';
export type Schedule = 'ppl6' | 'ppl3';

export const DAY_TYPES: readonly DayType[] = ['push', 'pull', 'legs'];
export const DAY_LABEL: Record<DayType, string> = { push: 'Push', pull: 'Pull', legs: 'Legs' };
export const DAY_FOCUS: Record<DayType, string> = {
  push: 'Chest, shoulders, triceps',
  pull: 'Back, rear delts, biceps',
  legs: 'Quads, hamstrings, glutes, calves',
};

export interface SetEntry {
  /** Kept as text while editing; parsed with num(). */
  weight: string;
  reps: string;
  done: boolean;
}
export interface ExerciseLog {
  id: string;
  name: string;
  /** Suggested rep range, shown as a hint. */
  target?: string;
  sets: SetEntry[];
}
export interface Session {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  day: DayType;
  exercises: ExerciseLog[];
  notes: string;
  savedAt: number;
}
export interface Meal {
  id: string;
  name: string;
  kcal: number;
  protein: number;
}
export interface Targets {
  kcal: number;
  protein: number;
  meals: number;
}
export interface FitnessData {
  version: 1;
  unit: Unit;
  schedule: Schedule;
  targets: Targets;
  sessions: Session[];
  meals: Record<string, Meal[]>;
  /** The session being logged right now, kept so a reload does not lose it. */
  draft: Session | null;
}

// Starting points, meant to be edited. Not medical or dietary advice.
export const DEFAULT_TARGETS: Targets = { kcal: 2500, protein: 150, meals: 4 };

export const DEFAULT_DATA: FitnessData = {
  version: 1,
  unit: 'kg',
  schedule: 'ppl6',
  targets: DEFAULT_TARGETS,
  sessions: [],
  meals: {},
  draft: null,
};

const TEMPLATE: Record<DayType, { name: string; target: string }[]> = {
  push: [
    { name: 'Barbell Bench Press', target: '5-8' },
    { name: 'Overhead Press', target: '6-10' },
    { name: 'Incline Dumbbell Press', target: '8-12' },
    { name: 'Lateral Raise', target: '12-20' },
    { name: 'Triceps Pushdown', target: '10-15' },
    { name: 'Overhead Triceps Extension', target: '10-15' },
  ],
  pull: [
    { name: 'Pull-up or Lat Pulldown', target: '6-10' },
    { name: 'Barbell Row', target: '6-10' },
    { name: 'Seated Cable Row', target: '8-12' },
    { name: 'Face Pull', target: '12-20' },
    { name: 'Barbell Curl', target: '8-12' },
    { name: 'Hammer Curl', target: '10-15' },
  ],
  legs: [
    { name: 'Back Squat', target: '5-8' },
    { name: 'Romanian Deadlift', target: '6-10' },
    { name: 'Leg Press', target: '10-15' },
    { name: 'Leg Curl', target: '10-15' },
    { name: 'Leg Extension', target: '12-15' },
    { name: 'Standing Calf Raise', target: '10-20' },
  ],
};

/** Weekday suggestions (0 = Sunday) for each schedule. Missing = rest day. */
const WEEK: Record<Schedule, Partial<Record<number, DayType>>> = {
  ppl6: { 1: 'push', 2: 'pull', 3: 'legs', 4: 'push', 5: 'pull', 6: 'legs' },
  ppl3: { 1: 'push', 3: 'pull', 5: 'legs' },
};
export const SCHEDULE_LABEL: Record<Schedule, string> = {
  ppl6: '6 days: PPL twice a week',
  ppl3: '3 days: PPL once a week',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekPlan(schedule: Schedule): { weekday: string; day: DayType | null }[] {
  // Monday first.
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ weekday: WEEKDAYS[d], day: WEEK[schedule][d] ?? null }));
}

// --- Small helpers ---------------------------------------------------------------

export const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the visitor's day). */
export function toISODate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** A non-negative number from text; empty or invalid is 0. Accepts "7,5". */
export function num(text: string | number): number {
  const n = typeof text === 'number' ? text : parseFloat(String(text).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function blankSet(): SetEntry {
  return { weight: '', reps: '', done: false };
}

export function newExercise(name: string, target?: string, sets = 3): ExerciseLog {
  return { id: newId(), name, target, sets: Array.from({ length: sets }, blankSet) };
}

export function newSession(day: DayType, date: string = toISODate()): Session {
  return {
    id: newId(),
    date,
    day,
    exercises: TEMPLATE[day].map((e) => newExercise(e.name, e.target)),
    notes: '',
    savedAt: 0,
  };
}

// --- Training maths ---------------------------------------------------------------

/** Sets that count: marked done, with reps. */
export function countedSets(ex: ExerciseLog): SetEntry[] {
  return ex.sets.filter((s) => s.done && num(s.reps) > 0);
}

/** Volume = sum of weight x reps over the counted sets. */
export function sessionVolume(s: Session): number {
  return s.exercises.reduce(
    (total, ex) => total + countedSets(ex).reduce((t, set) => t + num(set.weight) * num(set.reps), 0),
    0
  );
}

export function sessionSetCount(s: Session): number {
  return s.exercises.reduce((n, ex) => n + countedSets(ex).length, 0);
}

const norm = (name: string) => name.trim().toLowerCase();

/** The most recent saved session (newest first) that includes this exercise, for the "previous" column. */
export function previousSets(sessions: readonly Session[], exerciseName: string): SetEntry[] | null {
  for (const s of sessions) {
    const ex = s.exercises.find((e) => norm(e.name) === norm(exerciseName));
    if (!ex) continue;
    const sets = countedSets(ex);
    if (sets.length) return sets;
  }
  return null;
}

/** The day to suggest next: the one after the most recent session in Push -> Pull -> Legs order. */
export function nextInRotation(sessions: readonly Session[]): DayType {
  const last = sessions[0];
  if (!last) return 'push';
  return DAY_TYPES[(DAY_TYPES.indexOf(last.day) + 1) % DAY_TYPES.length];
}

/** Today's planned day for a schedule, or null on a rest day. */
export function plannedDayFor(schedule: Schedule, date: Date = new Date()): DayType | null {
  return WEEK[schedule][date.getDay()] ?? null;
}

// --- Nutrition --------------------------------------------------------------------

export function mealTotals(meals: readonly Meal[]): { kcal: number; protein: number; count: number } {
  return {
    kcal: meals.reduce((t, m) => t + m.kcal, 0),
    protein: meals.reduce((t, m) => t + m.protein, 0),
    count: meals.length,
  };
}

/** 0-1 progress towards a target; 0 when there is no target. */
export function progress(value: number, target: number): number {
  return target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
}

// --- Loading: never trust what is in storage ------------------------------------------

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '', max = 200) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const clampNum = (v: unknown, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
};

function cleanSession(v: unknown): Session | null {
  if (!isObj(v) || !DAY_TYPES.includes(v.day) || !/^\d{4}-\d{2}-\d{2}$/.test(str(v.date))) return null;
  const exercises: ExerciseLog[] = (Array.isArray(v.exercises) ? v.exercises : [])
    .filter(isObj)
    .slice(0, 40)
    .map((e) => ({
      id: str(e.id, newId(), 40),
      name: str(e.name, 'Exercise', 80),
      target: typeof e.target === 'string' ? e.target.slice(0, 20) : undefined,
      sets: (Array.isArray(e.sets) ? e.sets : [])
        .filter(isObj)
        .slice(0, 30)
        .map((s) => ({ weight: str(s.weight, '', 8), reps: str(s.reps, '', 5), done: s.done === true })),
    }));
  return {
    id: str(v.id, newId(), 40),
    date: v.date,
    day: v.day,
    exercises,
    notes: str(v.notes, '', 500),
    savedAt: clampNum(v.savedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** Stored JSON -> valid FitnessData, with defaults for anything missing or malformed. */
export function parseFitnessData(raw: string | null): FitnessData {
  if (!raw) return DEFAULT_DATA;
  try {
    const v = JSON.parse(raw);
    if (!isObj(v)) return DEFAULT_DATA;
    const t = isObj(v.targets) ? v.targets : {};
    const meals: Record<string, Meal[]> = {};
    if (isObj(v.meals)) {
      for (const [date, list] of Object.entries(v.meals)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(list)) continue;
        meals[date] = list.filter(isObj).slice(0, 30).map((m) => ({
          id: str(m.id, newId(), 40),
          name: str(m.name, 'Meal', 60),
          kcal: clampNum(m.kcal, 0, 20000),
          protein: clampNum(m.protein, 0, 1000),
        }));
      }
    }
    return {
      version: 1,
      unit: v.unit === 'lb' ? 'lb' : 'kg',
      schedule: v.schedule === 'ppl3' ? 'ppl3' : 'ppl6',
      targets: {
        kcal: clampNum(t.kcal, DEFAULT_TARGETS.kcal, 20000),
        protein: clampNum(t.protein, DEFAULT_TARGETS.protein, 1000),
        meals: Math.round(clampNum(t.meals, DEFAULT_TARGETS.meals, 12)),
      },
      sessions: (Array.isArray(v.sessions) ? v.sessions : [])
        .map(cleanSession)
        .filter((s): s is Session => s !== null)
        .slice(0, 500),
      meals,
      draft: cleanSession(v.draft),
    };
  } catch {
    return DEFAULT_DATA;
  }
}
