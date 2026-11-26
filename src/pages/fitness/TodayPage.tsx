import { useState } from 'react';
import type { ExerciseLog } from '../../utils/fitness';
import { useFitness } from '../../components/fitness/FitnessProvider';
import QuickLog from '../../components/fitness/QuickLog';
import TrainPage from './TrainPage';
import NutritionPage from './NutritionPage';

/** The daily flow in one place: log anything fast, train, and track meals, without switching tabs. */
export default function TodayPage() {
  const { notify } = useFitness();
  const [append, setAppend] = useState<{ exercises: ExerciseLog[]; key: number } | null>(null);
  return (
    <div className="space-y-4">
      <QuickLog notify={notify} onExercises={(exercises) => setAppend({ exercises, key: Date.now() })} />
      <TrainPage appendRequest={append} onAppendHandled={() => setAppend(null)} />
      <NutritionPage />
    </div>
  );
}
