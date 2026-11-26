/**
 * Quick log: read a plain note like "2 eggs, toast, 450 kcal 30p" or "bench 80x8x3" into meals and
 * exercises. Plain rules on this device: no model, no network, no tokens. Numbers you type always win
 * over the estimates from the small food table, and anything it cannot read is handed back as is.
 */
import { MEAL_LIMITS, SetEntry, checkMealKcal, kcalFromMacros, newId } from './fitness';
import type { ExerciseLog, Session } from './fitness';

interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Food {
  names: RegExp;
  label: string;
  /** Per 100 g (or ml). */
  per100: Macros;
  /** Grams in one typical piece or serving, used for "2 eggs". */
  unitG: number;
}

// Typical values, rounded. Estimates: a label or a scale beats them.
const FOODS: Food[] = [
  { names: /\beggs?\b/, label: 'Egg', per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, unitG: 50 },
  { names: /\b(toast|bread|slices?)\b/, label: 'Bread', per100: { kcal: 265, protein: 9, carbs: 49, fat: 3.2 }, unitG: 30 },
  { names: /\bbananas?\b/, label: 'Banana', per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }, unitG: 118 },
  { names: /\bapples?\b/, label: 'Apple', per100: { kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 }, unitG: 182 },
  { names: /\brice\b/, label: 'Rice (cooked)', per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, unitG: 158 },
  { names: /\bpasta\b/, label: 'Pasta (cooked)', per100: { kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 }, unitG: 140 },
  { names: /\bchicken\b/, label: 'Chicken breast', per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, unitG: 120 },
  { names: /\b(beef|mince)\b/, label: 'Beef mince', per100: { kcal: 250, protein: 26, carbs: 0, fat: 15 }, unitG: 100 },
  { names: /\bsalmon\b/, label: 'Salmon', per100: { kcal: 208, protein: 20, carbs: 0, fat: 13 }, unitG: 120 },
  { names: /\b(oats|oatmeal|porridge)\b/, label: 'Oats (dry)', per100: { kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 }, unitG: 40 },
  { names: /\b(whey|protein shake|scoops?)\b/, label: 'Whey scoop', per100: { kcal: 400, protein: 80, carbs: 8, fat: 6 }, unitG: 30 },
  { names: /\bmilk\b/, label: 'Milk', per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, unitG: 240 },
  { names: /\b(yogh?urt|greek)\b/, label: 'Greek yoghurt', per100: { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 }, unitG: 170 },
  { names: /\bpeanut butter\b/, label: 'Peanut butter', per100: { kcal: 588, protein: 25, carbs: 20, fat: 50 }, unitG: 16 },
  { names: /\bpotato(es)?\b/, label: 'Potato', per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 }, unitG: 173 },
  { names: /\bavocado\b/, label: 'Avocado', per100: { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 }, unitG: 150 },
  { names: /\bcheese\b/, label: 'Cheese', per100: { kcal: 402, protein: 25, carbs: 1.3, fat: 33 }, unitG: 28 },
  { names: /\b(olive )?oil\b/, label: 'Oil', per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 }, unitG: 14 },
];

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5 };
const NUM = '(\\d+(?:[.,]\\d+)?)';
const toNum = (s: string) => parseFloat(s.replace(',', '.'));

export interface ParsedMeal {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True when some of the numbers are estimates from typical values rather than typed by you. */
  estimated: boolean;
  /** A caution about the numbers, if any. */
  note?: string;
}

export interface QuickLogResult {
  meals: ParsedMeal[];
  exercises: ExerciseLog[];
  /** Lines that could not be read, as typed. */
  unparsed: string[];
}

const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

// --- Workout notes ----------------------------------------------------------------------

const RE_WRS = new RegExp(`${NUM}\\s*(?:kg|lbs?)?\\s*[x×]\\s*(\\d+)\\s*[x×]\\s*(\\d+)`, 'i'); // weight x reps x sets
const RE_PAIR = /(\d+)\s*[x×]\s*(\d+)/; // sets x reps (or weight x reps, see below)
const RE_WEIGHT = new RegExp(`(?:@|\\bat\\b|\\bwith\\b)\\s*${NUM}\\s*(?:kg|lbs?)?|${NUM}\\s*(?:kg|lbs?)\\b`, 'i');

function parseWorkout(line: string): ExerciseLog | null {
  const firstNum = line.search(/\d/);
  const name = titleCase(line.slice(0, firstNum < 0 ? line.length : firstNum).replace(/[@:\-]|\b(at|with|for)\b\s*$/gi, ''));
  if (!name || firstNum < 0) return null;
  const rest = line.slice(firstNum);

  let weight = '';
  let reps = 0;
  let sets = 1;
  const three = RE_WRS.exec(rest);
  const pair = RE_PAIR.exec(rest);
  if (three) {
    weight = String(toNum(three[1]));
    reps = Number(three[2]);
    sets = Number(three[3]);
  } else if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    const w = RE_WEIGHT.exec(rest);
    if (w) {
      // "3x8 @ 80" or "5x5 100kg": sets x reps at a weight.
      sets = a;
      reps = b;
      weight = String(toNum((w[1] ?? w[2]) as string));
    } else if (a <= 8 && b >= 3) {
      sets = a; // "5x5": sets x reps, weight left for you to fill in
      reps = b;
    } else {
      weight = String(a); // "80x8": one set of weight x reps
      reps = b;
    }
  } else return null;

  if (sets < 1 || sets > 10 || reps < 1 || reps > 100 || (weight !== '' && toNum(weight) > 1000)) return null;
  const set = (): SetEntry => ({ weight, reps: String(reps), done: true, type: 'normal' });
  return { id: newId(), name: name.slice(0, 80), sets: Array.from({ length: sets }, set) };
}

