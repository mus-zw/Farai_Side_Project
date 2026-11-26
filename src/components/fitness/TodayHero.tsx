import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { DAY_LABEL, DayType, Meal, Session, WeightEntry, mealTotals, nextInRotation, plannedDayFor, progress, sessionSetCount, sessionVolume, toISODate } from '../../utils/fitness';
import { coachInsights } from '../../utils/coachInsights';
import { db, getDraft, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from './FitnessProvider';
import SyncChip from './SyncChip';

const NO_SESSIONS: Session[] = [];
const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

function Ring({ label, value, target, unit, testId }: { label: string; value: number; target: number; unit: string; testId: string }) {
  const p = progress(value, target);
  const over = target > 0 && value > target;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-1" data-testid={testId}>
      <div className="relative h-[88px] w-[88px]" role="img" aria-label={`${label}: ${Math.round(value)} of ${target} ${unit}${over ? ', over target' : ''}`}>
        <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="44" cy="44" r={R} fill="none" stroke="var(--f-surface-2)" strokeWidth="9" />
          <circle cx="44" cy="44" r={R} fill="none" stroke={over ? 'var(--f-gold)' : 'var(--f-accent)'} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ transition: 'stroke-dashoffset 0.3s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="text-lg font-bold leading-none">{Math.round(value)}</span>
          <span className="text-[10px] f-muted">/ {target}</span>
        </div>
      </div>
      <span className="text-[11px] f-muted">{label}</span>
    </div>
  );
}

/**
 * The top of Today: how the day is going against your targets, what to do next in one tap, and the
 * single most useful nudge from your own logs. Everything here is computed on this device.
 */
export default function TodayHero({ onStart }: { onStart: (day: DayType) => void }) {
  const { settings } = useFitness();
  const today = toISODate();
  const sessions = useLive(sessionsNewestFirst, [], NO_SESSIONS);
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);
  const draft = useLive(getDraft, [], null as Session | null);

  const totals = mealTotals(meals.filter((m) => m.date === today));
  const day: DayType = plannedDayFor(settings.schedule) ?? nextInRotation(sessions);
  const doneToday = sessions.find((s) => s.date === today);
  const inProgress = draft && !sessions.some((s) => s.id === draft.id) ? draft : null;
  const nudge = coachInsights({ sessions, meals, weights, settings, today }).find((i) => i.level === 'attention');

  let status: string;
  let cta: string;
  if (inProgress) {
    status = `${DAY_LABEL[inProgress.day]} session in progress · ${sessionSetCount(inProgress)} sets done`;
    cta = `Continue ${DAY_LABEL[inProgress.day]}`;
  } else if (doneToday) {
    status = `${DAY_LABEL[doneToday.day]} done today · ${sessionSetCount(doneToday)} sets · ${Math.round(sessionVolume(doneToday)).toLocaleString()} ${settings.unit}`;
    cta = `Log another ${DAY_LABEL[day]}`;
  } else {
    status = plannedDayFor(settings.schedule) ? `Today's plan: ${DAY_LABEL[day]}` : `Rest day · next up ${DAY_LABEL[day]}`;
    cta = `Start ${DAY_LABEL[day]}`;
  }

  const go = () => {
    if (inProgress) {
      document.querySelector('[data-testid=session-draft]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onStart(day);
    // The session opens on the next render; bring it into view.
    window.setTimeout(() => document.querySelector('[data-testid=session-draft]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  };

  return (
    <section className="f-card space-y-4" data-testid="today-hero" aria-label="Today at a glance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="f-h">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
        <SyncChip />
      </div>

      <div className="flex items-center justify-around gap-2">
        <Ring label="Calories" value={totals.kcal} target={settings.targets.kcal} unit="kcal" testId="ring-kcal" />
        <Ring label="Protein g" value={totals.protein} target={settings.targets.protein} unit="g" testId="ring-protein" />
        <div className="min-w-0 flex-1 space-y-1 pl-2">
          <div className="f-small">Training</div>
          <div className="text-sm font-semibold" data-testid="hero-status">
            {status}
          </div>
        </div>
      </div>

      <button type="button" className="f-btn-primary w-full" style={{ minHeight: 48, fontSize: 15 }} data-testid="hero-cta" onClick={go}>
        <Play className="h-4 w-4" aria-hidden="true" /> {cta}
      </button>

      {nudge && (
        <p className="flex items-start justify-between gap-2 text-xs" data-testid="hero-nudge" style={{ color: 'var(--f-gold)' }}>
          <span>{nudge.title}</span>
          <Link to="/fitness/progress" className="inline-flex shrink-0 items-center gap-1 font-semibold underline" style={{ minHeight: 24 }}>
            See why <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </p>
      )}
    </section>
  );
}
