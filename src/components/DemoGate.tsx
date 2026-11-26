import type { ReactNode } from 'react';
import DemoLaunchingSoon from '../pages/DemoLaunchingSoon';
import { useDemoGate } from '../utils/demoGate';

/**
 * Shows the "Launching Soon" page instead of /demo until it has launched (or the owner has unlocked a
 * preview in this tab). While the unlock is being checked it renders nothing, so the demo never
 * flashes up for a moment.
 */
export default function DemoGate({ children }: { children: ReactNode }) {
  const { status } = useDemoGate();
  if (status === 'checking') return <div className="min-h-[60vh]" aria-busy="true" />;
  if (status === 'locked') return <DemoLaunchingSoon />;
  return <>{children}</>;
}
