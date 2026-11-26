import { useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { ExerciseLog, newId, toISODate } from '../../utils/fitness';
import { QuickLogResult, parseQuickLog } from '../../utils/quickLog';
import { db } from '../../utils/fitnessDb';

interface Props {
  /** Exercises read from the note; the session logger adds them to the open session. */
  onExercises: (exercises: ExerciseLog[]) => void;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * One box for fast, partial logging: type "2 eggs, toast" or "bench 80x8x3", check what was understood,
 * and add it. It is read by plain rules on this device, so nothing is sent anywhere, and numbers you
 * type always win over the estimates.
 */
export default function QuickLog({ onExercises, notify }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<QuickLogResult | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);

  const read = () => {
    setError('');
    if (!text.trim()) {
      setResult(null);
      return;
    }
    const r = parseQuickLog(text);
    setResult(r);
    if (r.meals.length === 0 && r.exercises.length === 0) setError('Nothing I could read there. Try "2 eggs, toast", "chicken 450 kcal 40p" or "bench 80x8x3".');
  };

  const drop = (kind: 'meal' | 'exercise', i: number) =>
    setResult((r) => (r ? { ...r, meals: kind === 'meal' ? r.meals.filter((_, j) => j !== i) : r.meals, exercises: kind === 'exercise' ? r.exercises.filter((_, j) => j !== i) : r.exercises } : r));

  const add = async () => {
    if (!result || busy.current || (result.meals.length === 0 && result.exercises.length === 0)) return;
    busy.current = true;
    try {
      const date = toISODate();
      for (const m of result.meals) await db.meals.put({ id: newId(), date, name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
      if (result.exercises.length) onExercises(result.exercises);
      const parts = [result.meals.length ? `${result.meals.length} meal${result.meals.length > 1 ? 's' : ''}` : '', result.exercises.length ? `${result.exercises.length} exercise${result.exercises.length > 1 ? 's' : ''}` : ''].filter(Boolean);
      notify('success', `Added ${parts.join(' and ')}. Exercises sit in your open session until you finish and save it.`);
      setText('');
      setResult(null);
      setError('');
    } catch {
      setError('Could not save to this browser (storage may be full or blocked). Try again.');
    } finally {
      busy.current = false;
    }
  };

  const nothing = result && result.meals.length === 0 && result.exercises.length === 0;

  return (
    <section className="f-card space-y-3" data-testid="quick-log">
      <div>
        <h2 className="f-h flex items-center gap-2">
          <Zap className="h-4 w-4 f-accent" aria-hidden="true" /> Quick log
        </h2>
        <p className="f-small">Type what you ate or lifted. Read on this device; nothing is sent anywhere.</p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          read();
        }}
      >
        <textarea
          className="f-input"
          rows={2}
          style={{ height: 'auto', padding: 10 }}
          value={text}
          maxLength={600}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              read();
            }
          }}
          placeholder={'2 eggs, toast, 450 kcal\nbench 80x8x3, squat 5x5 @ 100'}
          aria-label="Quick log: what you ate or lifted"
          data-testid="quick-text"
        />
        <button type="submit" className="f-btn" data-testid="quick-read" style={{ minHeight: 44 }} disabled={!text.trim()}>
          Read it
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="quick-error">
          {error}
        </p>
      )}

      {result && !nothing && (
        <div className="space-y-2" data-testid="quick-preview">
          <ul className="space-y-1.5">
            {result.meals.map((m, i) => (
              <li key={`m${i}`} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="quick-meal">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">Meal · {m.name}</span>
                  <span className="block f-muted">
                    {m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat}
                    {m.estimated ? ' · estimate' : ''}
                  </span>
                  {m.note && (
                    <span className="block" style={{ color: 'var(--f-gold)' }}>
                      {m.note}
                    </span>
                  )}
                </span>
                <button type="button" aria-label={`Leave out ${m.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center f-muted hover:text-white" onClick={() => drop('meal', i)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {result.exercises.map((x, i) => (
              <li key={`e${i}`} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="quick-exercise">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">Exercise · {x.name}</span>
                  <span className="block f-muted">
                    {x.sets.length} × {x.sets[0].reps}
                    {x.sets[0].weight ? ` @ ${x.sets[0].weight}` : ' (add the weight in your session)'}
                  </span>
                </span>
                <button type="button" aria-label={`Leave out ${x.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center f-muted hover:text-white" onClick={() => drop('exercise', i)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {result.unparsed.length > 0 && (
            <p className="f-small" data-testid="quick-unparsed">
              Could not read: {result.unparsed.map((u) => `"${u}"`).join(', ')}
            </p>
          )}
          <p className="f-small">Estimates use typical values; type your own numbers to override them.</p>
          <button type="button" className="f-btn-primary" data-testid="quick-add" style={{ minHeight: 44 }} onClick={() => void add()}>
            Add to today
          </button>
        </div>
      )}
    </section>
  );
}
