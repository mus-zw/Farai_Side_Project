/** Latency statistics for the on-device benchmark. Pure. */

export interface LatencyStats {
  runs: number;
  min: number;
  median: number;
  mean: number;
  p95: number;
  /** Frames per second implied by the median. */
  fps: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nearest-rank percentile of a list (0-100). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export function latencyStats(samplesMs: readonly number[]): LatencyStats | null {
  const v = samplesMs.filter((n) => Number.isFinite(n) && n >= 0);
  if (v.length === 0) return null;
  const median = percentile(v, 50);
  return {
    runs: v.length,
    min: round1(Math.min(...v)),
    median: round1(median),
    mean: round1(v.reduce((a, b) => a + b, 0) / v.length),
    p95: round1(percentile(v, 95)),
    fps: median > 0 ? round1(1000 / median) : 0,
  };
}
