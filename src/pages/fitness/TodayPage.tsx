import { useState } from 'react';
import type { DayType, ExerciseLog } from '../../utils/fitness';
import { useFitness } from '../../components/fitness/FitnessProvider';
import QuickLog from '../../components/fitness/QuickLog';
import TodayHero from '../../components/fitness/TodayHero';
import TrainPage from './TrainPage';
import NutritionPage from './NutritionPage';

/** The daily flow in one place: log anything fast, train, and track meals, without switching tabs. */
export default function TodayPage() {
  const { notify } = useFitness();
  const [append, setAppend] = useState<{ exercises: ExerciseLog[]; key: number } | null>(null);
  const [start, setStart] = useState<{ day: DayType; key: number } | null>(null);
  return (
    <div className="space-y-4">
      <TodayHero onStart={(day) => setStart({ day, key: Date.now() })} />
      <QuickLog notify={notify} onExercises={(exercises) => setAppend({ exercises, key: Date.now() })} />
      <TrainPage appendRequest={append} onAppendHandled={() => setAppend(null)} startRequest={start} />
      <NutritionPage />
    </div>
  );
}
