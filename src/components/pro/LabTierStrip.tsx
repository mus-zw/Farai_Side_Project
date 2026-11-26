import { Sparkles } from 'lucide-react';
import { isLabPro } from '../../utils/entitlements';
import { FREE_BATCH_LIMIT } from '../../utils/labTier';
import { useEntitlements } from '../../utils/useEntitlements';
import { useUnlockUi } from './EntitlementProvider';

/** A slim, always-visible line saying which tier you are on, with the way to change it. */
export default function LabTierStrip() {
  const pro = isLabPro(useEntitlements());
  const { openLabUnlock } = useUnlockUi();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2.5 text-xs" data-testid="lab-tier-strip">
      <span className="flex items-center gap-2 text-neutral-300">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pro ? 'bg-[#32FF00]/15 text-[#32FF00]' : 'bg-neutral-800 text-neutral-300'}`} data-testid="lab-tier-badge">
          {pro ? 'Pro' : 'Free'}
        </span>
        {pro ? 'Pro / Batch Studio: unlimited batches, video-frame extraction, YOLO + COCO export.' : `Free Sandbox: single images, batches up to ${FREE_BATCH_LIMIT}, YOLO .txt export.`}
      </span>
      <button type="button" onClick={() => openLabUnlock()} className="inline-flex items-center gap-1.5 font-semibold text-[#32FF00] hover:underline" data-testid="lab-tier-button">
        <Sparkles className="h-3.5 w-3.5" /> {pro ? 'Manage' : 'Unlock Pro'}
      </button>
    </div>
  );
}
