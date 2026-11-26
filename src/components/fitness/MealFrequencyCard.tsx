import { Meal, Targets, shiftDate, toISODate } from '../../utils/fitness';
import { mealFrequency } from '../../utils/fitnessMath';

/** How many meals you actually eat, and how your protein is spread across them, over the last week. */
export default function MealFrequencyCard({ byDate, targets }: { byDate: Record<string, Meal[]>; targets: Targets }) {
  const today = toISODate();
  const f = mealFrequency(byDate, 7, today);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, -(6 - i)));
  const max = Math.max(targets.meals, ...days.map((d) => byDate[d]?.length ?? 0), 1);

  return (
    <section className="f-card space-y-3" data-testid="frequency-card">
      <h2 className="f-h">Meal frequency · last 7 days</h2>
      <div className="flex items-end gap-1.5" style={{ height: 64 }} role="img" aria-label="Meals logged per day">
        {days.map((d) => {
          const n = byDate[d]?.length ?? 0;
          return (
            <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-t" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 4 : 2, background: n >= targets.meals ? 'var(--f-accent)' : n ? '#7a3a22' : 'var(--f-surface-2)' }} />
              <span className="text-[9px] f-muted">{new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            </div>
          );
        })}
      </div>
      {f.loggedDays === 0 ? (
        <p className="f-small">Log some meals to see your pattern.</p>
      ) : (
        <p className="f-small" data-testid="frequency-text">
          {f.avgMeals.toFixed(1)} meals a day on average (target {targets.meals}) · about {Math.round(f.avgProteinPerMeal)} g protein per meal · {f.loggedDays} of 7 days logged.
          {f.avgProteinPerMeal && f.avgProteinPerMeal < 20 ? ' Spreading protein over fewer, larger meals may be easier.' : ''}
        </p>
      )}
    </section>
  );
}
