/**
 * From what the on-device detector saw to an editable meal draft. Pure functions, no DOM.
 *
 * The detector is a general object model (COCO), so it can name only a handful of foods: it cannot
 * identify a home-cooked dish or weigh a portion. Each recognised item therefore maps to ONE typical
 * serving with approximate values, and every draft is an estimate the person must check and edit.
 * The draft holds numbers and a label only: nothing from the image (no pixels, boxes or scores) is
 * kept, which is also what keeps it safe to sync.
 */

export interface FoodServing {
  /** What it is called in the draft. */
  label: string;
  /** What one detected item is assumed to be. */
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Approximate values for a typical serving of each food the detector can name (COCO class names). */
export const FOOD_SERVINGS: Readonly<Record<string, FoodServing>> = {
  banana: { label: 'Banana', serving: '1 medium', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  apple: { label: 'Apple', serving: '1 medium', kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  orange: { label: 'Orange', serving: '1 medium', kcal: 62, protein: 1.2, carbs: 15, fat: 0.2 },
  broccoli: { label: 'Broccoli', serving: '1 cup, cooked', kcal: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  carrot: { label: 'Carrot', serving: '1 medium', kcal: 25, protein: 0.6, carbs: 6, fat: 0.1 },
  sandwich: { label: 'Sandwich', serving: '1 sandwich', kcal: 350, protein: 15, carbs: 35, fat: 15 },
  'hot dog': { label: 'Hot dog', serving: '1 with bun', kcal: 290, protein: 10, carbs: 24, fat: 17 },
  pizza: { label: 'Pizza', serving: '1 slice', kcal: 285, protein: 12, carbs: 36, fat: 10 },
  donut: { label: 'Donut', serving: '1 glazed', kcal: 250, protein: 3, carbs: 31, fat: 14 },
  cake: { label: 'Cake', serving: '1 slice', kcal: 350, protein: 4, carbs: 50, fat: 15 },
};

/** Things seen that hold food the detector cannot identify. */
const CONTAINERS = new Set(['bowl', 'cup', 'wine glass', 'bottle', 'dining table']);

/** A detection reduced to what the estimate needs. */
export interface SeenItem {
  className: string;
  confidence: number;
}

export interface DraftItem {
  label: string;
  serving: string;
  count: number;
}

export interface MealDraft {
  /** Meal label, e.g. "Banana, apple". Empty when nothing was recognised. */
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: DraftItem[];
  /** Plain-language notes about what could not be worked out. */
  hints: string[];
}

/** Detections at or above this confidence count as seen. */
export const SCAN_CONFIDENCE = 0.35;
/** More than this of one food in a photo is almost certainly a mistake; it is capped. */
export const MAX_PER_FOOD = 6;

/** A meal draft from what was detected. Always safe to show: an unrecognised photo gives an empty draft. */
export function draftFromDetections(seen: readonly SeenItem[]): MealDraft {
  const counts = new Map<string, number>();
  let container = false;
  for (const s of seen) {
    if (s.confidence < SCAN_CONFIDENCE) continue;
    if (FOOD_SERVINGS[s.className]) counts.set(s.className, Math.min(MAX_PER_FOOD, (counts.get(s.className) ?? 0) + 1));
    else if (CONTAINERS.has(s.className)) container = true;
  }

  const items: DraftItem[] = [];
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const [cls, count] of counts) {
    const f = FOOD_SERVINGS[cls];
    items.push({ label: f.label, serving: f.serving, count });
    kcal += f.kcal * count;
    protein += f.protein * count;
    carbs += f.carbs * count;
    fat += f.fat * count;
  }
  items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const hints: string[] = [];
  if (items.length === 0) hints.push('No food I can recognise. Enter the meal by hand.');
  else hints.push('Each item is counted as one typical serving, so check the portions.');
  if (container) hints.push('A bowl, cup or plate was seen, but what is in it cannot be identified: add that by hand.');

  const labels = items.map((i) => i.label);
  const name = labels.length === 0 ? '' : labels.length <= 3 ? labels.join(', ') : 'Mixed meal';
  return { name, kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), items, hints };
}

/** "2× Banana, 1× Pizza" for the summary line. */
export function describeItems(items: readonly DraftItem[]): string {
  return items.map((i) => `${i.count}× ${i.label}`).join(', ');
}
