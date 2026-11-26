import { StageTimings } from '../types';

interface StageTimingBarProps {
  timings?: StageTimings;
  accent: string;
}

const STAGES: { key: keyof StageTimings; label: string; opacity: number }[] = [
  { key: 'preprocess_ms', label: 'Preprocess', opacity: 0.35 },
  { key: 'inference_ms', label: 'Inference', opacity: 1 },
  { key: 'postprocess_ms', label: 'Postprocess', opacity: 0.65 },
];

/**
 * Per-stage timings for one model: a proportional bar plus the three numbers.
 * Postprocess is where NMS runs for NMS models, so it is the segment that
 * shrinks for NMS-free models. For segmentation models it also includes mask
 * decoding, so it is not NMS alone.
 */
export default function StageTimingBar({ timings, accent }: StageTimingBarProps) {
  if (!timings) return null;
  const total = STAGES.reduce((sum, s) => sum + timings[s.key], 0);

  return (
    <div className="space-y-1.5" aria-label="Per-stage timings">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        {STAGES.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${timings[s.key].toFixed(2)} ms`}
            style={{
              width: total > 0 ? `${(timings[s.key] / total) * 100}%` : '0%',
              backgroundColor: accent,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-neutral-400">
        {STAGES.map((s) => (
          <span key={s.key}>
            {s.label} {timings[s.key].toFixed(2)} ms
          </span>
        ))}
      </div>
    </div>
  );
}
