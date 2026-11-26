import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import PlanCard from '../components/fitness/PlanCard';
import SessionLogger from '../components/fitness/SessionLogger';
import HistoryList from '../components/fitness/HistoryList';
import NutritionCard from '../components/fitness/NutritionCard';
import { useFitnessData } from '../utils/useFitnessData';
import { useProfile } from '../components/ProfileProvider';
import { nextInRotation, plannedDayFor, toISODate } from '../utils/fitness';

interface FitnessProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

/** Push/Pull/Legs plan, lift logger and daily nutrition. All data stays in this browser. */
export default function Fitness({ onNotify }: FitnessProps) {
  const { data, update, saveFailed } = useFitnessData();
  const { profile, openProfile } = useProfile();
  const [mealDate, setMealDate] = useState(toISODate());

  const next = nextInRotation(data.sessions);
  const today = plannedDayFor(data.schedule);
  const suggested = today ?? next;
  const meals = data.meals[mealDate] ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight text-white">
            <Dumbbell className="h-7 w-7 text-[#32FF00]" /> Fitness
          </h1>
          <p className="text-sm text-neutral-400">
            {profile.signedIn ? `${profile.name}, ` : ''}plan your Push / Pull / Legs week, log every set, and keep meals on target.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-2 text-neutral-400">
            Weight unit
            <select
              aria-label="Weight unit"
              data-testid="unit-select"
              value={data.unit}
              onChange={(e) => update((d) => ({ ...d, unit: e.target.value === 'lb' ? 'lb' : 'kg' }))}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-200"
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
        </div>
      </header>

      <p className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-[11px] text-neutral-500">
        Your logs are saved in this browser only (no account, no upload), so they stay on this device.
        {!profile.signedIn && (
          <>
            {' '}
            <button type="button" onClick={openProfile} className="font-semibold text-[#32FF00] hover:underline">
              Add your name
            </button>{' '}
            to personalise the site.
          </>
        )}
      </p>
      {saveFailed && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          This browser would not save your logs (storage is full or blocked). They will be lost on reload.
        </p>
      )}

      <PlanCard schedule={data.schedule} onSchedule={(schedule) => update((d) => ({ ...d, schedule }))} today={today} next={next} />

      <SessionLogger data={data} update={update} suggested={suggested} onSaved={(m) => onNotify('success', m)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NutritionCard
          date={mealDate}
          onDate={setMealDate}
          meals={meals}
          targets={data.targets}
          onTargets={(targets) => update((d) => ({ ...d, targets }))}
          onAdd={(m) => update((d) => ({ ...d, meals: { ...d.meals, [mealDate]: [...(d.meals[mealDate] ?? []), m] } }))}
          onRemove={(id) =>
            update((d) => ({ ...d, meals: { ...d.meals, [mealDate]: (d.meals[mealDate] ?? []).filter((m) => m.id !== id) } }))
          }
        />
        <HistoryList
          sessions={data.sessions}
          unit={data.unit}
          onDelete={(id) => update((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }))}
        />
      </div>
    </div>
  );
}
