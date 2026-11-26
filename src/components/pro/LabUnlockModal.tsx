import { Check, Lock, X } from 'lucide-react';
import { isLabPro, setDemoLab } from '../../utils/entitlements';
import { CV_CHECKOUT_URL, DEMO_UNLOCK_ENABLED, resolveCheckoutUrl } from '../../utils/checkout';
import { LAB_FEATURES } from '../../utils/labTier';
import { CONTACT_EMAIL } from '../../utils/site';
import { updateEntitlements, useEntitlements } from '../../utils/useEntitlements';
import LicenseKeyForm from './LicenseKeyForm';

/** Free Sandbox vs Pro / Batch Studio, with checkout, license-key entry and (in dev) a demo unlock. */
export default function LabUnlockModal({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const ent = useEntitlements();
  const pro = isLabPro(ent);
  const checkout = resolveCheckoutUrl(CV_CHECKOUT_URL, 'cv-pro');

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4" data-testid="lab-unlock-modal">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="lab-unlock-title" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-neutral-700 bg-[#0F1419] p-6 text-[#CCCCCC] shadow-2xl sm:rounded-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <h2 id="lab-unlock-title" className="text-lg font-bold text-white">
          {pro ? 'Pro / Batch Studio is unlocked' : 'Unlock Pro / Batch Studio'}
        </h2>
        {reason && !pro && <p className="mt-1 text-sm text-amber-300" data-testid="lab-unlock-reason">{reason}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="text-sm font-bold text-white">Free Sandbox</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {LAB_FEATURES.free.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" /> {f}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#32FF00]/50 bg-[#32FF00]/5 p-4">
            <div className="text-sm font-bold text-[#32FF00]">Pro / Batch Studio</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {LAB_FEATURES.pro.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#32FF00]" /> {f}</li>
              ))}
            </ul>
          </div>
        </div>

        {!pro && (
          <div className="mt-5 space-y-4">
            {checkout ? (
              <a href={checkout} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center justify-center rounded-xl bg-[#32FF00] px-5 text-sm font-bold text-[#0F1419]" data-testid="lab-checkout">
                Get Pro
              </a>
            ) : (
              <p className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-xs" data-testid="lab-checkout-missing">
                Online checkout is not set up on this build yet. To get Pro, email{' '}
                <a className="text-[#32FF00] underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}?subject=CV%20Auto-Labeler%20Pro`}>{CONTACT_EMAIL}</a>.
              </p>
            )}
            <LicenseKeyForm accept={(p) => p === 'cv-pro'} onApplied={() => undefined} />
          </div>
        )}

        {DEMO_UNLOCK_ENABLED && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-500/40 p-3 text-xs" data-testid="lab-demo-unlock">
            <span><Lock className="mr-1 inline h-3.5 w-3.5 text-amber-300" /> Demo unlock (testing only, not shown in production)</span>
            <button type="button" className="rounded-lg border border-amber-500/50 px-3 py-1.5 font-semibold text-amber-200" data-testid="lab-demo-toggle" onClick={() => updateEntitlements((e) => setDemoLab(e, !pro))}>
              {pro ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        )}
        <p className="mt-4 text-[11px] text-neutral-500">Your unlock is stored on this device and checked in your browser. Nothing is sent to a server.</p>
      </div>
    </div>
  );
}
