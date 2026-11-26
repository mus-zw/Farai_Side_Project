import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Check, Pin, Repeat } from 'lucide-react';
import { DAY_LABEL, DAY_TYPES, DayType, ExerciseLog, Session, SetEntry, SET_TYPES, SET_TYPE_LABEL, SET_TYPE_TAG, Settings, blankSet, cleanWeightInput, cueKey, isPristineDraft, dateLabel, newExercise, newSession, num, previousSets, sessionSetCount, sessionVolume } from '../../utils/fitness';
import { estimate1RM } from '../../utils/fitnessMath';
import { db, getDraft, saveDraft, setCue } from '../../utils/fitnessDb';
import { mergeExercises } from '../../utils/quickLog';
import { alternativesFor } from '../../utils/swaps';

interface Props {
  /** Saved sessions, newest first. */
  sessions: Session[];
  /** Pinned cues, keyed by lower-case exercise name. */
  cues: Record<string, string>;
  settings: Settings;
  /** The day in use: the one picked in the plan, else today's, else the next in rotation. */
  activeDay: DayType;
  /** What made it the active day, for the label: "selected", "today" or "next up". */
  activeLabel: string;
  /** Bumps when a day is tapped in the week plan, which opens that day's session. */
  openCount: number;
  /** The person chose a day on purpose (starting one, or switching): keep it. */
  onDayChosen: (day: DayType) => void;
  onSaved: (message: string) => void;
  startRest: (seconds: number) => void;
  /** A saved session the user asked to edit (from History). Handled once, then cleared. */
  editRequest?: { session: Session; key: number } | null;
  onEditHandled?: () => void;
  /** Exercises from the quick log to add to the session (it starts one for the active day if none is open). */
  appendRequest?: { exercises: ExerciseLog[]; key: number } | null;
  onAppendHandled?: () => void;
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
export default function SessionLogger({ sessions, cues, settings, activeDay, activeLabel, openCount, onDayChosen, onSaved, startRest, editRequest, onEditHandled, appendRequest, onAppendHandled }: Props) {
  const { draft, setDraft, loaded } = useDraft();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [swapText, setSwapText] = useState('');
  const [cueEditing, setCueEditing] = useState<string | null>(null);
  const [cueText, setCueText] = useState('');
  const unit = settings.unit;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sectionRef = useRef<HTMLElement | null>(null);

  // "Edit" in History loads that saved session as the draft. Saving puts it back under the same id,
  // so it replaces the old copy; discarding leaves the saved one untouched.
  useEffect(() => {
    if (!editRequest || !loaded) return;
    const replace = !draft || window.confirm('Replace the session in progress with the one you are editing? The one in progress will be discarded.');
    if (replace) {
      setError('');
      setDraft({ ...editRequest.session, exercises: editRequest.session.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })) });
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    onEditHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest, loaded]);
  const editing = !!draft && sessions.some((s) => s.id === draft.id);

  // Keep the session on the day in use. A plan tap opens that day's session; an untouched session for a
  // different day is swapped; one with entries in it is never replaced behind the person's back.
  const lastOpen = useRef(openCount);
  useEffect(() => {
    if (!loaded) return;
    const explicitOpen = openCount !== lastOpen.current;
    lastOpen.current = openCount;
    if (editing) return;
    if (!draft) {
      if (explicitOpen) setDraft(newSession(activeDay, undefined, sessions));
      return;
    }
    if (draft.day !== activeDay && isPristineDraft(draft, sessions)) setDraft(newSession(activeDay, undefined, sessions));
  }, [loaded, openCount, activeDay, draft, editing, sessions, setDraft]);

  // Quick-log exercises go into the open session, or start one for the day in use.
  const lastAppend = useRef<number | null>(null);
  useEffect(() => {
    if (!appendRequest || !loaded || lastAppend.current === appendRequest.key) return;
    lastAppend.current = appendRequest.key;
    setError('');
    setDraft(mergeExercises(draft ?? newSession(activeDay, undefined, sessions), appendRequest.exercises));
    onAppendHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendRequest, loaded]);

  /** Swap an exercise for another: its sets start from what you last did on the new lift. */
  const swapTo = (id: string, name: string) => {
    const prev = previousSets(sessions, name);
    patchExercise(id, (x) => ({
      ...x,
      name: name.slice(0, 80),
      sets: prev ? prev.map((p) => ({ weight: p.weight, reps: p.reps, done: false, type: p.type })) : x.sets.map((s) => ({ ...s, weight: '', done: false })),
    }));
    setSwapping(null);
    setSwapText('');
  };

  /** Switch the session in progress to another day, asking first when that would throw away entries. */
  const switchDay = (day: DayType) => {
    if (!draft || draft.day === day) return;
    const pristine = isPristineDraft(draft, sessions);
    if (!pristine && !window.confirm(`Switch to ${DAY_LABEL[day]}? The sets you entered for ${DAY_LABEL[draft.day]} will be discarded.`)) return;
    setError('');
    onDayChosen(day);
    setDraft(newSession(day, undefined, sessions));
  };

  const patch = (fn: (s: Session) => Session) => setDraft((d) => (d ? fn(d) : d));
  const patchExercise = (id: string, fn: (e: ExerciseLog) => ExerciseLog) =>
    patch((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? fn(e) : e)) }));
  const patchSet = (exId: string, i: number, fn: (s: SetEntry) => SetEntry) =>
    patchExercise(exId, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === i ? fn(s) : s)) }));

  const start = (day: DayType) => {
    setError('');
    onDayChosen(day);
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
    if (!draft || saving) return;
    if (sessionSetCount(draft) === 0) {
      setError('Tick at least one working set as done (with reps) before saving. Warm-ups do not count.');
      return;
    }
    setError('');
    const exercises = draft.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done && num(s.reps) > 0) }))
      .filter((e) => e.sets.length > 0);
    const saved: Session = { ...draft, exercises, savedAt: Date.now() };
    setSaving(true);
    try {
      await db.sessions.put(saved);
    } catch {
      // The draft is kept, so nothing is lost and the user can try again.
      setError('Could not save to this browser (storage may be full or blocked). Your session is still here; try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setDraft(null);
    onSaved(`${DAY_LABEL[saved.day]} session ${editing ? 'updated' : 'saved'}: ${sessionSetCount(saved)} working sets, ${fmt(sessionVolume(saved))} ${unit} volume.`);
  };

  if (!loaded) return <section className="f-card f-small">Loading…</section>;

  if (!draft) {
    return (
      <section className="f-card space-y-3" data-testid="session-start">
        <h2 className="f-h">Log a session</h2>
        <p className="f-small">Pick a day. Your sets start prefilled with what you lifted last time, and are saved as you type.</p>
        <div className="flex flex-wrap gap-2">
          {DAY_TYPES.map((d) => (
            <button key={d} type="button" data-testid={`start-${d}`} onClick={() => start(d)} className={d === activeDay ? 'f-btn-primary' : 'f-btn'} style={{ minHeight: 44, padding: '0 20px' }}>
              Start {DAY_LABEL[d]}
              {d === activeDay ? ` (${activeLabel})` : ''}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="f-card f-card-accent scroll-mt-20 space-y-4" data-testid="session-draft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="f-h">
            {editing ? 'Editing ' : ''}{DAY_LABEL[draft.day]} session <span className="f-small">· {dateLabel(draft.date)}</span>
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
              if (window.confirm(editing ? 'Discard your changes? The saved session stays as it was.' : 'Discard this session without saving?')) setDraft(null);
            }}
          >
            {editing ? 'Discard changes' : 'Discard'}
          </button>
          <button type="button" data-testid="save-session" className="f-btn-primary" disabled={saving} onClick={() => void save()}>
            <Check className="h-4 w-4" /> {editing ? 'Save changes' : 'Finish & save'}
          </button>
        </div>
      </div>
      {!editing && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Session day">
          <span className="f-small mr-1">Day</span>
          {DAY_TYPES.map((d) => (
            <button key={d} type="button" className="f-chip" aria-pressed={draft.day === d} data-testid={`switch-${d}`} onClick={() => switchDay(d)}>
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>
      )}
      {!editing && draft.day !== activeDay && (
        <p className="text-xs" role="status" style={{ color: 'var(--f-gold)' }} data-testid="day-mismatch">
          This is a {DAY_LABEL[draft.day]} session, but your plan says {DAY_LABEL[activeDay]}.{' '}
          <button type="button" className="underline" style={{ minHeight: 32 }} onClick={() => switchDay(activeDay)}>
            Switch to {DAY_LABEL[activeDay]}
          </button>
        </p>
      )}
      {draft.exercises.some((e) => cues[cueKey(e.name)]) && (
        <div className="f-cuebar" data-testid="cue-bar" aria-label="Pinned cues">
          <Pin className="h-3.5 w-3.5 shrink-0 f-accent" />
          {draft.exercises
            .filter((e) => cues[cueKey(e.name)])
            .map((e) => (
              <span key={e.id}>
                <strong>{e.name}:</strong> <span className="f-muted">{cues[cueKey(e.name)]}</span>
              </span>
            ))}
        </div>
      )}
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
                {cues[cueKey(ex.name)] && cueEditing !== ex.id && (
                  <div className="mt-0.5 flex items-start gap-1 text-[11px] f-accent" data-testid="exercise-cue">
                    <Pin className="mt-0.5 h-3 w-3 shrink-0" /> {cues[cueKey(ex.name)]}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`flex h-10 w-10 shrink-0 items-center justify-center ${cues[cueKey(ex.name)] ? 'f-accent' : 'f-muted hover:text-white'}`}
                aria-label={cues[cueKey(ex.name)] ? `Edit pinned cue for ${ex.name}` : `Pin a cue to ${ex.name}`}
                data-testid="pin-cue"
                onClick={() => {
                  setCueEditing(cueEditing === ex.id ? null : ex.id);
                  setCueText(cues[cueKey(ex.name)] ?? '');
                }}
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Swap ${ex.name} for another exercise`}
                aria-expanded={swapping === ex.id}
                data-testid="swap-exercise"
                className="flex h-10 w-10 shrink-0 items-center justify-center f-muted hover:text-white"
                onClick={() => {
                  setSwapping(swapping === ex.id ? null : ex.id);
                  setSwapText('');
                }}
              >
                <Repeat className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${ex.name}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center f-muted hover:text-white"
                onClick={() => {
                  // Removing an exercise throws away its ticked sets, so ask first when there are any.
                  if (ex.sets.some((x) => x.done) && !window.confirm(`Remove ${ex.name} and its ticked sets?`)) return;
                  patch((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {swapping === ex.id && (
              <div className="mb-2 space-y-2" data-testid="swap-panel">
                {alternativesFor(ex.name).length > 0 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested swaps">
                    {alternativesFor(ex.name).map((a) => (
                      <button key={a} type="button" className="f-chip" data-testid="swap-option" onClick={() => swapTo(ex.id, a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (swapText.trim()) swapTo(ex.id, swapText.trim());
                  }}
                >
                  <input className="f-input" value={swapText} maxLength={80} onChange={(e) => setSwapText(e.target.value)} placeholder="Or type another exercise" aria-label={`Replace ${ex.name} with`} data-testid="swap-input" />
                  <button type="submit" className="f-btn" style={{ minHeight: 40 }} data-testid="swap-apply">
                    Swap
                  </button>
                </form>
              </div>
            )}

            {cueEditing === ex.id && (
              <form
                className="mb-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void setCue(ex.name, cueText);
                  setCueEditing(null);
                }}
              >
                <input
                  className="f-input"
                  autoFocus
                  maxLength={140}
                  value={cueText}
                  onChange={(e) => setCueText(e.target.value)}
                  placeholder="A cue to keep in view, e.g. chest up, brace first"
                  aria-label={`Pinned cue for ${ex.name}`}
                  data-testid="cue-input"
                />
                <button type="submit" className="f-btn-primary" data-testid="cue-save" style={{ minHeight: 40 }}>
                  {cueText.trim() ? 'Pin' : 'Unpin'}
                </button>
              </form>
            )}

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
                        style={{ minHeight: 36 }}
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
                        onChange={(e) => patchSet(ex.id, i, (s) => ({ ...s, weight: cleanWeightInput(e.target.value) }))}
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
                      <button type="button" aria-label={`Remove set ${i + 1}`} className="flex h-8 w-7 items-center justify-center text-base f-muted hover:text-white" onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}>
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="mt-1 inline-flex min-h-[40px] items-center gap-1 px-1 text-xs font-semibold f-accent hover:underline"
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
