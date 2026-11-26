/**
 * Rule-based coaching notes derived from what the athlete has logged. No model, no network: each
 * rule reads sessions, meals and weigh-ins and returns a plain-language observation. Pure functions.
 * These are general training observations, not medical or dietary advice.
 */
import { DAY_LABEL, DAY_TYPES, DayType, Meal, Session, Settings, WeightEntry, daysBetween, plannedDaysPerWeek, shiftDate } from './fitness';
import { alternativesFor } from './swaps';
import { adaptiveTarget, e1rmHistory, exerciseNames, mealFrequency, mealsByDate, trendSeries, weeklyRate } from './fitnessMath';

export type InsightLevel = 'good' | 'attention' | 'info';

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
  /** A change you can apply in one tap. */
  action?: { kind: 'kcal'; label: string; kcal: number };
}

export interface InsightInput {
  sessions: readonly Session[];
  meals: readonly Meal[];
  weights: readonly WeightEntry[];
  settings: Settings;
  /** Local calendar date, YYYY-MM-DD. */
  today: string;
}

/** Sessions in the last 7 days against what the chosen split plans. */
function consistency({ sessions, settings, today }: InsightInput): Insight | null {
  if (sessions.length === 0) return null;
  const planned = plannedDaysPerWeek(settings.schedule);
  const since = shiftDate(today, -6);
  const done = sessions.filter((s) => s.date >= since && s.date <= today).length;
  if (done >= planned) return { id: 'consistency', level: 'good', title: 'On track this week', detail: `${done} sessions in the last 7 days against ${planned} planned.` };
  if (done === 0) return { id: 'consistency', level: 'attention', title: 'No sessions in the last 7 days', detail: `Your split plans ${planned} a week. Even one short session keeps the habit going.` };
  return { id: 'consistency', level: 'info', title: `${done} of ${planned} planned sessions this week`, detail: `${planned - done} to go. Sessions logged today count towards the week.` };
}

/** A day type that has not been trained for a while. */
function neglectedDay({ sessions, today }: InsightInput): Insight | null {
  if (sessions.length < 3) return null;
  let worst: { day: DayType; gap: number } | null = null;
  for (const day of DAY_TYPES) {
    const last = sessions.filter((s) => s.day === day).map((s) => s.date).sort().pop();
    if (!last) continue; // never trained: not "neglected", just not started
    const gap = daysBetween(last, today);
    if (gap >= 8 && (!worst || gap > worst.gap)) worst = { day, gap };
  }
  return worst ? { id: 'neglected', level: 'attention', title: `${DAY_LABEL[worst.day]} was last trained ${worst.gap} days ago`, detail: `Slot a ${DAY_LABEL[worst.day]} session in soon so that muscle group does not fall behind.` } : null;
}

/** Progressive overload: is the estimated 1RM of the most-trained lifts going up? */
function overload({ sessions }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const names = exerciseNames(sessions)
    .map((n) => ({ n, points: e1rmHistory(sessions, n) }))
    .filter((x) => x.points.length >= 3)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 6);
  const stalled: string[] = [];
  const rising: string[] = [];
  for (const { n, points } of names) {
    const last3 = points.slice(-3);
    const first = last3[0].value;
    const last = last3[2].value;
    if (last >= first * 1.02) rising.push(n);
    else if (last <= first * 1.0 && Math.max(...last3.map((p) => p.value)) <= first * 1.01) stalled.push(n);
  }
  if (rising.length) out.push({ id: 'overload-up', level: 'good', title: `Getting stronger: ${rising.slice(0, 3).join(', ')}`, detail: 'Estimated 1RM is up across your last three sessions on these lifts. Keep the same approach.' });
  if (stalled.length) {
    const alt = alternativesFor(stalled[0])[0];
    out.push({
      id: 'overload-flat',
      level: 'attention',
      title: `Plateau: ${stalled.slice(0, 3).join(', ')}`,
      detail: `No gain in estimated 1RM over your last three sessions. Try one more rep per set, a small weight jump, or a lighter week before pushing again.${alt ? ` Or swap ${stalled[0]} for ${alt} (the swap button on the exercise in Today).` : ''}`,
    });
  }
  return out;
}

