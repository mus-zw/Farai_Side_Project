import { Meal, Session, WeightEntry, toISODate } from '../../utils/fitness';
import { mealsByDate } from '../../utils/fitnessMath';
import { db, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import MuscleHeatmap from '../../components/fitness/MuscleHeatmap';
import OneRepMaxCalc from '../../components/fitness/OneRepMaxCalc';
import E1rmTrend from '../../components/fitness/E1rmTrend';
import VolumeTrend from '../../components/fitness/VolumeTrend';
import TrendWeightCard from '../../components/fitness/TrendWeightCard';

const NONE: Session[] = [];
const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

/** Training progress (volume, strength, muscle balance) next to body-weight tracking, all from your own logs. */
export default function ProgressPage() {
  const { settings, updateSettings } = useFitness();
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);
  return (
    <div className="space-y-4">
      <VolumeTrend sessions={sessions} unit={settings.unit} today={toISODate()} />
      <E1rmTrend sessions={sessions} unit={settings.unit} />
      <TrendWeightCard weights={weights} byDate={mealsByDate(meals)} settings={settings} onSettings={updateSettings} />
      <MuscleHeatmap sessions={sessions} />
      <OneRepMaxCalc sessions={sessions} unit={settings.unit} />
    </div>
  );
}