// --- Meal notes -------------------------------------------------------------------------

function grams(token: string, food: Food): number {
  const g = new RegExp(`${NUM}\\s*(?:g|gr|grams?|ml)\\b`).exec(token);
  if (g) return toNum(g[1]);
  const lead = new RegExp(`^(?:${NUM}|(${Object.keys(WORDS).join('|')}))\\b`).exec(token.trim());
  const count = lead ? (lead[1] ? toNum(lead[1]) : WORDS[lead[2]]) : 1;
  return Math.min(count, 12) * food.unitG;
}

function parseMeal(line: string): ParsedMeal | null {
  const lower = line.toLowerCase();
  const take = (re: RegExp): number | undefined => {
    const m = re.exec(lower);
    return m ? toNum(m[1]) : undefined;
  };
  const kcal = take(new RegExp(`${NUM}\\s*(?:kcal|cals?|calories)\\b`));
  const protein = take(new RegExp(`${NUM}\\s*g?\\s*(?:protein|prot|p)\\b`));
  const carbs = take(new RegExp(`${NUM}\\s*g?\\s*(?:carbs?|c)\\b`));
  const fat = take(new RegExp(`${NUM}\\s*g?\\s*(?:fats?|f)\\b`));
  const typed = kcal !== undefined || protein !== undefined || carbs !== undefined || fat !== undefined;

  // The macro words are not foods: strip them before looking for foods and for the name.
  const stripped = lower
    .replace(new RegExp(`${NUM}\\s*(?:kcal|cals?|calories)\\b`, 'g'), ' ')
    .replace(new RegExp(`${NUM}\\s*g?\\s*(?:protein|prot|p|carbs?|c|fats?|f)\\b`, 'g'), ' ');
  const sum: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let foods = 0;
  for (const token of stripped.split(/,|\+|;|\band\b|\bwith\b/)) {
    const food = FOODS.find((f) => f.names.test(token));
    if (!food) continue;
    const factor = grams(token, food) / 100;
    sum.kcal += food.per100.kcal * factor;
    sum.protein += food.per100.protein * factor;
    sum.carbs += food.per100.carbs * factor;
    sum.fat += food.per100.fat * factor;
    foods += 1;
  }
  if (!typed && foods === 0) return null;

  const p = protein ?? sum.protein;
  const c = carbs ?? sum.carbs;
  const f = fat ?? sum.fat;
  const k = kcal ?? (foods && protein === undefined && carbs === undefined && fat === undefined ? sum.kcal : kcalFromMacros(p, c, f));
  const lim = MEAL_LIMITS;
  const out: ParsedMeal = {
    name: line.replace(/\s+/g, ' ').trim().slice(0, 60),
    kcal: Math.min(lim.kcal, Math.round(k)),
    protein: Math.min(lim.protein, Math.round(p)),
    carbs: Math.min(lim.carbs, Math.round(c)),
    fat: Math.min(lim.fat, Math.round(f)),
    estimated: foods > 0 && !(kcal !== undefined && protein !== undefined && carbs !== undefined && fat !== undefined),
  };
  // Only when you typed calories and all three macros can they be compared: otherwise the macros are partial.
  const check = checkMealKcal(out.kcal, out.protein, out.carbs, out.fat);
  if (kcal !== undefined && protein !== undefined && carbs !== undefined && fat !== undefined && !check.ok) out.note = `Calories do not match the macros (they add up to ${check.macroKcal} kcal). Check the numbers.`;
  return out.kcal > 0 || out.protein > 0 ? out : null;
}

/** Read a note into meals and exercises; whatever it cannot read comes back in `unparsed`. */
export function parseQuickLog(text: string): QuickLogResult {
  const result: QuickLogResult = { meals: [], exercises: [], unparsed: [] };
  const entries = text.split(/\n|;/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
  for (const entry of entries) {
    // A line that looks like sets x reps is workout notes; a comma splits several exercises on it.
    if (/\d\s*[x×]\s*\d/.test(entry)) {
      for (const part of entry.split(/,/).map((s) => s.trim()).filter(Boolean)) {
        const ex = parseWorkout(part);
        if (ex) result.exercises.push(ex);
        else result.unparsed.push(part);
      }
      continue;
    }
    const meal = parseMeal(entry);
    if (meal) result.meals.push(meal);
    else result.unparsed.push(entry);
  }
  return result;
}

const norm = (n: string) => n.trim().toLowerCase();

/**
 * Put logged exercises into a session. One that matches an exercise already there ("bench" and "Barbell
 * Bench Press") fills that exercise's sets; any other is added at the end.
 */
export function mergeExercises(session: Session, incoming: readonly ExerciseLog[]): Session {
  const exercises = session.exercises.map((e) => ({ ...e }));
  for (const inc of incoming) {
    const a = norm(inc.name);
    const i = exercises.findIndex((e) => {
      const b = norm(e.name);
      return a === b || (a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b));
    });
    if (i >= 0) exercises[i] = { ...exercises[i], sets: inc.sets.map((x) => ({ ...x })) };
    else exercises.push({ ...inc, id: newId() });
  }
  return { ...session, exercises };
}