/** Protein and calories against targets over the days that were logged. */
function nutrition({ meals, settings, today }: InsightInput): Insight[] {
  if (meals.length === 0) return [];
  const f = mealFrequency(mealsByDate(meals), 7, today);
  const out: Insight[] = [];
  if (f.loggedDays < 4) {
    out.push({ id: 'nutrition-log', level: 'info', title: `Meals logged on ${f.loggedDays} of the last 7 days`, detail: 'Log four or more days a week and the averages and calorie estimate become reliable.' });
    return out;
  }
  const { protein, kcal } = settings.targets;
  if (protein > 0) {
    const ratio = f.avgProtein / protein;
    if (ratio < 0.85) out.push({ id: 'protein', level: 'attention', title: `Protein is low: ${Math.round(f.avgProtein)} g a day vs ${protein} g`, detail: 'Spreading it over your meals helps: add a protein source to the meal that has the least.' });
    else out.push({ id: 'protein', level: 'good', title: `Protein on target: ${Math.round(f.avgProtein)} g a day`, detail: `That is ${Math.round(ratio * 100)}% of your ${protein} g target.` });
  }
  if (kcal > 0) {
    const ratio = f.avgKcal / kcal;
    if (ratio > 1.15) out.push({ id: 'kcal', level: 'attention', title: `Calories run high: ${Math.round(f.avgKcal)} a day vs ${kcal}`, detail: 'If that is deliberate (a gaining phase) raise the target so the bars stay honest; otherwise trim a meal.' });
    else if (ratio < 0.85) out.push({ id: 'kcal', level: 'attention', title: `Calories run low: ${Math.round(f.avgKcal)} a day vs ${kcal}`, detail: 'Under-eating makes hard sessions harder. Check that every meal is actually logged, then adjust.' });
  }
  return out;
}

/** Where the weight trend is heading against the goal and the target weight. */
function bodyWeight({ weights, meals, settings, today }: InsightInput): Insight[] {
  const series = trendSeries(weights);
  if (series.length < 3) return weights.length ? [{ id: 'weight-more', level: 'info', title: 'A few more weigh-ins unlock the trend', detail: 'Three or more weigh-ins a week gives a trend that filters out water and food noise.' }] : [];
  const out: Insight[] = [];
  const unit = settings.unit;
  const rate = weeklyRate(series, 14);
  const now = series[series.length - 1].trend;
  if (rate !== null) {
    const moving = Math.abs(rate) >= 0.05;
    if (settings.goal === 'lose' && rate > 0.05) out.push({ id: 'weight-goal', level: 'attention', title: `Trend is rising (+${rate.toFixed(2)} ${unit}/wk) on a cutting goal`, detail: 'Tighten calories a little or add a walk. Judge it over two weeks, not a day.' });
    else if (settings.goal === 'gain' && rate < 0.02) out.push({ id: 'weight-goal', level: 'attention', title: 'Trend is flat on a gaining goal', detail: 'Add roughly 150-250 kcal a day and give it two weeks.' });
    else if (settings.goal === 'maintain' && moving) out.push({ id: 'weight-goal', level: 'info', title: `Trend is drifting ${rate > 0 ? 'up' : 'down'} (${rate > 0 ? '+' : ''}${rate.toFixed(2)} ${unit}/wk)`, detail: 'Your goal is maintenance: nudge calories to bring it back to flat.' });
    else out.push({ id: 'weight-goal', level: 'good', title: 'Weight trend matches your goal', detail: `Trend ${now.toFixed(1)} ${unit}, ${rate >= 0 ? '+' : ''}${rate.toFixed(2)} ${unit} a week.` });
  }
  if (settings.goalWeight > 0) {
    const gap = now - settings.goalWeight;
    if (Math.abs(gap) < 0.3) out.push({ id: 'goal-weight', level: 'good', title: 'At your goal weight', detail: `Trend ${now.toFixed(1)} ${unit} vs goal ${settings.goalWeight} ${unit}.` });
    else out.push({ id: 'goal-weight', level: 'info', title: `${Math.abs(gap).toFixed(1)} ${unit} ${gap > 0 ? 'above' : 'below'} your goal weight`, detail: `Trend ${now.toFixed(1)} ${unit} vs goal ${settings.goalWeight} ${unit}.` });
  }
  const adaptive = adaptiveTarget(weights, mealsByDate(meals), settings.goal, unit, today);
  if (adaptive.ok && Math.abs(adaptive.target - settings.targets.kcal) >= 150) out.push({ id: 'adaptive', level: 'info', title: `Your data suggests about ${adaptive.target} kcal a day`, detail: `Your target is ${settings.targets.kcal}. Apply it with one tap, or keep yours.`, action: { kind: 'kcal', label: `Use ${adaptive.target} kcal`, kcal: adaptive.target } });
  return out;
}

/** All insights, attention items first. Empty only when nothing has been logged. */
export function coachInsights(input: InsightInput): Insight[] {
  const all = [consistency(input), neglectedDay(input), ...overload(input), ...nutrition(input), ...bodyWeight(input)].filter((i): i is Insight => i !== null);
  const rank: Record<InsightLevel, number> = { attention: 0, info: 1, good: 2 };
  return all.sort((a, b) => rank[a.level] - rank[b.level]);
}
