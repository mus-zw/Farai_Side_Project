import { useState } from 'react';
import { Meal, WeightEntry, toISODate } from '../../utils/fitness';
import { mealsByDate } from '../../utils/fitnessMath';
import { db, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import NutritionPanel from '../../components/fitness/NutritionPanel';
import MealFrequencyCard from '../../components/fitness/MealFrequencyCard';
import TrendWeightCard from '../../components/fitness/TrendWeightCard';

const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

export default function NutritionPage() {
  const { settings, updateSettings } = useFitness();
  const [date, setDate] = useState(toISODate());
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);
  const byDate = mealsByDate(meals);

  return (
    <div className="space-y-4">
      <NutritionPanel date={date} onDate={setDate} meals={byDate[date] ?? NO_MEALS} targets={settings.targets} onTargets={(targets) => updateSettings({ targets })} />
      <MealFrequencyCard byDate={byDate} targets={settings.targets} />
      <TrendWeightCard weights={weights} byDate={byDate} settings={settings} onSettings={updateSettings} />
    </div>
  );
}
