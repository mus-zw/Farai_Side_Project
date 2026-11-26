import { ArrowUpRight } from 'lucide-react';
import SiteLink from '../SiteLink';
import { linkTo } from '../../utils/site';
import LaunchBadge from '../LaunchBadge';
import { useFitnessGate } from '../../utils/fitnessGate';
import { useDemoGate } from '../../utils/demoGate';

const STUDIES = [
  { tool: 'lab' as const, label: 'Project · CV tool', title: 'CV Auto-Labeler', body: 'Browser-native YOLO11 detection with batch folders, video-frame extraction and YOLO / COCO dataset export. Zero server cost per user.', cta: 'Open the Auto-Labeler', note: '' },
  { tool: 'fitness' as const, label: 'Project · standalone product', title: 'Fitness: training, nutrition and Form Coach', body: 'A Push/Pull/Legs logger, nutrition and trend tracking, and an on-device AI Form Coach, with optional cloud sync. Local-first, and no video ever leaves the device.', cta: 'Open the Fitness app', note: 'Its own app with its own sign-in and data. Nothing is shared with this site.' },
];

/** Quiet technical links from the portfolio to the live tools. */
export default function CaseStudies() {
  const gate = useFitnessGate();
  const demoGate = useDemoGate();
  return (
    <section id="projects" className="mx-auto max-w-7xl scroll-mt-24 space-y-4 px-4 sm:px-6 lg:px-8" data-testid="case-studies">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">What I&apos;ve built</h2>
        <p className="max-w-2xl text-sm text-neutral-400">Two working products, built and tested. Both are finishing up before their public launch.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {STUDIES.map((s) => (
          <SiteLink key={s.tool} to={linkTo(s.tool)} className="group block rounded-2xl border border-[#16213E] bg-[#16213E]/30 p-5 transition-colors hover:border-neutral-600" data-testid={`case-${s.tool}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{s.label}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm font-bold text-white">
              <span className="flex flex-wrap items-center gap-2">
                {s.title}
                {s.tool === 'fitness' && <LaunchBadge />}
                {s.tool === 'lab' && <LaunchBadge product="demo" />}
              </span>
              <ArrowUpRight className="h-4 w-4 text-neutral-500 transition-colors group-hover:text-[#32FF00]" />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{s.body}</p>
            {s.note && <p className="mt-2 text-xs text-neutral-400">{s.note}</p>}
            <span className="mt-3 inline-block text-sm font-semibold text-white underline underline-offset-4">{(s.tool === 'fitness' && gate.badge) || (s.tool === 'lab' && demoGate.badge) ? "See what's coming" : s.cta} →</span>
          </SiteLink>
        ))}
      </div>
    </section>
  );
}
