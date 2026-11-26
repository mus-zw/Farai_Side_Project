import { useState } from 'react';
import { Session, Unit, dateLabel } from '../../utils/fitness';
import { e1rmHistory, exerciseNames, linePath } from '../../utils/fitnessMath';

const W = 320;
const H = 110;

/** Best estimated 1RM per session for one exercise: are you getting stronger? */
export default function E1rmTrend({ sessions, unit }: { sessions: Session[]; unit: Unit }) {
  const names = exerciseNames(sessions);
  const [picked, setPicked] = useState('');
  const name = names.includes(picked) ? picked : names[0] ?? '';
  const points = name ? e1rmHistory(sessions, name) : [];
  const first = points[0];
  const last = points[points.length - 1];
  const delta = first && last ? last.value - first.value : 0;

  return (
    <section className="f-card space-y-3" data-testid="e1rm-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="f-h">Strength trend</h2>
        {names.length > 0 && (
          <select className="f-select" style={{ width: 'auto', maxWidth: '60%' }} aria-label="Exercise" data-testid="e1rm-pick" value={name} onChange={(e) => setPicked(e.target.value)}>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </div>
      {points.length < 2 ? (
        <p className="f-small">{names.length === 0 ? 'Save a few sessions to see your strength trend.' : 'Two or more sessions with this lift are needed for a trend.'}</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Estimated 1RM for ${name}`} data-testid="e1rm-chart">
            <path d={linePath(points.map((p) => p.value), W, H, 6)} fill="none" stroke="var(--f-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="f-small" data-testid="e1rm-text">
            {dateLabel(first.date)}: {Math.round(first.value)} {unit} → {dateLabel(last.date)}: <strong style={{ color: 'var(--f-text)' }}>{Math.round(last.value)} {unit}</strong>{' '}
            ({delta >= 0 ? '+' : ''}
            {Math.round(delta)} {unit}) estimated 1RM
          </p>
        </>
      )}
    </section>
  );
}
