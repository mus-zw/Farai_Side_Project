import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GOAL_LABEL, Goal, Meal, Settings, WeightEntry, dateLabel, num, toISODate } from '../../utils/fitness';
import { adaptiveTarget, linePath, trendSeries, weeklyRate } from '../../utils/fitnessMath';
import { db, type SettingsPatch } from '../../utils/fitnessDb';

interface Props {
  weights: WeightEntry[];
  byDate: Record<string, Meal[]>;
  settings: Settings;
  onSettings: (patch: SettingsPatch) => void;
}

const W = 320;
const H = 120;

/** Weigh-ins, the smoothed trend, and a calorie target adjusted to what your weight is actually doing. */
export default function TrendWeightCard({ weights, byDate, settings, onSettings }: Props) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(toISODate());
  const [error, setError] = useState('');
  const unit = settings.unit;
  const today = toISODate();

  const series = trendSeries(weights).slice(-42);
  const rate = weeklyRate(trendSeries(weights), 14);
  const adaptive = adaptiveTarget(weights, byDate, settings.goal, unit, today);
  const latest = series[series.length - 1];

  const all = series.flatMap((p) => [p.value, p.trend]);
  const lo = all.length ? Math.min(...all) - 0.3 : 0;
  const hi = all.length ? Math.max(...all) + 0.3 : 1;
  const n = series.length;
  const px = (i: number) => 4 + (n === 1 ? (W - 8) / 2 : (i * (W - 8)) / (n - 1));
  const py = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = num(value);
    if (!v || v > 700) {
      setError(`Enter a weight between 1 and 700 ${unit}.`);
      return;
    }
    setError('');
    try {
      await db.weights.put({ date, value: Math.round(v * 10) / 10 }); // one weigh-in per day: the same date replaces it
    } catch {
      setError('Could not save to this browser (storage may be full or blocked). Try again.');
      return;
    }
    setValue('');
  };

  const sign = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(2)}`;

  return (
    <section className="f-card space-y-4" data-testid="trend-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="f-h">Trend weight</h2>
        {latest && (
          <span className="f-small" data-testid="trend-now">
            Trend <strong style={{ color: 'var(--f-text)' }}>{latest.trend.toFixed(1)} {unit}</strong>
            {rate !== null && <> · {sign(rate)} {unit}/wk</>}
          </span>
        )}
      </div>

      {settings.goalWeight > 0 && latest && (
        <p className="f-small" data-testid="goal-weight-line">
          Goal {settings.goalWeight} {unit} ·{' '}
          {Math.abs(latest.trend - settings.goalWeight) < 0.3 ? 'you are there' : `${Math.abs(latest.trend - settings.goalWeight).toFixed(1)} ${unit} ${latest.trend > settings.goalWeight ? 'to lose' : 'to gain'}`}
        </p>
      )}

      {n === 0 ? (
        <p className="f-small">Log your weight a few times a week. The trend line filters out water and food noise so you can see the real direction.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weight and trend over the last weeks" data-testid="trend-chart">
          <path d={linePath(series.map((p) => p.trend), W, H, 4, lo, hi)} fill="none" stroke="var(--f-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((p, i) => (
            <circle key={p.date} cx={px(i)} cy={py(p.value)} r="2.5" fill="var(--f-muted)" opacity="0.8" />
          ))}
        </svg>
      )}

      <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
        <input type="date" className="f-input" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Weigh-in date" />
        <input className="f-input f-center" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} placeholder={unit} aria-label={`Weight in ${unit}`} data-testid="weight-input" />
        <button type="submit" className="f-btn-primary" data-testid="add-weight">
          Log
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--f-bad)' }} data-testid="weight-error">
          {error}
        </p>
      )}

      {weights.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {[...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((w) => (
            <li key={w.date} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--f-border)' }}>
              {dateLabel(w.date)} · {w.value} {unit}
              <button type="button" aria-label={`Delete weigh-in ${w.date}`} className="flex h-8 w-8 items-center justify-center f-muted hover:text-white" onClick={() => void db.weights.delete(w.date)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--f-border)', background: 'var(--f-surface-2)' }} data-testid="adaptive-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Adaptive calories</h3>
          <div className="flex gap-1.5" role="group" aria-label="Goal">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
              <button key={g} type="button" className="f-chip" aria-pressed={settings.goal === g} data-testid={`goal-${g}`} onClick={() => onSettings({ goal: g })}>
                {GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
        {adaptive.ok ? (
          <div className="space-y-2 text-xs">
            <p className="f-muted">
              You averaged <strong style={{ color: 'var(--f-text)' }}>{Math.round(adaptive.avgIntake)} kcal</strong> while your trend moved {sign(adaptive.rate)} {unit}/wk, so your maintenance is about{' '}
              <strong style={{ color: 'var(--f-text)' }}>{adaptive.tdee} kcal</strong>.
            </p>
            <p>
              Suggested target for “{GOAL_LABEL[settings.goal].toLowerCase()}”: <strong className="f-accent" data-testid="adaptive-target">{adaptive.target} kcal</strong>
              {adaptive.target !== settings.targets.kcal && (
                <button type="button" className="f-btn ml-2" style={{ minHeight: 30, padding: '0 10px', fontSize: 11 }} data-testid="apply-target" onClick={() => onSettings({ targets: { kcal: adaptive.target } })}>
                  Use it
                </button>
              )}
            </p>
            <p className="f-small">An estimate from {adaptive.loggedDays} logged days: it improves with more data. Not medical advice.</p>
          </div>
        ) : (
          <p className="f-small" data-testid="adaptive-reason">{adaptive.reason}</p>
        )}
      </div>
    </section>
  );
}
