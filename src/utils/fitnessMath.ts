/**
 * Training and nutrition maths for the Fitness module: 1RM estimates and
 * working weights, the muscle-group volume behind the heatmap, trend weight
 * with an adaptive calorie estimate, CSV building and chart paths.
 * Pure functions: no DOM, no React, no IndexedDB.
 */
import { DayType, Meal, Session, SetEntry, Unit, WeightEntry, Goal, mealTotals, num, workingSets, shiftDate, sessionVolume, sessionSetCount } from './fitness';

// --- 1RM and working weights ----------------------------------------------------------

/** Epley: 1RM = w (1 + reps / 30). */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Brzycki: 1RM = w * 36 / (37 - reps). Only defined below 37 reps, and unreliable high up. */
export function brzycki1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1 || reps >= 37) return 0;
  return reps === 1 ? weight : (weight * 36) / (37 - reps);
}

/** Estimates beyond this many reps are too loose to be useful, so they are not shown. */
export const MAX_RELIABLE_REPS = 12;

export interface OneRepMax {
  epley: number;
  brzycki: number;
  /** Mean of the two. */
  average: number;
}

export function estimate1RM(weight: number, reps: number): OneRepMax | null {
  if (!(weight > 0) || !(reps >= 1) || reps > MAX_RELIABLE_REPS) return null;
  const epley = epley1RM(weight, reps);
  const brzycki = brzycki1RM(weight, reps);
  return { epley, brzycki, average: (epley + brzycki) / 2 };
}

/** The smallest plate jump people can actually load: 2.5 kg or 5 lb. */
export const plateIncrement = (unit: Unit): number => (unit === 'kg' ? 2.5 : 5);

export function roundToIncrement(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

/** Reps you can usually do at a fraction of 1RM (the Epley formula solved for reps). */
export function repsAtFraction(fraction: number): number {
  return fraction >= 1 ? 1 : Math.max(1, Math.round(30 * (1 / fraction - 1)));
}

export interface WorkingWeightRow {
  percent: number;
  weight: number;
  reps: number;
}

/** Working weights from 60% to 100% of a 1RM, rounded to loadable plates. */
export function workingWeightTable(oneRM: number, unit: Unit): WorkingWeightRow[] {
  const step = plateIncrement(unit);
  return [100, 95, 90, 85, 80, 75, 70, 65, 60].map((percent) => ({
    percent,
    weight: roundToIncrement((oneRM * percent) / 100, step),
    reps: repsAtFraction(percent / 100),
  }));
}

/** The best estimated 1RM (Epley/Brzycki average) over some sets, or 0. */
export function bestEstimate(sets: readonly SetEntry[]): number {
  let best = 0;
  for (const s of sets) {
    const e = estimate1RM(num(s.weight), num(s.reps));
    if (e && e.average > best) best = e.average;
  }
  return best;
}

/** Best e1RM per session date for one exercise, oldest first, for a trend line. */
export function e1rmHistory(sessions: readonly Session[], exerciseName: string): { date: string; value: number }[] {
  const key = exerciseName.trim().toLowerCase();
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === key);
    if (!ex) continue;
    const best = bestEstimate(workingSets(ex));
    if (best > 0) byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, best));
  }
  return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Names of exercises seen in saved sessions, most recently trained first. */
export function exerciseNames(sessions: readonly Session[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const e of s.exercises) {
      const k = e.name.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(e.name.trim());
      }
    }
  }
  return out;
}

// --- Muscle-group volume (the heatmap) ---------------------------------------------------

export type Muscle = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'quads' | 'back' | 'glutes' | 'hamstrings' | 'calves';
export const MUSCLES: readonly { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'core', label: 'Core' },
  { id: 'back', label: 'Back' },
  { id: 'quads', label: 'Quads' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'calves', label: 'Calves' },
];

interface MuscleMap {
  primary: Muscle[];
  secondary: Muscle[];
}

