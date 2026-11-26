import { useEffect, useRef, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { ExerciseLog, newId, toISODate } from '../../utils/fitness';
import { QuickLogResult, parseQuickLog } from '../../utils/quickLog';
import { db } from '../../utils/fitnessDb';
import { protectStorage } from '../../utils/offline';

interface Props {
  /** What this box is for: sets on the Train page, meals on the Nutrition page. A note of the other kind is pointed to its page. */
  mode: 'workout' | 'meal';
  /** Exercises read from the note; the session logger adds them to the open session (workout mode). */
  onExercises?: (exercises: ExerciseLog[]) => void;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  /** Changes when something else (a quick action on Today) asks for the box to take focus. */
  focusKey?: number;
}

const COPY = {
  workout: { title: 'Log sets in a sentence', placeholder: 'bench 80x8x3, squat 5x5 @ 100', example: '"bench 80x8x3"' },
  meal: { title: 'Log a meal in a sentence', placeholder: '2 eggs, toast, 450 kcal', example: '"2 eggs, toast" or "chicken 450 kcal 40p"' },
} as const;

/**
 * One box for fast, partial logging: type "2 eggs, toast" or "bench 80x8x3", check what was understood,
 * and add it. It is read by plain rules on this device, so nothing is sent anywhere, and numbers you
 * type always win over the estimates.
 */
export default function QuickLog({ mode, onExercises, notify, focusKey }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<QuickLogResult | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [hint, setHint] = useState('');
  useEffect(() => {
    if (focusKey) areaRef.current?.focus();
  }, [focusKey]);

  const read = () => {
    setError('');
    if (!text.trim()) {
      setResult(null);
      return;
    }
    const parsed = parseQuickLog(text);
    // Only this page's kind is added here; the other kind is pointed to its own page instead of being dropped silently.
    const r = { ...parsed, meals: mode === 'meal' ? parsed.meals : [], exercises: mode === 'workout' ? parsed.exercises : [] };
    setHint(mode === 'meal' && parsed.exercises.length ? 'That looks like workout notes: log those on the Train tab.' : mode === 'workout' && parsed.meals.length ? 'That looks like a meal: log it on the Nutrition tab.' : '');
    setResult(r);
    if (r.meals.length === 0 && r.exercises.length === 0 && !parsed.exercises.length && !parsed.meals.length) setError(`Nothing I could read there. Try ${COPY[mode].example}.`);
  };

  const drop = (kind: 'meal' | 'exercise', i: number) =>
    setResult((r) => (r ? { ...r, meals: kind === 'meal' ? r.meals.filter((_, j) => j !== i) : r.meals, exercises: kind === 'exercise' ? r.exercises.filter((_, j) => j !== i) : r.exercises } : r));

  const add = async () => {
    if (!result || busy.current || (result.meals.length === 0 && result.exercises.length === 0)) return;
    busy.current = true;
    try {
      const date = toISODate();
      for (const m of result.meals) await db.meals.put({ id: newId(), date, name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
      void protectStorage();
      if (result.exercises.length) onExercises?.(result.exercises);
      const parts = [result.meals.length ? `${result.meals.length} meal${result.meals.length > 1 ? 's' : ''}` : '', result.exercises.length ? `${result.exercises.length} exercise${result.exercises.length > 1 ? 's' : ''}` : ''].filter(Boolean);
      notify('success', mode === 'workout' ? `Added ${parts.join(' and ')} to your session. They are saved when you finish it.` : `Added ${parts.join(' and ')}.`);
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
          <Zap className="h-4 w-4 f-accent" aria-hidden="true" /> {COPY[mode].title}
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
          placeholder={COPY[mode].placeholder}
          ref={areaRef}
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

      {hint && (
        <p role="status" className="text-xs" style={{ color: 'var(--f-gold)' }} data-testid="quick-hint">
          {hint}
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
