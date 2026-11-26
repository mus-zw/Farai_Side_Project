import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { DAY_LABEL, SET_TYPE_TAG, Session, Unit, dateLabel, sessionSetCount, sessionVolume } from '../../utils/fitness';
import { db } from '../../utils/fitnessDb';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Saved sessions, newest first. Tap one to see its sets; deleting asks for a second tap. */
export default function HistoryList({ sessions, unit }: { sessions: Session[]; unit: Unit }) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const shown = sessions.slice(0, 20);

  return (
    <section className="f-card space-y-3" data-testid="history">
      <h2 className="f-h">History</h2>
      {shown.length === 0 ? (
        <p className="f-small">No sessions yet. Finish one and it shows up here.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id} className="rounded-xl border" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="history-item">
              <div className="flex items-center gap-2 p-3">
                <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {DAY_LABEL[s.day]} <span className="f-small">· {dateLabel(s.date)}</span>
                    </span>
                    <span className="block f-small">
                      {sessionSetCount(s)} sets · {fmt(sessionVolume(s))} {unit}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 f-muted transition-transform ${open === s.id ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  aria-label={confirm === s.id ? 'Confirm delete session' : 'Delete session'}
                  onClick={() => {
                    if (confirm === s.id) {
                      void db.sessions.delete(s.id);
                      setConfirm(null);
                    } else setConfirm(s.id);
                  }}
                  onBlur={() => setConfirm((c) => (c === s.id ? null : c))}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px]"
                  style={confirm === s.id ? { background: 'var(--f-bad)', color: '#fff', fontWeight: 700 } : { color: 'var(--f-muted)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirm === s.id && 'Sure?'}
                </button>
              </div>
              {open === s.id && (
                <div className="space-y-1 border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--f-border)' }}>
                  {s.exercises.map((e) => (
                    <div key={e.id}>
                      <span style={{ color: 'var(--f-text)' }}>{e.name}</span>:{' '}
                      <span className="f-muted">
                        {e.sets.map((x) => `${x.type === 'normal' ? '' : SET_TYPE_TAG[x.type] + ' '}${x.weight || 0}${unit} × ${x.reps}`).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions.length > shown.length && <p className="f-small">Showing the latest {shown.length} of {sessions.length}.</p>}
    </section>
  );
}
