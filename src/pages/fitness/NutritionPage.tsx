import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Meal, toISODate } from '../../utils/fitness';
import { mealsByDate } from '../../utils/fitnessMath';
import { db, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import NutritionPanel from '../../components/fitness/NutritionPanel';
import MealFrequencyCard from '../../components/fitness/MealFrequencyCard';

const NO_MEALS: Meal[] = [];

export default function NutritionPage() {
  const { settings, updateSettings } = useFitness();
  const [date, setDate] = useState(toISODate());
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const byDate = mealsByDate(meals);

  return (
    <div className="space-y-4">
      <NutritionPanel date={date} onDate={setDate} meals={byDate[date] ?? NO_MEALS} targets={settings.targets} onTargets={(targets) => updateSettings({ targets })} />
      <MealFrequencyCard byDate={byDate} targets={settings.targets} />
      <p className="f-small" data-testid="weight-moved">
        Weigh-ins, your weight trend and the adaptive calorie estimate are on the{' '}
        <Link to="/fitness/progress" className="f-accent underline">
          Progress
        </Link>{' '}
        tab.
      </p>
    </div>
  );
}
