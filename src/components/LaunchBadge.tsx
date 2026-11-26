import { useDemoGate } from '../utils/demoGate';
import { useFitnessGate } from '../utils/fitnessGate';

/**
 * A small "Launching Soon" pill, shown next to links to a product that has not launched yet
 * ("fitness" or "demo"), and never to the owner who has unlocked a preview of it.
 */
export default function LaunchBadge({ product = 'fitness', className = '' }: { product?: 'fitness' | 'demo'; className?: string }) {
  const fitness = useFitnessGate();
  const demo = useDemoGate();
  if (!(product === 'demo' ? demo.badge : fitness.badge)) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 ${className}`}
      data-testid="launch-badge"
      data-product={product}
    >
      Launching Soon
    </span>
  );
}
