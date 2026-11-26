import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Play, Utensils } from 'lucide-react';
import { DAY_LABEL, DayType, Meal, Session, Targets, WeightEntry, mealTotals, nextInRotation, plannedDayFor, plannedDaysPerWeek, progress, sessionSetCount, sessionVolume, shiftDate, toISODate, weekPlan } from '../../utils/fitness';
import { coachInsights } from '../../utils/coachInsights';
import { weekStartOf } from '../../utils/fitnessMath';
import { db, getDraft, sessionsNewestFirst, useLive } from '../../utils/fitnessDb';
import { useFitness } from './FitnessProvider';
import SyncChip from './SyncChip';

const NO_SESSIONS: Session[] = [];
const NO_MEALS: Meal[] = [];
const NO_WEIGHTS: WeightEntry[] = [];

const greetingFor = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

function Ring({ value, target }: { value: number; target: number }) {
  const p = progress(value, target);
  const over = target > 0 && value > target;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative h-[96px] w-[96px] shrink-0" role="img" aria-label={`Calories: ${Math.round(value)} of ${target} kcal${over ? ', over target' : ''}`} data-testid="ring-kcal">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="44" cy="44" r={R} fill="none" stroke="var(--f-surface-2)" strokeWidth="9" />
        <circle cx="44" cy="44" r={R} fill="none" stroke={over ? 'var(--f-gold)' : 'var(--f-accent)'} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ transition: 'stroke-dashoffset 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-xl font-bold leading-none">{Math.round(value)}</span>
        <span className="text-[10px] f-muted">/ {target} kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, testId }: { label: string; value: number; target: number; testId: string }) {
  const over = target > 0 && value > target;
  return (
    <div data-testid={testId}>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="f-muted">{label}</span>
        <span>
          {Math.round(value)} / {target} g
        </span>
      </div>
      <div className="f-track" role="progressbar" aria-label={label} aria-valuenow={Math.round(progress(value, target) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`f-fill ${over ? 'over' : ''}`} style={{ width: `${progress(value, target) * 100}%` }} />
      </div>
    </div>
  );
}

/** Share of today's four targets (calories, protein, carbs, fat) reached so far, capped at 100% each. */
function completion(totals: { kcal: number; protein: number; carbs: number; fat: number }, t: Targets): number {
  const parts = [progress(totals.kcal, t.kcal), progress(totals.protein, t.protein), progress(totals.carbs, t.carbs), progress(totals.fat, t.fat)];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

/**
 * The Today dashboard: a greeting, today's planned workout and one tap to start it, nutrition against
 * your targets, how consistent the week has been, and the single most useful nudge from your own logs.
 * Every number comes from your log on this device; with nothing logged it says so.
 */
export default function TodayHero() {
  const { settings, athlete } = useFitness();
  const navigate = useNavigate();
  const today = toISODate();
  const sessions = useLive(sessionsNewestFirst, [], NO_SESSIONS);
  const meals = useLive(() => db.meals.toArray(), [], NO_MEALS);
  const weights = useLive(() => db.weights.orderBy('date').toArray(), [], NO_WEIGHTS);
  const draft = useLive(getDraft, [], null as Session | null);

  const todaysMeals = meals.filter((m) => m.date === today);
  const totals = mealTotals(todaysMeals);
  const planned = plannedDayFor(settings.schedule);
  const day: DayType = planned ?? nextInRotation(sessions);
  const doneToday = sessions.find((s) => s.date === today);
  const inProgress = draft && !sessions.some((s) => s.id === draft.id) ? draft : null;
  const nudge = coachInsights({ sessions, meals, weights, settings, today }).find((i) => i.level === 'attention');

  let status: string;
  let cta: string;
  if (inProgress) {
    status = `${DAY_LABEL[inProgress.day]} session in progress · ${sessionSetCount(inProgress)} sets done`;
    cta = `Continue ${DAY_LABEL[inProgress.day]}`;
  } else if (doneToday) {
    status = `${DAY_LABEL[doneToday.day]} done · ${sessionSetCount(doneToday)} sets · ${Math.round(sessionVolume(doneToday)).toLocaleString()} ${settings.unit}`;
    cta = `Log another ${DAY_LABEL[day]}`;
  } else {
    status = planned ? `Planned: ${DAY_LABEL[day]}` : `Rest day · next up ${DAY_LABEL[day]}`;
    cta = `Start ${DAY_LABEL[day]}`;
  }

  // The week, Monday first: what the plan has, and what has been done.
  const monday = weekStartOf(today);
  const plan = weekPlan(settings.schedule);
  const week = plan.map((p, i) => {
    const iso = shiftDate(monday, i);
    return { ...p, iso, done: sessions.some((s) => s.date === iso), isToday: iso === today, future: iso > today };
  });
  const doneThisWeek = week.filter((d) => d.done).length;
  const plannedThisWeek = plannedDaysPerWeek(settings.schedule);

  const name = athlete && athlete.mode !== 'guest' ? athlete.name : '';
  const nothingToday = todaysMeals.length === 0 && !doneToday && !inProgress;

  return (
    <div className="space-y-4" data-testid="today-hero">
      <section className="f-card space-y-4" aria-label="Today">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="f-h" data-testid="greeting">
              {greetingFor(new Date().getHours())}
              {name ? `, ${name}` : ''}
            </h2>
            <p className="f-small">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <SyncChip />
        </div>

        <div className="space-y-1">
          <div className="f-small">Workout</div>
          <div className="text-sm font-semibold" data-testid="hero-status">
            {status}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="f-btn-primary" style={{ minHeight: 48, fontSize: 15 }} data-testid="hero-cta" onClick={() => navigate('/fitness/train', { state: { start: inProgress?.day ?? day } })}>
            <Play className="h-4 w-4" aria-hidden="true" /> {cta}
          </button>
          <button type="button" className="f-btn" style={{ minHeight: 48, fontSize: 15 }} data-testid="hero-log-meal" onClick={() => navigate('/fitness/nutrition', { state: { focus: 'meal' } })}>
            <Utensils className="h-4 w-4" aria-hidden="true" /> Log a meal
          </button>
        </div>

        {nudge && (
          <p className="flex items-start justify-between gap-2 text-xs" data-testid="hero-nudge" style={{ color: 'var(--f-gold)' }}>
            <span>{nudge.title}</span>
            <Link to="/fitness/progress" className="inline-flex shrink-0 items-center gap-1 font-semibold underline" style={{ minHeight: 24 }}>
              See why <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </p>
        )}
      </section>

      <section className="f-card space-y-3" aria-label="Nutrition today" data-testid="today-nutrition">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="f-h">Nutrition</h2>
          <span className="f-small" data-testid="completion">
            {completion(totals, settings.targets)}% of today&apos;s targets
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Ring value={totals.kcal} target={settings.targets.kcal} />
          <div className="min-w-0 flex-1 space-y-2">
            <MacroBar label="Protein" value={totals.protein} target={settings.targets.protein} testId="bar-protein" />
            <MacroBar label="Carbs" value={totals.carbs} target={settings.targets.carbs} testId="bar-carbs" />
            <MacroBar label="Fat" value={totals.fat} target={settings.targets.fat} testId="bar-fat" />
          </div>
        </div>
        {nothingToday && <p className="f-small" data-testid="empty-today">Nothing logged yet today. Start a workout or log a meal above.</p>}
      </section>

      <section className="f-card space-y-3" aria-label="This week" data-testid="week-card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="f-h">This week</h2>
          <span className="f-small" data-testid="week-count">
            {doneThisWeek} of {plannedThisWeek} planned sessions
          </span>
        </div>
        <ol className="grid grid-cols-7 gap-1.5 text-center" data-testid="week-strip">
          {week.map((d) => (
            <li key={d.iso} className="flex flex-col items-center gap-1" aria-label={`${d.weekday}: ${d.day ? DAY_LABEL[d.day] : 'rest'}${d.done ? ', done' : ''}${d.isToday ? ' (today)' : ''}`} data-done={d.done ? 'true' : undefined}>
              <span className="text-[11px]" style={{ color: d.isToday ? 'var(--f-text)' : 'var(--f-muted)', fontWeight: d.isToday ? 700 : 500 }}>
                {d.weekday}
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold"
                style={
                  d.done
                    ? { background: 'var(--f-accent)', borderColor: 'var(--f-accent)', color: 'var(--f-accent-ink)' }
                    : d.day
                      ? { borderColor: d.isToday ? 'var(--f-accent)' : 'var(--f-border-strong)', borderStyle: d.future || d.isToday ? 'dashed' : 'solid', color: 'var(--f-muted)' }
                      : { borderColor: 'transparent', color: 'var(--f-muted)' }
                }
              >
                {d.done ? <Check className="h-4 w-4" aria-hidden="true" /> : ''}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--f-muted)' }} aria-hidden="true">
                {d.day ? DAY_LABEL[d.day] : 'Rest'}
              </span>
            </li>
          ))}
        </ol>
        {sessions.length === 0 && <p className="f-small">No sessions logged yet. Your week fills in as you train.</p>}
      </section>
    </div>
  );
}
