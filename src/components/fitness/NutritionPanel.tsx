import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Meal, Targets, dateLabel, kcalFromMacros, mealTotals, newId, num, progress, shiftDate, toISODate } from '../../utils/fitness';
import { db } from '../../utils/fitnessDb';

interface Props {
  date: string;
  onDate: (iso: string) => void;
  meals: Meal[];
  targets: Targets;
  onTargets: (t: Targets) => void;
}

function Bar({ label, value, target, unit, testId }: { label: string; value: number; target: number; unit: string; testId?: string }) {
  const p = progress(value, target);
  const over = target > 0 && value > target;
  return (
    <div data-testid={testId}>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="f-muted">{label}</span>
        <span>
          {Math.round(value)} / {target} {unit}
          {target > 0 && (
            <span style={{ color: over ? 'var(--f-gold)' : 'var(--f-muted)' }}>
              {' '}
              · {over ? `${Math.round(value - target)} over` : `${Math.round(target - value)} left`}
            </span>
          )}
        </span>
      </div>
      <div className="f-track" role="progressbar" aria-label={label} aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`f-fill ${over ? 'over' : ''}`} style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

/** One day's meals against calorie, protein, carb, fat and meal-count targets. */
export default function NutritionPanel({ date, onDate, meals, targets, onTargets }: Props) {
  const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [editing, setEditing] = useState(false);
  const totals = mealTotals(meals);
  const today = toISODate();
  const set = (k: keyof typeof f, v: string, max = 5) => setF((x) => ({ ...x, [k]: k === 'name' ? v.slice(0, 60) : v.replace(/\D/g, '').slice(0, max) }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const protein = num(f.protein);
    const carbs = num(f.carbs);
    const fat = num(f.fat);
    // Calories can be typed, or worked out from the macros (4/4/9).
    const kcal = Math.round(num(f.kcal)) || kcalFromMacros(protein, carbs, fat);
    if (!kcal && !protein) return;
    await db.meals.put({ id: newId(), date, name: f.name.trim() || `Meal ${meals.length + 1}`, kcal, protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) });
    setF({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  };

  const setTarget = (key: keyof Targets, raw: string) => {
    const v = Math.round(num(raw));
    onTargets({ ...targets, [key]: key === 'meals' ? Math.min(v, 12) : v });
  };

  return (
    <section className="f-card space-y-4" data-testid="nutrition-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="f-h">Nutrition</h2>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" aria-label="Previous day" className="f-btn" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => onDate(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center" data-testid="nutrition-date">
            {date === today ? 'Today' : dateLabel(date)}
          </span>
          <button type="button" aria-label="Next day" className="f-btn" style={{ minHeight: 32, padding: '0 8px' }} disabled={date >= today} onClick={() => onDate(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3" data-testid="nutrition-bars">
        <Bar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" testId="bar-kcal" />
        <Bar label="Protein" value={totals.protein} target={targets.protein} unit="g" />
        <Bar label="Carbs" value={totals.carbs} target={targets.carbs} unit="g" />
        <Bar label="Fat" value={totals.fat} target={targets.fat} unit="g" />
        <Bar label="Meals" value={totals.count} target={targets.meals} unit="meals" testId="bar-meals" />
      </div>

      <div>
        <button type="button" className="text-[11px] font-semibold f-accent hover:underline" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Hide targets' : 'Edit daily targets'}
        </button>
        {editing && (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 f-small">
            {(
              [
                ['kcal', 'Calories'],
                ['protein', 'Protein g'],
                ['carbs', 'Carbs g'],
                ['fat', 'Fat g'],
                ['meals', 'Meals / day'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span>{label}</span>
                <input className="f-input f-center" inputMode="numeric" data-testid={`target-${key}`} value={targets[key]} onChange={(e) => setTarget(key, e.target.value)} />
              </label>
            ))}
            <p className="col-span-full" style={{ fontSize: 10 }}>
              Starting points only. Adjust them to your own goals; this is not medical or dietary advice.
            </p>
          </div>
        )}
      </div>

      <ul className="space-y-1.5" data-testid="meal-list">
        {meals.length === 0 && <li className="f-small">No meals logged for this day.</li>}
        {meals.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }}>
            <span className="min-w-0 truncate">{m.name}</span>
            <span className="flex shrink-0 items-center gap-3 f-muted">
              {m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat}
              <button type="button" aria-label={`Remove ${m.name}`} className="hover:text-white" onClick={() => void db.meals.delete(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-2">
        <input className="f-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={`Meal ${meals.length + 1}`} aria-label="Meal name" />
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2">
          <input className="f-input f-center" inputMode="numeric" value={f.kcal} onChange={(e) => set('kcal', e.target.value)} placeholder="kcal" aria-label="Calories" data-testid="meal-kcal" />
          <input className="f-input f-center" inputMode="numeric" value={f.protein} onChange={(e) => set('protein', e.target.value, 4)} placeholder="P g" aria-label="Protein in grams" data-testid="meal-protein" />
          <input className="f-input f-center" inputMode="numeric" value={f.carbs} onChange={(e) => set('carbs', e.target.value, 4)} placeholder="C g" aria-label="Carbs in grams" data-testid="meal-carbs" />
          <input className="f-input f-center" inputMode="numeric" value={f.fat} onChange={(e) => set('fat', e.target.value, 4)} placeholder="F g" aria-label="Fat in grams" data-testid="meal-fat" />
          <button type="submit" data-testid="add-meal" className="f-btn-primary">
            Add
          </button>
        </div>
        <p className="f-small">Leave kcal empty to work it out from the macros (4 / 4 / 9 per gram).</p>
      </form>
    </section>
  );
}
