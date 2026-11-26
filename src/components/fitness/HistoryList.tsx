import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { DAY_LABEL, Session, Unit, dateLabel, sessionSetCount, sessionVolume } from '../../utils/fitness';

interface Props {
  sessions: Session[];
  unit: Unit;
  onDelete: (id: string) => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Saved sessions, newest first. Tap one to see its sets; deleting asks for a second tap. */
export default function HistoryList({ sessions, unit, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const shown = sessions.slice(0, 20);

  return (
    <section className="min-w-0 rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5 space-y-3" data-testid="history">
      <h2 className="text-base font-bold text-white">History</h2>
      {shown.length === 0 ? (
        <p className="text-xs text-neutral-500">No sessions yet. Finish one above and it shows up here.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50" data-testid="history-item">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  aria-expanded={open === s.id}
                  onClick={() => setOpen(open === s.id ? null : s.id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      {DAY_LABEL[s.day]} <span className="font-normal text-neutral-500">· {dateLabel(s.date)}</span>
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {sessionSetCount(s)} sets · {fmt(sessionVolume(s))} {unit}
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open === s.id ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  aria-label={confirm === s.id ? 'Confirm delete session' : 'Delete session'}
                  onClick={() => {
                    if (confirm === s.id) {
                      onDelete(s.id);
                      setConfirm(null);
                    } else {
                      setConfirm(s.id);
                    }
                  }}
                  onBlur={() => setConfirm((c) => (c === s.id ? null : c))}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] ${
                    confirm === s.id ? 'bg-rose-500 font-semibold text-white' : 'text-neutral-500 hover:text-rose-300'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirm === s.id && 'Sure?'}
                </button>
              </div>
              {open === s.id && (
                <div className="space-y-1 border-t border-neutral-800 px-3 py-2 text-xs text-neutral-300">
                  {s.exercises.map((e) => (
                    <div key={e.id}>
                      <span className="text-neutral-200">{e.name}</span>:{' '}
                      {e.sets.map((x) => `${x.weight || 0}${unit} × ${x.reps}`).join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions.length > shown.length && <p className="text-[11px] text-neutral-600">Showing the latest {shown.length} of {sessions.length}.</p>}
    </section>
  );
}
