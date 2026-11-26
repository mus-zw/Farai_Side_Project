import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Meal, Targets, dateLabel, mealTotals, newId, num, progress, shiftDate, toISODate } from '../../utils/fitness';

interface Props {
  date: string;
  onDate: (iso: string) => void;
  meals: Meal[];
  targets: Targets;
  onTargets: (t: Targets) => void;
  onAdd: (m: Meal) => void;
  onRemove: (id: string) => void;
}

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const p = progress(value, target);
  const over = target > 0 && value > target;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-neutral-400">{label}</span>
        <span className="text-neutral-200">
          {Math.round(value)} / {target} {unit}
          {target > 0 && (
            <span className={over ? 'text-amber-300' : 'text-neutral-500'}>
              {' '}
              · {over ? `${Math.round(value - target)} over` : `${Math.round(target - value)} left`}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-label={label} aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${over ? 'bg-amber-400' : 'bg-[#32FF00]'}`} style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

const field =
  'min-h-[40px] w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none';

/** One day's meals against calorie, protein and meal-count targets. */
export default function NutritionCard({ date, onDate, meals, targets, onTargets, onAdd, onRemove }: Props) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [editing, setEditing] = useState(false);
  const totals = mealTotals(meals);
  const today = toISODate();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!num(kcal) && !num(protein)) return;
    onAdd({ id: newId(), name: name.trim() || `Meal ${meals.length + 1}`, kcal: Math.round(num(kcal)), protein: Math.round(num(protein)) });
    setName('');
    setKcal('');
    setProtein('');
  };

  const setTarget = (key: keyof Targets, raw: string) => {
    const v = Math.round(num(raw));
    onTargets({ ...targets, [key]: key === 'meals' ? Math.min(v, 12) : v });
  };

  return (
    <section className="min-w-0 rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5 space-y-4" data-testid="nutrition-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white">Nutrition</h2>
        <div className="flex items-center gap-1 text-xs text-neutral-300">
          <button type="button" aria-label="Previous day" onClick={() => onDate(shiftDate(date, -1))} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center" data-testid="nutrition-date">
            {date === today ? 'Today' : dateLabel(date)}
          </span>
          <button
            type="button"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => onDate(shiftDate(date, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3" data-testid="nutrition-bars">
        <Bar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" />
        <Bar label="Protein" value={totals.protein} target={targets.protein} unit="g" />
        <Bar label="Meals" value={totals.count} target={targets.meals} unit="meals" />
      </div>

      <div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="text-[11px] font-semibold text-[#32FF00] hover:underline">
          {editing ? 'Hide targets' : 'Edit daily targets'}
        </button>
        {editing && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-neutral-400">
            {(
              [
                ['kcal', 'Calories', 'kcal'],
                ['protein', 'Protein', 'g'],
                ['meals', 'Meals / day', ''],
              ] as const
            ).map(([key, label, u]) => (
              <label key={key} className="space-y-1">
                <span>
                  {label} {u && `(${u})`}
                </span>
                <input
                  inputMode="numeric"
                  data-testid={`target-${key}`}
                  value={targets[key]}
                  onChange={(e) => setTarget(key, e.target.value)}
                  className={`${field} w-full text-center`}
                />
              </label>
            ))}
            <p className="col-span-3 text-[10px] text-neutral-600">Starting points only. Adjust them to your own goals; this is not medical or dietary advice.</p>
          </div>
        )}
      </div>

      <ul className="space-y-1.5" data-testid="meal-list">
        {meals.length === 0 && <li className="text-xs text-neutral-500">No meals logged for this day.</li>}
        {meals.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-neutral-200">{m.name}</span>
            <span className="flex shrink-0 items-center gap-3 text-neutral-400">
              {m.kcal} kcal · {m.protein} g
              <button type="button" aria-label={`Remove ${m.name}`} onClick={() => onRemove(m.id)} className="text-neutral-600 hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_4.25rem_4.25rem_auto] gap-2">
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={`Meal ${meals.length + 1}`} aria-label="Meal name" className={field} />
        <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="kcal" aria-label="Calories" data-testid="meal-kcal" className={`${field} text-center`} />
        <input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="g protein" aria-label="Protein in grams" data-testid="meal-protein" className={`${field} text-center`} />
        <button type="submit" data-testid="add-meal" className="min-h-[40px] rounded-lg bg-[#32FF00] px-4 text-xs font-bold text-neutral-950">
          Add
        </button>
      </form>
    </section>
  );
}
