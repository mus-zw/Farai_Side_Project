import { useState } from 'react';
import { Session, toISODate } from '../../utils/fitness';
import { MUSCLES, Muscle, heat, muscleSets } from '../../utils/fitnessMath';

const COLD: [number, number, number] = [31, 38, 46];
const HOT: [number, number, number] = [255, 90, 31];

/** Blend from "untrained" grey to the accent as the muscle approaches a full week's volume. */
function heatColor(h: number): string {
  const c = COLD.map((v, i) => Math.round(v + (HOT[i] - v) * h));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

type Shape = { m: Muscle; el: 'ellipse' | 'rect' | 'path'; a: Record<string, number | string> };

const FRONT: Shape[] = [
  { m: 'shoulders', el: 'ellipse', a: { cx: 26, cy: 43, rx: 9, ry: 8 } },
  { m: 'shoulders', el: 'ellipse', a: { cx: 74, cy: 43, rx: 9, ry: 8 } },
  { m: 'chest', el: 'rect', a: { x: 32, y: 38, width: 17, height: 20, rx: 7 } },
  { m: 'chest', el: 'rect', a: { x: 51, y: 38, width: 17, height: 20, rx: 7 } },
  { m: 'core', el: 'rect', a: { x: 38, y: 61, width: 24, height: 36, rx: 6 } },
  { m: 'biceps', el: 'rect', a: { x: 14, y: 52, width: 10, height: 26, rx: 5 } },
  { m: 'biceps', el: 'rect', a: { x: 76, y: 52, width: 10, height: 26, rx: 5 } },
  { m: 'quads', el: 'rect', a: { x: 31, y: 104, width: 17, height: 54, rx: 8 } },
  { m: 'quads', el: 'rect', a: { x: 52, y: 104, width: 17, height: 54, rx: 8 } },
  { m: 'calves', el: 'rect', a: { x: 33, y: 164, width: 13, height: 44, rx: 6 } },
  { m: 'calves', el: 'rect', a: { x: 54, y: 164, width: 13, height: 44, rx: 6 } },
];
const BACK: Shape[] = [
  { m: 'shoulders', el: 'ellipse', a: { cx: 26, cy: 43, rx: 9, ry: 8 } },
  { m: 'shoulders', el: 'ellipse', a: { cx: 74, cy: 43, rx: 9, ry: 8 } },
  { m: 'back', el: 'path', a: { d: 'M36 36 L64 36 L72 52 L66 94 L34 94 L28 52 Z' } },
  { m: 'triceps', el: 'rect', a: { x: 14, y: 52, width: 10, height: 26, rx: 5 } },
  { m: 'triceps', el: 'rect', a: { x: 76, y: 52, width: 10, height: 26, rx: 5 } },
  { m: 'glutes', el: 'ellipse', a: { cx: 41, cy: 106, rx: 11, ry: 9 } },
  { m: 'glutes', el: 'ellipse', a: { cx: 59, cy: 106, rx: 11, ry: 9 } },
  { m: 'hamstrings', el: 'rect', a: { x: 31, y: 119, width: 17, height: 42, rx: 8 } },
  { m: 'hamstrings', el: 'rect', a: { x: 52, y: 119, width: 17, height: 42, rx: 8 } },
  { m: 'calves', el: 'rect', a: { x: 33, y: 166, width: 13, height: 42, rx: 6 } },
  { m: 'calves', el: 'rect', a: { x: 54, y: 166, width: 13, height: 42, rx: 6 } },
];

/** A neutral silhouette to hang the muscles on. */
function Silhouette() {
  const f = 'var(--f-surface-2)';
  return (
    <g fill={f} stroke="var(--f-border)" strokeWidth="1">
      <circle cx="50" cy="16" r="11" />
      <rect x="45" y="26" width="10" height="9" rx="3" />
      <rect x="27" y="34" width="46" height="66" rx="14" />
      <rect x="11" y="44" width="14" height="66" rx="7" />
      <rect x="75" y="44" width="14" height="66" rx="7" />
      <rect x="29" y="98" width="42" height="18" rx="9" />
      <rect x="29" y="102" width="20" height="108" rx="9" />
      <rect x="51" y="102" width="20" height="108" rx="9" />
    </g>
  );
}

function Figure({ shapes, sets, days, offset, label }: { shapes: Shape[]; sets: Record<Muscle, number>; days: number; offset: number; label: string }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      <Silhouette />
      {shapes.map((s, i) => {
        const h = heat(sets[s.m], days);
        const props = { ...s.a, fill: heatColor(h), stroke: 'rgba(0,0,0,0.35)', strokeWidth: 0.8, 'data-muscle': s.m } as any;
        const title = <title>{`${MUSCLES.find((m) => m.id === s.m)?.label}: ${sets[s.m].toFixed(1)} sets`}</title>;
        // key is passed directly, not through the props spread (React warns otherwise).
        return s.el === 'ellipse' ? (
          <ellipse key={i} {...props}>{title}</ellipse>
        ) : s.el === 'rect' ? (
          <rect key={i} {...props}>{title}</rect>
        ) : (
          <path key={i} {...props} strokeLinejoin="round">{title}</path>
        );
      })}
      <text x="50" y="224" textAnchor="middle" fontSize="9" fill="var(--f-muted)">
        {label}
      </text>
    </g>
  );
}

/** Weekly working sets per muscle group, drawn on a front and back body. */
export default function MuscleHeatmap({ sessions }: { sessions: Session[] }) {
  const [days, setDays] = useState(7);
  const sets = muscleSets(sessions, days, toISODate());
  const ranked = [...MUSCLES].sort((a, b) => sets[b.id] - sets[a.id]);
  const untrained = MUSCLES.filter((m) => sets[m.id] === 0).map((m) => m.label);

  return (
    <section className="f-card space-y-3" data-testid="heatmap-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="f-h">Muscle volume</h2>
        <div className="flex gap-1.5" role="group" aria-label="Time window">
          {[7, 14, 28].map((d) => (
            <button key={d} type="button" className="f-chip" aria-pressed={days === d} data-testid={`window-${d}`} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 220 232" className="mx-auto w-full max-w-[340px]" role="img" aria-label="Muscle groups coloured by how much you have trained them" data-testid="heatmap-svg">
        <Figure shapes={FRONT} sets={sets} days={days} offset={0} label="Front" />
        <Figure shapes={BACK} sets={sets} days={days} offset={120} label="Back" />
      </svg>

      <div className="flex items-center justify-center gap-2 f-small" aria-hidden="true">
        None
        <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(1)})` }} />
        {`${12}+ sets/week`}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" data-testid="heatmap-list">
        {ranked.map((m) => (
          <li key={m.id} className="flex justify-between">
            <span>{m.label}</span>
            <span className="f-muted tabular-nums">{Number.isInteger(sets[m.id]) ? sets[m.id] : sets[m.id].toFixed(1)} sets</span>
          </li>
        ))}
      </ul>
      <p className="f-small">
        Working sets only (warm-ups excluded). A set counts fully for the main muscles and half for helpers, and about 10 to 20 sets a week per muscle is a common target.
        {untrained.length > 0 && untrained.length < MUSCLES.length ? ` Not trained in this window: ${untrained.join(', ')}.` : ''}
      </p>
    </section>
  );
}
