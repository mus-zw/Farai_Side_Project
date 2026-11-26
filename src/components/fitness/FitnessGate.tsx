import type { ReactNode } from 'react';
import FitnessLaunchingSoon from '../../pages/FitnessLaunchingSoon';
import { useFitnessGate } from '../../utils/fitnessGate';

/**
 * Shows the "Launching Soon" page instead of the fitness app until it has launched (or the owner has
 * unlocked a preview in this tab). While the unlock is being checked it renders nothing, so the app
 * never flashes up for a moment.
 */
export default function FitnessGate({ children }: { children: ReactNode }) {
  const { status } = useFitnessGate();
  if (status === 'checking') return <div className="min-h-screen" style={{ background: '#0a0c0f' }} aria-busy="true" />;
  if (status === 'locked') return <FitnessLaunchingSoon />;
  return <>{children}</>;
}
