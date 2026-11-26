import { Session, Unit, dateLabel } from '../../utils/fitness';
import { weeklyVolume } from '../../utils/fitnessMath';

const WEEKS = 8;
const fmt = (n: number) => Math.round(n).toLocaleString();

/** Total working-set volume per week for the last eight weeks, so overload shows as bars getting taller. */
export default function VolumeTrend({ sessions, unit, today }: { sessions: Session[]; unit: Unit; today: string }) {
  const weeks = weeklyVolume(sessions, WEEKS, today);
  const max = Math.max(...weeks.map((w) => w.volume), 1);
  const hasData = weeks.some((w) => w.volume > 0);
  const current = weeks[weeks.length - 1];
  // This week is still in progress, so the headline compares the last full week with the four before it.
  const lastFull = weeks[weeks.length - 2];
  const prior = weeks.slice(-6, -2);
  const priorAvg = prior.reduce((t, w) => t + w.volume, 0) / (prior.filter((w) => w.volume > 0).length || 1);
  const change = priorAvg > 0 ? ((lastFull.volume - priorAvg) / priorAvg) * 100 : null;

  return (
    <section className="f-card space-y-3" data-testid="volume-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="f-h">Weekly volume</h2>
        {hasData && change !== null && (
          <span className="f-small" data-testid="volume-change">
            Last week <strong style={{ color: 'var(--f-text)' }}>{change >= 0 ? '+' : ''}{Math.round(change)}%</strong> vs the 4 weeks before
          </span>
        )}
      </div>
      {!hasData ? (
        <p className="f-small">Save a session and your weekly volume (weight × reps, working sets) shows here.</p>
      ) : (
        <>
          <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Working volume per week in ${unit} for the last ${WEEKS} weeks`} data-testid="volume-chart">
            {weeks.map((w, i) => (
              <div key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Week of ${dateLabel(w.weekStart)}: ${fmt(w.volume)} ${unit}, ${w.sessions} sessions`}>
                <div
                  data-testid="volume-bar"
                  style={{ height: `${Math.max((w.volume / max) * 100, w.volume > 0 ? 4 : 0)}%`, background: i === WEEKS - 1 ? 'var(--f-accent)' : 'var(--f-muted)', borderRadius: 4, opacity: w.volume > 0 ? 1 : 0.25 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between f-small">
            <span>{dateLabel(weeks[0].weekStart)}</span>
            <span>This week so far: {fmt(current.volume)} {unit} · {current.sessions} {current.sessions === 1 ? 'session' : 'sessions'}</span>
          </div>
        </>
      )}
    </section>
  );
}
