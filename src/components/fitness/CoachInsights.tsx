import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Meal, Session, WeightEntry, toISODate } from '../../utils/fitness';
import { coachInsights, InsightLevel } from '../../utils/coachInsights';
import { db, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from './FitnessProvider';

const NO_SESSIONS: Session[] = [];
const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

const ICON: Record<InsightLevel, typeof Info> = { good: CheckCircle2, attention: AlertTriangle, info: Info };
const WORD: Record<InsightLevel, string> = { good: 'On track', attention: 'Needs attention', info: 'Note' };
const COLOR: Record<InsightLevel, string> = { good: 'var(--f-good)', attention: 'var(--f-gold)', info: 'var(--f-accent)' };

/** Plain-language notes from your own Train, Nutrition and weight logs. Rules, not a model: nothing leaves this device. */
export default function CoachInsights() {
  const { settings, updateSettings, notify } = useFitness();
  const sessions = useLive(sessionsNewestFirst, [], NO_SESSIONS);
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);
  const insights = coachInsights({ sessions, meals, weights, settings, today: toISODate() });

  return (
    <section className="f-card space-y-3" data-testid="coach-insights">
      <div>
        <h2 className="f-h">Coaching insights</h2>
        <p className="f-small">Worked out from what you have logged, on this device. General guidance, not medical advice.</p>
      </div>
      {insights.length === 0 ? (
        <p className="f-small" data-testid="insights-empty">
          Nothing to say yet. Log a session and meals on <Link to="/fitness" className="f-accent underline">Today</Link> and a weigh-in below, and notes appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {insights.map((i) => {
            const Icon = ICON[i.level];
            return (
              <li key={i.id} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="insight" data-level={i.level}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COLOR[i.level] }} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    <span className="sr-only">{WORD[i.level]}: </span>
                    {i.title}
                  </div>
                  <p className="f-small">{i.detail}</p>
                  {i.action && (
                    <button
                      type="button"
                      className="f-btn mt-2"
                      style={{ minHeight: 40 }}
                      data-testid="insight-action"
                      onClick={() => {
                        updateSettings({ targets: { kcal: i.action!.kcal } });
                        notify('success', `Calorie target set to ${i.action!.kcal} kcal.`);
                      }}
                    >
                      {i.action.label}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
