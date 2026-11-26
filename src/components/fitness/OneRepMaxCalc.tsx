import { useState } from 'react';
import { Session, Unit, num, workingSets } from '../../utils/fitness';
import { estimate1RM, exerciseNames, MAX_RELIABLE_REPS, workingWeightTable } from '../../utils/fitnessMath';

/** The heaviest-estimated working set of an exercise across saved sessions. */
function bestSetFor(sessions: Session[], name: string): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number; e: number } | null = null;
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (ex.name.trim().toLowerCase() !== name.trim().toLowerCase()) continue;
      for (const set of workingSets(ex)) {
        const e = estimate1RM(num(set.weight), num(set.reps));
        if (e && (!best || e.average > best.e)) best = { weight: num(set.weight), reps: num(set.reps), e: e.average };
      }
    }
  }
  return best && { weight: best.weight, reps: best.reps };
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Epley and Brzycki one-rep-max estimates, and the working weights that follow from them. */
export default function OneRepMaxCalc({ sessions, unit }: { sessions: Session[]; unit: Unit }) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const names = exerciseNames(sessions);
  const est = estimate1RM(num(weight), num(reps));
  const entered = num(weight) > 0 && num(reps) > 0;

  return (
    <section className="f-card space-y-3" data-testid="orm-card">
      <h2 className="f-h">1RM &amp; working weights</h2>
      {names.length > 0 && (
        <select
          className="f-select"
          aria-label="Fill from one of my lifts"
          data-testid="orm-pick"
          value=""
          onChange={(e) => {
            const best = e.target.value ? bestSetFor(sessions, e.target.value) : null;
            if (best) {
              setWeight(String(best.weight));
              setReps(String(best.reps));
            }
          }}
        >
          <option value="">Fill from my best set…</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 f-small">
          Weight ({unit})
          <input className="f-input f-center" inputMode="decimal" data-testid="orm-weight" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))} placeholder="100" />
        </label>
        <label className="space-y-1 f-small">
          Reps
          <input className="f-input f-center" inputMode="numeric" data-testid="orm-reps" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="5" />
        </label>
      </div>

      {est ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center" data-testid="orm-result">
            {(
              [
                ['Epley', est.epley],
                ['Brzycki', est.brzycki],
                ['Average', est.average],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-xl border p-2" style={{ borderColor: label === 'Average' ? 'var(--f-accent)' : 'var(--f-border)', background: 'var(--f-surface-2)' }}>
                <div className="f-small">{label}</div>
                <div className="text-lg font-bold" data-testid={`orm-${label.toLowerCase()}`}>
                  {r1(v)}
                </div>
                <div className="f-small">{unit}</div>
              </div>
            ))}
          </div>
          <table className="f-table" data-testid="orm-table">
            <thead>
              <tr>
                <th>% of 1RM</th>
                <th>Weight ({unit})</th>
                <th>≈ Reps</th>
              </tr>
            </thead>
            <tbody>
              {workingWeightTable(est.average, unit).map((row) => (
                <tr key={row.percent}>
                  <td>{row.percent}%</td>
                  <td>{r1(row.weight)}</td>
                  <td>{row.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="f-small">Weights are rounded to {unit === 'kg' ? '2.5 kg' : '5 lb'} plates. Estimates are best from sets of 1 to {MAX_RELIABLE_REPS} reps.</p>
        </>
      ) : (
        <p className="f-small" data-testid="orm-hint">
          {entered ? `Estimates are only shown for 1 to ${MAX_RELIABLE_REPS} reps: higher-rep sets say more about endurance than max strength.` : 'Enter a recent hard set to estimate your one-rep max.'}
        </p>
      )}
    </section>
  );
}
