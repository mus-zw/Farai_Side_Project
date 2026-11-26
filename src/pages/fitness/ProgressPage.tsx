import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Meal, Session, WeightEntry, toISODate } from '../../utils/fitness';
import { mealsByDate } from '../../utils/fitnessMath';
import { db, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from '../../components/fitness/FitnessProvider';
import CoachInsights from '../../components/fitness/CoachInsights';
import MuscleHeatmap from '../../components/fitness/MuscleHeatmap';
import OneRepMaxCalc from '../../components/fitness/OneRepMaxCalc';
import E1rmTrend from '../../components/fitness/E1rmTrend';
import VolumeTrend from '../../components/fitness/VolumeTrend';
import TrendWeightCard from '../../components/fitness/TrendWeightCard';

// The camera coach is loaded only when it is opened.
const FormCoach = lazy(() => import('../../components/fitness/FormCoach'));

const NONE: Session[] = [];
const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

/** Insights, training progress and body weight from your own logs, with the Form Coach tucked in below. */
export default function ProgressPage() {
  const { settings, updateSettings } = useFitness();
  const { hash } = useLocation();
  const [coachOpen, setCoachOpen] = useState(hash === '#coach');
  const sessions = useLive(sessionsNewestFirst, [], NONE);
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);

  // The old /fitness/coach link lands here and opens the coach.
  useEffect(() => {
    if (hash !== '#coach') return;
    setCoachOpen(true);
    requestAnimationFrame(() => document.getElementById('coach')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [hash]);

  return (
    <div className="space-y-4">
      <CoachInsights />
      <VolumeTrend sessions={sessions} unit={settings.unit} today={toISODate()} />
      <E1rmTrend sessions={sessions} unit={settings.unit} />
      <TrendWeightCard weights={weights} byDate={mealsByDate(meals)} settings={settings} onSettings={updateSettings} />
      <MuscleHeatmap sessions={sessions} />
      <OneRepMaxCalc sessions={sessions} unit={settings.unit} />

      <div id="coach" className="scroll-mt-20 space-y-4" data-testid="coach-section">
        <section className="f-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="f-h">Form Coach (camera)</h2>
            <p className="f-small">Checks your rep form live. Runs on this device; no video is stored or uploaded.</p>
          </div>
          <button type="button" className="f-btn shrink-0" aria-expanded={coachOpen} data-testid="coach-toggle" style={{ minHeight: 44 }} onClick={() => setCoachOpen((v) => !v)}>
            {coachOpen ? 'Close' : 'Open'}
          </button>
        </section>
        {coachOpen && (
          <Suspense fallback={<p className="f-small">Loading the coach…</p>}>
            <FormCoach />
          </Suspense>
        )}
      </div>
    </div>
  );
}
