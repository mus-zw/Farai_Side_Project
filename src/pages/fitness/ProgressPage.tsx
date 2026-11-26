import { sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import type { Session } from '../../utils/fitness';
import { useFitness } from '../../components/fitness/FitnessProvider';
import MuscleHeatmap from '../../components/fitness/MuscleHeatmap';
import OneRepMaxCalc from '../../components/fitness/OneRepMaxCalc';
import E1rmTrend from '../../components/fitness/E1rmTrend';

const NONE: Session[] = [];

export default function ProgressPage() {
  const { settings } = useFitness();
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  return (
    <div className="space-y-4">
      <MuscleHeatmap sessions={sessions} />
      <E1rmTrend sessions={sessions} unit={settings.unit} />
      <OneRepMaxCalc sessions={sessions} unit={settings.unit} />
    </div>
  );
}
