import { Cpu, ShieldCheck, Zap } from 'lucide-react';
import LatencyBenchmark from './LatencyBenchmark';
import { useDemoGate } from '../../utils/demoGate';

const POINTS = [
  { Icon: Cpu, title: 'Inference at the edge', body: 'YOLO11 runs in the browser on ONNX Runtime Web, WebGPU first with a WASM fallback, and pose estimation runs on MediaPipe. No GPU servers to rent, scale or secure.' },
  { Icon: Zap, title: 'Latency by design', body: 'One reused session, letterbox preprocessing and decode/NMS written as tested pure functions, and a drop-frame guard on video so latency stays bounded instead of queueing.' },
  { Icon: ShieldCheck, title: 'Privacy by architecture', body: 'Because the model goes to the data, camera frames, tensors and keypoints stay in the visitor’s memory. Nothing to breach, store or retain.' },
] as const;

/** The hub's engineering-authority section: how it is built, and proof you can run yourself. */
export default function EngineeringSection() {
  // The benchmark runs the real detector, which is part of the demo: it is offered only to visitors who can open the demo.
  const demoOpen = useDemoGate().status === 'unlocked';
  return (
    <section id="engineering" className="mx-auto max-w-7xl scroll-mt-24 space-y-6 px-4 sm:px-6 lg:px-8" data-testid="engineering-section">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-white">Engineering notes</h2>
        <p className="max-w-2xl text-sm text-neutral-400">Computer vision that ships as a static site, and how it is built.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {POINTS.map(({ Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-[#16213E] bg-[#16213E]/30 p-5">
            <Icon className="h-5 w-5 text-[#32FF00]" />
            <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{body}</p>
          </div>
        ))}
      </div>
      {demoOpen && <LatencyBenchmark />}
    </section>
  );
}
