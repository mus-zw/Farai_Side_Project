import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { latencyStats, type LatencyStats } from '../../utils/benchmark';
import { DEFAULT_MODEL_CONFIG, modelFileName } from '../../utils/browserModels';

const WARMUP = 3;
const RUNS = 20;

interface Result {
  stats: LatencyStats;
  backend: 'webgpu' | 'wasm';
  model: string;
  size: number;
  image: string;
}

/**
 * Runs the real in-browser detector on a sample photo and reports the latency
 * measured on THIS device. Nothing here is a canned number, and nothing is uploaded.
 */
export default function LatencyBenchmark() {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setState('working');
    setError('');
    try {
      const { detectFrameInBrowser, loadBrowserModel } = await import('../../services/browserInference');
      const model = await loadBrowserModel(setPhase, DEFAULT_MODEL_CONFIG);
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}samples/bus.jpg`;
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      for (let i = 0; i < WARMUP; i++) {
        setPhase(`Warming up ${i + 1}/${WARMUP}…`);
        await detectFrameInBrowser(img, w, h, 0.25);
      }
      const samples: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        setPhase(`Measuring ${i + 1}/${RUNS}…`);
        const t0 = performance.now();
        await detectFrameInBrowser(img, w, h, 0.25);
        samples.push(performance.now() - t0);
      }
      const stats = latencyStats(samples);
      if (!stats) throw new Error('No timings were recorded.');
      setResult({ stats, backend: model.backend, model: modelFileName(model.config), size: model.config.size, image: `${w}×${h} photo` });
      setState('done');
    } catch (e: any) {
      setError(e?.message || 'The benchmark could not run in this browser.');
      setState('error');
    } finally {
      setPhase('');
    }
  };

  return (
    <div className="rounded-2xl border border-[#16213E] bg-[#16213E]/40 p-5" data-testid="latency-benchmark">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Gauge className="h-4 w-4 text-[#32FF00]" /> Measure it on your device
        </div>
        <button type="button" onClick={() => void run()} disabled={state === 'working'} className="min-h-[40px] rounded-xl bg-[#32FF00] px-4 text-xs font-bold text-[#0F1419] disabled:opacity-60" data-testid="run-benchmark">
          {state === 'working' ? 'Running…' : state === 'done' ? 'Run again' : 'Run benchmark'}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Runs the same YOLO11n pipeline the demo uses ({WARMUP} warm-up passes, then {RUNS} timed). Real timings from your hardware; nothing is uploaded. The first run downloads the model and runtime (about 40 MB).
      </p>
      {state === 'working' && <p className="mt-3 text-xs text-amber-300" data-testid="benchmark-phase">{phase || 'Starting…'}</p>}
      {state === 'error' && <p className="mt-3 text-xs text-rose-300" role="alert" data-testid="benchmark-error">{error}</p>}
      {state === 'done' && result && (
        <div className="mt-4" data-testid="benchmark-result">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Median', `${result.stats.median} ms`],
                ['p95', `${result.stats.p95} ms`],
                ['Best', `${result.stats.min} ms`],
                ['≈ FPS', `${result.stats.fps}`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
                <div className="mt-0.5 text-lg font-bold text-white" data-testid={`bench-${label === '≈ FPS' ? 'fps' : label.toLowerCase()}`}>{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-400" data-testid="benchmark-meta">
            {result.model} at {result.size}×{result.size} on {result.backend === 'webgpu' ? 'WebGPU' : 'WASM (CPU)'} · {result.stats.runs} runs · {result.image} · each run includes preprocessing, inference and decode.
          </p>
        </div>
      )}
    </div>
  );
}
