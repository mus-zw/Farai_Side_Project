import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import {
  DAY_LABEL,
  DAY_TYPES,
  DayType,
  ExerciseLog,
  FitnessData,
  Session,
  blankSet,
  dateLabel,
  newExercise,
  newSession,
  num,
  previousSets,
  sessionSetCount,
  sessionVolume,
} from '../../utils/fitness';

interface Props {
  data: FitnessData;
  update: (fn: (d: FitnessData) => FitnessData) => void;
  suggested: DayType;
  onSaved: (message: string) => void;
}

const cell =
  'h-9 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 text-center text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none';

const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Start a Push, Pull or Legs session, then log each set as one row: weight, reps, done. */
export default function SessionLogger({ data, update, suggested, onSaved }: Props) {
  const draft = data.draft;
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const unit = data.unit;

  const setDraft = (fn: (s: Session) => Session) =>
    update((d) => (d.draft ? { ...d, draft: fn(d.draft) } : d));

  const patchExercise = (id: string, fn: (e: ExerciseLog) => ExerciseLog) =>
    setDraft((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  const start = (day: DayType) => {
    setError('');
    update((d) => ({ ...d, draft: newSession(day) }));
  };

  const save = () => {
    if (!draft) return;
    if (sessionSetCount(draft) === 0) {
      setError('Tick at least one set as done (with reps) before saving.');
      return;
    }
    setError('');
    // Drop exercises that had nothing done, keep the sets that did count.
    const exercises = draft.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done && num(s.reps) > 0) }))
      .filter((e) => e.sets.length > 0);
    const saved: Session = { ...draft, exercises, savedAt: Date.now() };
    update((d) => ({ ...d, sessions: [saved, ...d.sessions], draft: null }));
    onSaved(`${DAY_LABEL[saved.day]} session saved: ${sessionSetCount(saved)} sets, ${fmtKg(sessionVolume(saved))} ${unit} volume.`);
  };

  if (!draft) {
    return (
      <section className="rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5 space-y-3" data-testid="session-start">
        <h2 className="text-base font-bold text-white">Log a session</h2>
        <p className="text-xs text-neutral-500">Pick a day to start. Your sets are saved as you type, even if you reload.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_TYPES.map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`start-${d}`}
              onClick={() => start(d)}
              className={`min-h-[44px] rounded-xl px-5 text-sm font-bold ${
                d === suggested ? 'bg-[#32FF00] text-neutral-950' : 'border border-neutral-700 text-neutral-200 hover:border-neutral-500'
              }`}
            >
              Start {DAY_LABEL[d]}
              {d === suggested ? ' (next up)' : ''}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#32FF00]/40 bg-[#16213E]/40 p-5 space-y-5" data-testid="session-draft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">
            {DAY_LABEL[draft.day]} session <span className="text-xs font-normal text-neutral-500">· {dateLabel(draft.date)}</span>
          </h2>
          <p className="text-xs text-neutral-500" data-testid="draft-summary">
            {sessionSetCount(draft)} sets done · {fmtKg(sessionVolume(draft))} {unit} volume
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Discard this session without saving?')) update((d) => ({ ...d, draft: null }));
            }}
            className="min-h-[40px] rounded-lg border border-neutral-700 px-3 text-xs font-semibold text-neutral-300 hover:border-neutral-500"
          >
            Discard
          </button>
          <button
            type="button"
            data-testid="save-session"
            onClick={save}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#32FF00] px-4 text-xs font-bold text-neutral-950"
          >
            <Check className="h-3.5 w-3.5" /> Finish &amp; save
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-300" data-testid="session-error">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {draft.exercises.map((ex) => {
          const prev = previousSets(data.sessions, ex.name);
          return (
            <div key={ex.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3" data-testid="exercise">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{ex.name}</div>
                  {ex.target && <div className="text-[11px] text-neutral-500">Target {ex.target} reps</div>}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${ex.name}`}
                  onClick={() => setDraft((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* One row per set, laid out horizontally; scrolls sideways on a narrow screen. */}
              <div className="overflow-x-auto">
                <div className="min-w-[340px] space-y-1.5">
                  <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem_2rem] gap-2 text-center text-[10px] uppercase tracking-wide text-neutral-500">
                    <span>Set</span>
                    <span>Last</span>
                    <span>{unit}</span>
                    <span>Reps</span>
                    <span>Done</span>
                    <span />
                  </div>
                  {ex.sets.map((set, i) => {
                    const p = prev?.[i] ?? prev?.[prev.length - 1];
                    return (
                      <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem_2rem] items-center gap-2" data-testid="set-row">
                        <span className="text-center text-xs text-neutral-400">{i + 1}</span>
                        <span className="truncate text-center text-[11px] text-neutral-500">
                          {p ? `${p.weight || 0}×${p.reps}` : '–'}
                        </span>
                        <input
                          inputMode="decimal"
                          aria-label={`${ex.name} set ${i + 1} weight`}
                          placeholder={p?.weight || '0'}
                          value={set.weight}
                          onChange={(e) =>
                            patchExercise(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((s, j) => (j === i ? { ...s, weight: e.target.value.slice(0, 8) } : s)),
                            }))
                          }
                          className={cell}
                        />
                        <input
                          inputMode="numeric"
                          aria-label={`${ex.name} set ${i + 1} reps`}
                          placeholder={p?.reps || '0'}
                          value={set.reps}
                          onChange={(e) =>
                            patchExercise(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((s, j) => (j === i ? { ...s, reps: e.target.value.replace(/\D/g, '').slice(0, 3) } : s)),
                            }))
                          }
                          className={cell}
                        />
                        <input
                          type="checkbox"
                          aria-label={`${ex.name} set ${i + 1} done`}
                          checked={set.done}
                          onChange={(e) =>
                            patchExercise(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((s, j) => (j === i ? { ...s, done: e.target.checked } : s)),
                            }))
                          }
                          className="mx-auto h-5 w-5 accent-[#32FF00]"
                        />
                        <button
                          type="button"
                          aria-label={`Remove set ${i + 1}`}
                          onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}
                          className="text-neutral-600 hover:text-rose-300"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  patchExercise(ex.id, (x) => {
                    // A new set starts from the previous one, which is how most people train.
                    const last = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, last ? { weight: last.weight, reps: last.reps, done: false } : blankSet()] };
                  })
                }
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#32FF00] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add set
              </button>
            </div>
          );
        })}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          setDraft((s) => ({ ...s, exercises: [...s.exercises, newExercise(name)] }));
          setNewName('');
        }}
      >
        <input
          value={newName}
          maxLength={80}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add an exercise…"
          aria-label="Add an exercise"
          className="min-h-[40px] flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none"
        />
        <button type="submit" className="min-h-[40px] rounded-lg border border-neutral-700 px-4 text-xs font-semibold text-neutral-200 hover:border-neutral-500">
          Add
        </button>
      </form>
    </section>
  );
}
