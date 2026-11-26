import { useFitnessGate } from '../utils/fitnessGate';

/** A small "Launching Soon" pill, shown next to links to the fitness app until it launches (and never to the owner previewing it). */
export default function LaunchBadge({ className = '' }: { className?: string }) {
  const { badge } = useFitnessGate();
  if (!badge) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 ${className}`}
      data-testid="launch-badge"
    >
      Launching Soon
    </span>
  );
}
