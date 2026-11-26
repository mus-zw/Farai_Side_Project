import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import {
  DAY_LABEL,
  DAY_TYPES,
  DayType,
  ExerciseLog,
  Session,
  SetEntry,
  SET_TYPES,
  SET_TYPE_LABEL,
  SET_TYPE_TAG,
  Settings,
  blankSet,
  dateLabel,
  newExercise,
  newSession,
  num,
  previousSets,
  sessionSetCount,
  sessionVolume,
  workingSets,
} from '../../utils/fitness';
import { estimate1RM } from '../../utils/fitnessMath';
import { db, getDraft, saveDraft } from '../../utils/fitnessDb';

interface Props {
  /** Saved sessions, newest first. */
  sessions: Session[];
  settings: Settings;
  suggested: DayType;
  onSaved: (message: string) => void;
  startRest: (seconds: number) => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The session in progress, kept in IndexedDB so a reload or a closed tab loses nothing. */
function useDraft() {
  const [draft, setDraft] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    getDraft().then((d) => {
      if (!alive) return;
      setDraft(d);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (loaded) void saveDraft(draft);
  }, [draft, loaded]);
  return { draft, setDraft, loaded };
}

/** Start a Push, Pull or Legs session, then log each set as one row. Sets start prefilled from last time. */
export default function SessionLogger({ sessions, settings, suggested, onSaved, startRest }: Props) {
  const { draft, setDraft, loaded } = useDraft();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const unit = settings.unit;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const patch = (fn: (s: Session) => Session) => setDraft((d) => (d ? fn(d) : d));
  const patchExercise = (id: string, fn: (e: ExerciseLog) => ExerciseLog) =>
    patch((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? fn(e) : e)) }));
  const patchSet = (exId: string, i: number, fn: (s: SetEntry) => SetEntry) =>
    patchExercise(exId, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === i ? fn(s) : s)) }));

  const start = (day: DayType) => {
    setError('');
    setDraft(newSession(day, undefined, sessions));
  };

  const toggleDone = (exId: string, i: number, set: SetEntry, done: boolean) => {
    patchSet(exId, i, (s) => ({ ...s, done }));
    const { autoRest, restSeconds } = settingsRef.current;
    if (done && autoRest) startRest(set.type === 'warmup' ? Math.min(45, restSeconds) : restSeconds);
  };

  const cycleType = (exId: string, i: number) =>
    patchSet(exId, i, (s) => ({ ...s, type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length] }));

  const save = async () => {
    if (!draft) return;
    if (sessionSetCount(draft) === 0) {
      setError('Tick at least one working set as done (with reps) before saving. Warm-ups do not count.');
      return;
    }
    setError('');
    const exercises = draft.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done && num(s.reps) > 0) }))
      .filter((e) => e.sets.length > 0);
    const saved: Session = { ...draft, exercises, savedAt: Date.now() };
    await db.sessions.put(saved);
    setDraft(null);
    onSaved(`${DAY_LABEL[saved.day]} session saved: ${sessionSetCount(saved)} working sets, ${fmt(sessionVolume(saved))} ${unit} volume.`);
  };

  if (!loaded) return <section className="f-card f-small">Loading…</section>;

  if (!draft) {
    return (
      <section className="f-card space-y-3" data-testid="session-start">
        <h2 className="f-h">Log a session</h2>
        <p className="f-small">Pick a day. Your sets start prefilled with what you lifted last time, and are saved as you type.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_TYPES.map((d) => (
            <button key={d} type="button" data-testid={`start-${d}`} onClick={() => start(d)} className={d === suggested ? 'f-btn-primary' : 'f-btn'} style={{ minHeight: 44, padding: '0 20px' }}>
              Start {DAY_LABEL[d]}
              {d === suggested ? ' (next up)' : ''}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="f-card f-card-accent space-y-4" data-testid="session-draft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="f-h">
            {DAY_LABEL[draft.day]} session <span className="f-small">· {dateLabel(draft.date)}</span>
          </h2>
          <p className="f-small" data-testid="draft-summary">
            {sessionSetCount(draft)} sets done · {fmt(sessionVolume(draft))} {unit} volume
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="f-btn"
            onClick={() => {
              if (window.confirm('Discard this session without saving?')) setDraft(null);
            }}
          >
            Discard
          </button>
          <button type="button" data-testid="save-session" className="f-btn-primary" onClick={() => void save()}>
            <Check className="h-4 w-4" /> Finish &amp; save
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="session-error">
          {error}
        </p>
      )}

      {draft.exercises.map((ex) => {
        const prev = previousSets(sessions, ex.name);
        return (
          <div key={ex.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="exercise">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{ex.name}</div>
                {ex.target && <div className="f-small">Target {ex.target} reps</div>}
              </div>
              <button type="button" aria-label={`Remove ${ex.name}`} className="f-muted hover:text-white" onClick={() => patch((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* One row per set, laid out horizontally (the 1RM column is hidden on a phone). */}
            <div>
              <div className="space-y-1.5">
                <div className="f-setgrid text-center text-[10px] uppercase tracking-wide f-muted">
                  <span>Set</span>
                  <span>Last</span>
                  <span>{unit}</span>
                  <span>Reps</span>
                  <span className="f-e1">1RM</span>
                  <span>Done</span>
                  <span />
                </div>
                {ex.sets.map((set, i) => {
                  const p = prev?.[i] ?? prev?.[prev.length - 1];
                  const e1 = set.type === 'warmup' ? null : estimate1RM(num(set.weight), num(set.reps));
                  return (
                    <div key={i} className="f-setgrid" style={{ opacity: set.type === 'warmup' ? 0.8 : 1 }} data-testid="set-row" data-type={set.type}>
                      <button
                        type="button"
                        className="f-tag"
                        data-type={set.type}
                        data-testid="set-type"
                        aria-label={`Set ${i + 1}: ${SET_TYPE_LABEL[set.type]}. Tap to change the set type.`}
                        title={`${SET_TYPE_LABEL[set.type]} (tap to change)`}
                        onClick={() => cycleType(ex.id, i)}
                      >
                        {set.type === 'normal' ? i + 1 : SET_TYPE_TAG[set.type]}
                      </button>
                      <span className="truncate text-center text-[11px] f-muted">{p ? `${p.weight || 0}×${p.reps}` : '–'}</span>
                      <input
                        className="f-input f-center"
                        style={{ minHeight: 36 }}
                        inputMode="decimal"
                        aria-label={`${ex.name} set ${i + 1} weight`}
                        placeholder="0"
                        value={set.weight}
                        onChange={(e) => patchSet(ex.id, i, (s) => ({ ...s, weight: e.target.value.slice(0, 8) }))}
                      />
                      <input
                        className="f-input f-center"
                        style={{ minHeight: 36 }}
                        inputMode="numeric"
                        aria-label={`${ex.name} set ${i + 1} reps`}
                        placeholder="0"
                        value={set.reps}
                        onChange={(e) => patchSet(ex.id, i, (s) => ({ ...s, reps: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                      />
                      <span className="f-e1 text-center text-[11px] f-muted" data-testid="set-e1rm">
                        {e1 ? Math.round(e1.average) : '–'}
                      </span>
                      <input
                        type="checkbox"
                        className="mx-auto h-5 w-5"
                        style={{ accentColor: 'var(--f-accent)' }}
                        aria-label={`${ex.name} set ${i + 1} done`}
                        checked={set.done}
                        onChange={(e) => toggleDone(ex.id, i, set, e.target.checked)}
                      />
                      <button type="button" aria-label={`Remove set ${i + 1}`} className="f-muted hover:text-white" onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}>
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold f-accent hover:underline"
              onClick={() =>
                patchExercise(ex.id, (x) => {
                  // A new set starts from the last working set, which is how most people train.
                  const last = [...x.sets].reverse().find((s) => s.type !== 'warmup') ?? x.sets[x.sets.length - 1];
                  return { ...x, sets: [...x.sets, last ? { weight: last.weight, reps: last.reps, done: false, type: 'normal' as const } : blankSet()] };
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add set
            </button>
          </div>
        );
      })}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          const prev = previousSets(sessions, name);
          const ex = newExercise(name);
          patch((s) => ({
            ...s,
            exercises: [...s.exercises, prev ? { ...ex, sets: prev.map((p) => ({ weight: p.weight, reps: p.reps, done: false, type: p.type })) } : ex],
          }));
          setNewName('');
        }}
      >
        <input className="f-input" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Add an exercise…" aria-label="Add an exercise" />
        <button type="submit" className="f-btn">
          Add
        </button>
      </form>
      <p className="f-small">
        Tap a set number to switch it between working, warm-up (WU), drop (D) and to-failure (F). Warm-ups are saved but never count towards volume or 1RM.
        {settings.autoRest ? ` Ticking a set starts a ${settings.restSeconds}s rest timer.` : ''}
      </p>
    </section>
  );
}
