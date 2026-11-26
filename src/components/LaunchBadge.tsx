import { useDemoGate } from '../utils/demoGate';
import { useFitnessGate } from '../utils/fitnessGate';

/**
 * A small "Launching soon" pill for links to a product that has not launched yet ("fitness" or
 * "demo"). Never shown to the owner who has unlocked a preview of it.
 *
 * It carries its OWN background (white on slate-800, 14.6:1) so it stays readable on any surface it
 * lands on: the old amber-on-translucent version measured 1.02:1 inside a lime button. 11px bold, not
 * shouty capitals; the amber dot is decoration only (the text carries the meaning).
 */
export default function LaunchBadge({ product = 'fitness', className = '' }: { product?: 'fitness' | 'demo'; className?: string }) {
  const fitness = useFitnessGate();
  const demo = useDemoGate();
  if (!(product === 'demo' ? demo.badge : fitness.badge)) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-500 bg-slate-800 px-2.5 py-1 text-[11px] font-bold leading-none text-white ${className}`}
      data-testid="launch-badge"
      data-product={product}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      Launching soon
    </span>
  );
}
