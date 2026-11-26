import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { DAILY_LIMITS, MEAL_LIMITS, Meal, Targets, checkMealKcal, dateLabel, kcalFromMacros, mealTotals, newId, num, progress, shiftDate, toISODate } from '../../utils/fitness';
import TargetsCheck from './TargetsCheck';
import { db } from '../../utils/fitnessDb';
import type { MealDraft } from '../../utils/mealScan';
import MealScan from './MealScan';
import { useFitness } from './FitnessProvider';

interface Props {
  date: string;
  onDate: (iso: string) => void;
  meals: Meal[];
  targets: Targets;
  onTargets: (t: Partial<Targets>) => void;
  /** Meals you log often, newest first: one tap adds one again to the day shown. */
  recent?: Meal[];
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
export default function NutritionPanel({ date, onDate, meals, targets, onTargets, recent = [] }: Props) {
  const { offerUndo } = useFitness();
  const [f, setF] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [editing, setEditing] = useState(false);
  /** The meal being edited (the whole record, so its id and date survive a change of day), or null when adding. */
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /** Shown after a photo scan: the numbers in the form are an estimate to check. */
  const [scanNote, setScanNote] = useState('');
  /** True while calories follow the macros (4/4/9); false once the person has typed their own figure. */
  const [kcalAuto, setKcalAuto] = useState(true);
  const busy = useRef(false); // set synchronously, so two taps in the same tick cannot both get through
  const totals = mealTotals(meals);
  const today = toISODate();

  const fromMacros = (x: { protein: string; carbs: string; fat: string }) => kcalFromMacros(num(x.protein), num(x.carbs), num(x.fat));
  const asKcalText = (n: number) => (n > 0 ? String(Math.min(n, MEAL_LIMITS.kcal)) : '');
  const set = (k: keyof typeof f, v: string) => {
    if (k === 'name') {
      setF((x) => ({ ...x, name: v.slice(0, 60) }));
      return;
    }
    // Digits only, and never more than a meal can realistically hold.
    const digits = v.replace(/\D/g, '').slice(0, 5);
    const value = digits === '' ? '' : String(Math.min(Number(digits), MEAL_LIMITS[k]));
    setF((x) => {
      const next = { ...x, [k]: value };
      // Calories follow the macros until the person types their own; clearing the field hands it back.
      if (k === 'kcal') {
        if (value === '') next.kcal = asKcalText(fromMacros(next));
      } else if (kcalAuto) next.kcal = asKcalText(fromMacros(next));
      return next;
    });
    if (k === 'kcal') setKcalAuto(value === '');
  };

  const mp = num(f.protein);
  const mc = num(f.carbs);
  const mf = num(f.fat);
  const typedKcal = Math.round(num(f.kcal));
  const macrosEntered = mp > 0 || mc > 0 || mf > 0;
  const kcalCheck = checkMealKcal(typedKcal, mp, mc, mf);
  const conflict = macrosEntered && typedKcal > 0 && !kcalCheck.ok;
  const useMacroKcal = () => {
    setF((x) => ({ ...x, kcal: asKcalText(kcalCheck.macroKcal) }));
    setKcalAuto(true);
    setError('');
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current) return; // a double tap must not add the meal twice
    const protein = num(f.protein);
    const carbs = num(f.carbs);
    const fat = num(f.fat);
    // Calories can be typed, or worked out from the macros (4/4/9).
    const kcal = Math.min(MEAL_LIMITS.kcal, Math.round(num(f.kcal)) || kcalFromMacros(protein, carbs, fat));
    if (!kcal && !protein) {
      setError('Enter calories or at least some protein for the meal.');
      return;
    }
    // Calories that cannot be squared with the macros are a typo: stop and say what they should be.
    if (conflict) {
      setError(`Calories (${typedKcal}) do not match your macros, which add up to ${kcalCheck.macroKcal} kcal (4 per g of protein and carbs, 9 per g of fat). Use ${kcalCheck.macroKcal} or correct the numbers.`);
      return;
    }
    setError('');
    // Editing keeps the original id and date, so the put replaces that record instead of inserting a new one.
    const existing = editingMeal;
    busy.current = true;
    setSaving(true);
    try {
      await db.meals.put({ id: existing?.id ?? newId(), date: existing?.date ?? date, name: f.name.trim() || existing?.name || `Meal ${meals.length + 1}`, kcal, protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) });
    } catch {
      setError('Could not save to this browser (storage may be full or blocked). Try again.');
      busy.current = false;
      setSaving(false);
      return;
    }
    busy.current = false;
    setSaving(false);
    setF({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
    setKcalAuto(true);
    setEditingMeal(null);
    setScanNote('');
  };

  // A scan only fills the form: nothing is saved until the person checks it and presses Add.
  const applyDraft = (d: MealDraft) => {
    if (d.items.length === 0) {
      setScanNote('');
      return;
    }
    setEditingMeal(null);
    setError('');
    setF({ name: d.name, kcal: String(d.kcal), protein: String(d.protein), carbs: String(d.carbs), fat: String(d.fat) });
    setKcalAuto(false); // the estimate's own calories stand until changed
    setScanNote('Estimated from your photo. Check the portions and numbers, change anything that is off, then press Add.');
  };

  // One tap puts a recent meal on the day shown; Undo takes it straight back.
  const relog = async (m: Meal) => {
    if (busy.current) return;
    busy.current = true;
    const id = newId();
    try {
      await db.meals.put({ id, date, name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
      offerUndo(`Added ${m.name}`, async () => {
        await db.meals.delete(id);
      });
    } catch {
      setError('Could not save to this browser (storage may be full or blocked). Try again.');
    } finally {
      busy.current = false;
    }
  };

  const startEdit = (m: Meal) => {
    setEditingMeal(m);
    setError('');
    setKcalAuto(false);
    setF({ name: m.name, kcal: String(m.kcal), protein: String(m.protein), carbs: String(m.carbs), fat: String(m.fat) });
  };
  const cancelEdit = () => {
    setScanNote('');
    setEditingMeal(null);
    setError('');
    setKcalAuto(true);
    setF({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  };

  const setTarget = (key: keyof Targets, raw: string) => {
    const v = Math.round(num(raw));
    onTargets({ [key]: Math.min(v, DAILY_LIMITS[key]) });
  };

  return (
    <section className="f-card space-y-4" data-testid="nutrition-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="f-h">Nutrition</h2>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" aria-label="Previous day" className="f-btn" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => {
              cancelEdit();
              onDate(shiftDate(date, -1));
            }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center" data-testid="nutrition-date">
            {date === today ? 'Today' : dateLabel(date)}
          </span>
          <button type="button" aria-label="Next day" className="f-btn" style={{ minHeight: 32, padding: '0 8px' }} disabled={date >= today} onClick={() => {
              cancelEdit();
              onDate(shiftDate(date, 1));
            }}>
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
        <button type="button" className="inline-flex min-h-[32px] items-center text-[11px] font-semibold f-accent hover:underline" onClick={() => setEditing((v) => !v)}>
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
            <TargetsCheck targets={targets} onFix={(kcal) => onTargets({ kcal })} />
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
            <span className="min-w-0 flex-1">
              <span className="block truncate" data-testid="meal-name">{m.name}</span>
              <span className="block f-muted">
                {m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat}
              </span>
            </span>
            <span className="flex shrink-0 items-center f-muted">
              <button type="button" aria-label={`Edit ${m.name}`} data-testid="meal-edit" className="flex h-9 w-9 items-center justify-center hover:text-white" onClick={() => startEdit(m)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                data-testid="meal-delete"
                className="flex h-9 w-9 items-center justify-center hover:text-white"
                onClick={() => {
                  if (editingMeal?.id === m.id) cancelEdit();
                  void db.meals.delete(m.id);
                  offerUndo(`Removed ${m.name}`, async () => {
                    await db.meals.put(m);
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {recent.length > 0 && !editingMeal && (
        <div className="space-y-1.5" data-testid="recent-meals">
          <div className="f-small">Log again</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((m) => (
              <button key={m.id} type="button" className="f-chip" style={{ minHeight: 36 }} data-testid="recent-meal" aria-label={`Add ${m.name} again, ${m.kcal} calories`} onClick={() => void relog(m)}>
                {m.name} · {m.kcal}
              </button>
            ))}
          </div>
        </div>
      )}

      <MealScan onDraft={applyDraft} />

      <form onSubmit={add} className="space-y-2">
        {scanNote && (
          <p role="status" className="text-xs" style={{ color: 'var(--f-gold)' }} data-testid="scan-note">
            {scanNote}
          </p>
        )}
        <input className="f-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={`Meal ${meals.length + 1}`} aria-label="Meal name" />
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2">
          <input className="f-input f-center" inputMode="numeric" value={f.kcal} onChange={(e) => set('kcal', e.target.value)} placeholder="kcal" aria-label="Calories" data-testid="meal-kcal" />
          <input className="f-input f-center" inputMode="numeric" value={f.protein} onChange={(e) => set('protein', e.target.value)} placeholder="P g" aria-label="Protein in grams" data-testid="meal-protein" />
          <input className="f-input f-center" inputMode="numeric" value={f.carbs} onChange={(e) => set('carbs', e.target.value)} placeholder="C g" aria-label="Carbs in grams" data-testid="meal-carbs" />
          <input className="f-input f-center" inputMode="numeric" value={f.fat} onChange={(e) => set('fat', e.target.value)} placeholder="F g" aria-label="Fat in grams" data-testid="meal-fat" />
          <button type="submit" data-testid="add-meal" className="f-btn-primary" disabled={saving}>
            {editingMeal ? 'Save' : 'Add'}
          </button>
        </div>
        {editingMeal && (
          <button type="button" className="f-btn" data-testid="meal-cancel-edit" onClick={cancelEdit}>
            Cancel editing
          </button>
        )}
        {error && (
          <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="meal-error">
            {error}
          </p>
        )}
        {macrosEntered && (
          <p className="f-small" data-testid="macro-kcal-line">
            Macros add up to <strong style={{ color: 'var(--f-text)' }}>{kcalCheck.macroKcal} kcal</strong> (4 per g of protein and carbs, 9 per g of fat).
            {conflict && (
              <>
                {' '}
                <span role="status" data-testid="kcal-conflict" style={{ color: 'var(--f-gold)' }}>
                  Your calories ({typedKcal}) are far from that.
                </span>{' '}
                <button type="button" className="underline" style={{ minHeight: 32 }} data-testid="use-macro-kcal" onClick={useMacroKcal}>
                  Use {kcalCheck.macroKcal} kcal
                </button>
              </>
            )}
          </p>
        )}
        <p className="f-small">Calories fill in from the macros as you type them. Type your own figure to override it; it has to roughly match the macros.</p>
      </form>
    </section>
  );
}
