import { ArrowUpRight } from 'lucide-react';
import SiteLink from '../SiteLink';
import { linkTo } from '../../utils/site';

const STUDIES = [
  { tool: 'lab' as const, label: 'Case study', title: 'CV Auto-Labeler', body: 'Browser-native YOLO11 detection with batch folders, video-frame extraction and YOLO / COCO dataset export. Zero server cost per user.', cta: 'Open the live tool' },
  { tool: 'fitness' as const, label: 'Case study', title: 'On-device Form Coach', body: 'Pose Landmarker with One-Euro smoothing, rep counting and bar-path feedback. Local-first storage and no video leaving the device.', cta: 'Open the live tool' },
];

/** Quiet technical links from the portfolio to the live tools. */
export default function CaseStudies() {
  return (
    <section id="case-studies" className="mx-auto max-w-7xl scroll-mt-24 space-y-4 px-4 sm:px-6 lg:px-8" data-testid="case-studies">
      <h2 className="font-display text-xl font-bold text-white">Live case studies</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {STUDIES.map((s) => (
          <SiteLink key={s.tool} to={linkTo(s.tool)} className="group block rounded-2xl border border-[#16213E] bg-[#16213E]/30 p-5 transition-colors hover:border-neutral-600" data-testid={`case-${s.tool}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{s.label}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm font-bold text-white">
              {s.title}
              <ArrowUpRight className="h-4 w-4 text-neutral-500 transition-colors group-hover:text-[#32FF00]" />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{s.body}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-[#32FF00]">{s.cta}</span>
          </SiteLink>
        ))}
      </div>
    </section>
  );
}