// First match wins, so the specific patterns (leg curl, leg extension) come before the general ones (curl, extension).
const EXERCISE_MUSCLES: [RegExp, MuscleMap][] = [
  [/leg extension/, { primary: ['quads'], secondary: [] }],
  [/leg curl|hamstring curl/, { primary: ['hamstrings'], secondary: [] }],
  [/calf/, { primary: ['calves'], secondary: [] }],
  [/hip thrust|glute bridge|kickback/, { primary: ['glutes'], secondary: ['hamstrings'] }],
  [/romanian|rdl|stiff[- ]leg|good morning/, { primary: ['hamstrings', 'glutes'], secondary: ['back'] }],
  [/deadlift/, { primary: ['back', 'glutes', 'hamstrings'], secondary: ['quads'] }],
  [/squat|leg press|lunge|split squat|hack|step[- ]?up/, { primary: ['quads', 'glutes'], secondary: ['hamstrings'] }],
  [/lateral raise|rear delt|reverse fly|face pull/, { primary: ['shoulders'], secondary: ['back'] }],
  [/overhead press|shoulder press|military|arnold|push press/, { primary: ['shoulders'], secondary: ['triceps'] }],
  [/triceps|pushdown|skull|dip|close[- ]grip bench|extension/, { primary: ['triceps'], secondary: [] }],
  [/curl/, { primary: ['biceps'], secondary: [] }],
  [/pull[- ]?up|chin[- ]?up|pulldown|lat |row|shrug|pullover/, { primary: ['back'], secondary: ['biceps'] }],
  [/fly|flye|pec deck|crossover/, { primary: ['chest'], secondary: [] }],
  [/bench|chest press|push[- ]?up|incline/, { primary: ['chest'], secondary: ['shoulders', 'triceps'] }],
  [/plank|crunch|\bab\b|abs|core|sit[- ]?up|leg raise|wheel/, { primary: ['core'], secondary: [] }],
];

const DAY_FALLBACK: Record<DayType, MuscleMap> = {
  push: { primary: ['chest', 'shoulders', 'triceps'], secondary: [] },
  pull: { primary: ['back', 'biceps'], secondary: [] },
  legs: { primary: ['quads', 'hamstrings', 'glutes'], secondary: [] },
};

/** Which muscles an exercise trains, by name. Unknown names fall back to the session's day type. */
export function musclesFor(exerciseName: string, day: DayType): MuscleMap {
  const name = ` ${exerciseName.toLowerCase()} `;
  for (const [re, map] of EXERCISE_MUSCLES) if (re.test(name)) return map;
  return DAY_FALLBACK[day];
}

/**
 * Working sets per muscle over the last `days` days (including today).
 * A set counts 1 for each primary muscle and 0.5 for each secondary one.
 */
export function muscleSets(sessions: readonly Session[], days: number, today: string): Record<Muscle, number> {
  const since = shiftDate(today, -(days - 1));
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  for (const s of sessions) {
    if (s.date < since || s.date > today) continue;
    for (const ex of s.exercises) {
      const n = workingSets(ex).length;
      if (!n) continue;
      const { primary, secondary } = musclesFor(ex.name, s.day);
      for (const m of primary) out[m] += n;
      for (const m of secondary) out[m] += n * 0.5;
    }
  }
  return out;
}

/** Weekly sets that read as "fully trained" on the heatmap (a common 10-20 range). */
export const HEATMAP_FULL_SETS_PER_WEEK = 12;

/** 0-1 heat for a muscle, scaled so the window length does not change what "full" means. */
export function heat(sets: number, days: number): number {
  const perWeek = (sets / days) * 7;
  return Math.min(1, Math.max(0, perWeek / HEATMAP_FULL_SETS_PER_WEEK));
}

// --- Nutrition and trend weight ------------------------------------------------------------

export function mealsByDate(meals: readonly Meal[]): Record<string, Meal[]> {
  const out: Record<string, Meal[]> = {};
  for (const m of meals) (out[m.date] ??= []).push(m);
  return out;
}

export interface MealFrequency {
  /** Days in the window that have at least one meal. */
  loggedDays: number;
  avgMeals: number;
  avgKcal: number;
  avgProtein: number;
  avgProteinPerMeal: number;
}

/** Averages over the days (out of the last `days`) on which something was logged. */
export function mealFrequency(byDate: Record<string, Meal[]>, days: number, today: string): MealFrequency {
  let loggedDays = 0;
  let meals = 0;
  let kcal = 0;
  let protein = 0;
  for (let i = 0; i < days; i++) {
    const list = byDate[shiftDate(today, -i)];
    if (!list?.length) continue;
    const t = mealTotals(list);
    loggedDays += 1;
    meals += t.count;
    kcal += t.kcal;
    protein += t.protein;
  }
  return {
    loggedDays,
    avgMeals: loggedDays ? meals / loggedDays : 0,
    avgKcal: loggedDays ? kcal / loggedDays : 0,
    avgProtein: loggedDays ? protein / loggedDays : 0,
    avgProteinPerMeal: meals ? protein / meals : 0,
  };
}

export interface TrendPoint {
  date: string;
  value: number;
  trend: number;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/**
 * Trend weight: an exponential moving average of the weigh-ins, which removes
 * day-to-day water and food noise so the real direction shows. With a gap of
 * `d` days the smoothing is applied d times, so skipped days do not matter.
 */
export function trendSeries(entries: readonly WeightEntry[], alpha = 0.1): TrendPoint[] {
  const sorted = [...entries].filter((e) => e.value > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ date: e.date, value: e.value, trend: e.value });
      continue;
    }
    const gap = Math.max(1, dayNumber(e.date) - dayNumber(prev.date));
    const a = 1 - Math.pow(1 - alpha, gap);
    out.push({ date: e.date, value: e.value, trend: prev.trend + a * (e.value - prev.trend) });
  }
  return out;
}

