import { Undo2, X } from 'lucide-react';
import { useFitness } from './FitnessProvider';

/** "Meal removed · Undo", above the bottom nav for a few seconds after a delete or a one-tap add. */
export default function UndoBar() {
  const { undo, runUndo, dismissUndo, rest } = useFitness();
  if (!undo) return null;
  return (
    <div
      role="status"
      data-testid="undo-bar"
      className="fixed left-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm shadow-2xl"
      style={{ bottom: `calc(var(--f-nav-h) + env(safe-area-inset-bottom) + ${rest.endsAt !== null ? 84 : 12}px)`, background: 'var(--f-surface)', borderColor: 'var(--f-border)', color: 'var(--f-text)' }}
    >
      <span className="min-w-0 truncate">{undo.label}</span>
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" className="f-btn-primary" data-testid="undo-action" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => void runUndo()}>
          <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
        </button>
        <button type="button" aria-label="Dismiss" className="flex h-10 w-10 items-center justify-center f-muted hover:text-white" onClick={dismissUndo}>
          <X className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}