/** Trend change per week (units per week) from a least-squares line over the last `windowDays`, or null if too little data. */
export function weeklyRate(series: readonly TrendPoint[], windowDays = 14): number | null {
  if (series.length < 4) return null;
  const last = dayNumber(series[series.length - 1].date);
  const pts = series.filter((p) => last - dayNumber(p.date) < windowDays);
  if (pts.length < 4 || last - dayNumber(pts[0].date) < 7) return null;
  const xs = pts.map((p) => dayNumber(p.date) - last);
  const ys = pts.map((p) => p.trend);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  return sxx === 0 ? null : (sxy / sxx) * 7;
}

/** Energy in a unit of body weight: about 7700 kcal per kg, 3500 per lb. */
export const kcalPerUnit = (unit: Unit): number => (unit === 'kg' ? 7700 : 3500);

/** Weekly change that goal aims for, as a fraction of body weight (negative = losing). */
export const GOAL_RATE: Record<Goal, number> = { lose: -0.005, maintain: 0, gain: 0.0025 };

export type Adaptive =
  | { ok: false; reason: string }
  | { ok: true; trend: number; rate: number; avgIntake: number; tdee: number; target: number; loggedDays: number };

/**
 * Adaptive calorie target. Estimates maintenance from what you actually ate and
 * what your trend weight actually did (TDEE = average intake - rate x energy
 * per unit / 7), then offsets it for the goal. Needs enough of both to mean
 * anything; otherwise it says what is missing rather than guessing.
 */
export function adaptiveTarget(
  weights: readonly WeightEntry[],
  byDate: Record<string, Meal[]>,
  goal: Goal,
  unit: Unit,
  today: string
): Adaptive {
  const series = trendSeries(weights);
  const recent = series.filter((p) => dayNumber(today) - dayNumber(p.date) < 21);
  if (recent.length < 7) return { ok: false, reason: `Log at least 7 weigh-ins over 2-3 weeks (you have ${recent.length} recently).` };
  const rate = weeklyRate(series, 14);
  if (rate === null) return { ok: false, reason: 'Weigh-ins need to span at least 10 days to read a trend.' };
  const freq = mealFrequency(byDate, 14, today);
  if (freq.loggedDays < 7) return { ok: false, reason: `Log meals on at least 7 of the last 14 days (you have ${freq.loggedDays}).` };

  const trend = series[series.length - 1].trend;
  const tdee = freq.avgKcal - (rate * kcalPerUnit(unit)) / 7;
  const goalDelta = (GOAL_RATE[goal] * trend * kcalPerUnit(unit)) / 7;
  const target = Math.round((tdee + goalDelta) / 10) * 10;
  return { ok: true, trend, rate, avgIntake: freq.avgKcal, tdee: Math.round(tdee), target, loggedDays: freq.loggedDays };
}

// --- CSV and charts ----------------------------------------------------------------------------

/** RFC 4180-style CSV. Cells starting with = + - @ are prefixed with ' so a spreadsheet will not run them as formulas. */
export function toCSV(rows: readonly (readonly (string | number)[])[]): string {
  const cell = (v: string | number) => {
    let t = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Parse CSV text (RFC 4180: quoted cells, doubled quotes, newlines inside quotes)
 * into rows of strings. Undoes the leading ' that toCSV adds to cells a
 * spreadsheet could read as a formula. Skips fully empty lines.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  const endCell = () => {
    row.push(/^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') endCell();
    else if (ch === '\n') endRow();
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

/** An SVG path through values, scaled to fit width x height with padding. */
export function linePath(values: readonly number[], width: number, height: number, pad = 4, min?: number, max?: number): string {
  if (values.length === 0) return '';
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (values.length === 1 ? (width - 2 * pad) / 2 : (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - 2 * pad);
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
}

// --- Weekly training volume ---------------------------------------------------------------------

export interface WeekVolume {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  /** Working-set volume (weight x reps), warm-ups excluded. */
  volume: number;
  sessions: number;
  sets: number;
}

/** The Monday on or before a date. */
export function weekStartOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  return shiftDate(iso, -dow);
}

/** Volume per calendar week for the last `weeks` weeks ending with the week of `today`, oldest first. */
export function weeklyVolume(sessions: readonly Session[], weeks: number, today: string): WeekVolume[] {
  const thisWeek = weekStartOf(today);
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: shiftDate(thisWeek, -7 * i), volume: 0, sessions: 0, sets: 0 });
  const byStart = new Map(out.map((w) => [w.weekStart, w]));
  for (const s of sessions) {
    const w = byStart.get(weekStartOf(s.date));
    if (!w) continue;
    w.sessions += 1;
    w.volume += sessionVolume(s);
    w.sets += sessionSetCount(s);
  }
  return out;
}
