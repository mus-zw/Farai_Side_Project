import { useState } from 'react';
import { X } from 'lucide-react';
import { FITNESS_PLAN_LABEL, TRIAL_DAYS, fitnessStatus, setDemoFitness, startTrial } from '../../utils/entitlements';
import { DEMO_UNLOCK_ENABLED, FITNESS_CHECKOUT_USD_URL, FITNESS_CHECKOUT_ZAR_URL, resolveCheckoutUrl } from '../../utils/checkout';
import { CONTACT_EMAIL } from '../../utils/site';
import { updateEntitlements, useEntitlements } from '../../utils/useEntitlements';
import LicenseKeyForm from './LicenseKeyForm';

type Currency = 'ZAR' | 'USD';
type Tab = 'solo' | 'pilot';

interface PlanOption {
  id: 'solo_12week' | 'solo_year' | 'pilot';
  title: string;
  blurb: string;
  /** Price in each currency, where one exists. */
  price: Partial<Record<Currency, string>>;
  per?: string;
}

const SOLO: PlanOption[] = [
  { id: 'solo_12week', title: '12-Week PPL + Form Coach Pass', blurb: 'A full 12-week Push/Pull/Legs block with the AI Form Coach. One payment, no subscription.', price: { USD: '$39', ZAR: 'R599' } },
  { id: 'solo_year', title: 'Annual', blurb: 'Everything for a year, including new features.', price: { USD: '$59' }, per: '/yr' },
];
const PILOT: PlanOption = { id: 'pilot', title: 'Trainer / Biokineticist Pilot', blurb: 'For professionals coaching clients. Up to 25 clients.', price: { ZAR: 'R499', USD: '$29' }, per: '/mo' };

const defaultCurrency = (): Currency => (typeof navigator !== 'undefined' && /-ZA\b/i.test(navigator.language) ? 'ZAR' : 'USD');

/** Pro / Coach Portal: solo unlocks, trainer pilot onboarding, license keys, and (in dev) a demo toggle. */
export default function FitnessProModal({ onClose, initialTab = 'solo' }: { onClose: () => void; initialTab?: Tab }) {
  const ent = useEntitlements();
  const status = fitnessStatus(ent);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [trialMsg, setTrialMsg] = useState('');
  const [pilot, setPilot] = useState({ name: '', practice: '', email: '', clients: '10' });

  // The link for a plan: the ZAR link only for ZAR prices that exist, otherwise USD.
  const linkFor = (plan: PlanOption): { url: string | null; cur: Currency } => {
    const cur: Currency = plan.price[currency] ? currency : 'USD';
    return { url: resolveCheckoutUrl(cur === 'ZAR' ? FITNESS_CHECKOUT_ZAR_URL : FITNESS_CHECKOUT_USD_URL, plan.id), cur };
  };

  const card = (plan: PlanOption) => {
    const { url, cur } = linkFor(plan);
    return (
      <div key={plan.id} className="f-card space-y-2" data-testid={`plan-${plan.id}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="f-h">{plan.title}</h3>
          <span className="text-lg font-extrabold">
            {plan.price[cur]}
            <span className="f-small">{plan.per}</span>
          </span>
        </div>
        <p className="f-small">{plan.blurb}</p>
        {cur !== currency && <p className="f-small">Billed in {cur} (no {currency} price for this plan).</p>}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="f-btn-primary w-full" data-testid={`checkout-${plan.id}`}>
            Continue to checkout
          </a>
        ) : (
          <button type="button" className="f-btn w-full" disabled data-testid={`checkout-${plan.id}`}>
            Checkout not set up yet
          </button>
        )}
      </div>
    );
  };

  const clients = Math.min(25, Math.max(1, Number(pilot.clients) || 1));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pilot.email.trim());
  const pilotMail = () => {
    const body = `Trainer / Biokineticist pilot request\n\nName: ${pilot.name}\nPractice: ${pilot.practice}\nEmail: ${pilot.email}\nExpected clients (max 25): ${clients}\nCurrency: ${currency}\n`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Fitness trainer pilot')}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div data-theme="fitness" className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4" data-testid="fitness-pro-modal">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="fpro-title" className="relative max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl" style={{ background: 'var(--f-bg)', borderColor: 'var(--f-border)', color: 'var(--f-text)' }}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg f-muted hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div>
          <h2 id="fpro-title" className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>Pro &amp; Coach Portal</h2>
          <p className="f-small" data-testid="fpro-status">
            {status.active ? `Active: ${FITNESS_PLAN_LABEL[status.plan!]}${status.daysLeft ? ` · ${status.daysLeft} days left` : ''}` : 'You are on the free plan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5" role="tablist" aria-label="Plan type">
            {(['solo', 'pilot'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className="f-chip" aria-pressed={tab === t} data-testid={`fpro-tab-${t}`} onClick={() => setTab(t)}>
                {t === 'solo' ? 'Solo lifter' : 'Trainer / Biokineticist'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Currency">
            {(['ZAR', 'USD'] as const).map((c) => (
              <button key={c} type="button" className="f-chip" aria-pressed={currency === c} data-testid={`currency-${c}`} onClick={() => setCurrency(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {tab === 'solo' ? (
          <div className="space-y-3">
            <div className="f-card space-y-2" data-testid="plan-trial">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="f-h">{TRIAL_DAYS}-Day Trial</h3>
                <span className="text-lg font-extrabold">Free</span>
              </div>
              <p className="f-small">Try Pro for {TRIAL_DAYS} days. No card, and it ends by itself. One trial per device.</p>
              <button
                type="button"
                className="f-btn w-full"
                disabled={Boolean(ent.trialUsed)}
                data-testid="start-trial"
                onClick={() => {
                  const next = startTrial(ent);
                  if (!next) return setTrialMsg('The trial was already used on this device.');
                  updateEntitlements(() => next);
                  setTrialMsg(`Trial started: ${TRIAL_DAYS} days.`);
                }}
              >
                {ent.trialUsed ? 'Trial already used' : `Start ${TRIAL_DAYS}-day trial`}
              </button>
              {trialMsg && <p role="status" className="f-small" data-testid="trial-msg">{trialMsg}</p>}
            </div>
            {SOLO.map(card)}
          </div>
        ) : (
          <div className="space-y-3">
            {card(PILOT)}
            <form className="f-card space-y-2" data-testid="pilot-form" onSubmit={(e) => { e.preventDefault(); if (pilot.name.trim() && emailOk) pilotMail(); }}>
              <h3 className="f-h">Pilot onboarding</h3>
              <p className="f-small">Tell us about your practice and we will set you up. This opens your email app; nothing is sent from this page.</p>
              <input className="f-input" placeholder="Your name" aria-label="Your name" maxLength={80} value={pilot.name} onChange={(e) => setPilot({ ...pilot, name: e.target.value })} data-testid="pilot-name" />
              <input className="f-input" placeholder="Practice or gym (optional)" aria-label="Practice" maxLength={80} value={pilot.practice} onChange={(e) => setPilot({ ...pilot, practice: e.target.value })} />
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <input className="f-input" type="email" placeholder="Email" aria-label="Email" maxLength={120} value={pilot.email} onChange={(e) => setPilot({ ...pilot, email: e.target.value })} data-testid="pilot-email" />
                <input className="f-input f-center" inputMode="numeric" aria-label="Clients (up to 25)" value={pilot.clients} onChange={(e) => setPilot({ ...pilot, clients: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
              </div>
              <p className="f-small">Clients: up to 25 on the pilot.</p>
              <button type="submit" className="f-btn-primary w-full" disabled={!pilot.name.trim() || !emailOk} data-testid="pilot-submit">
                Request pilot onboarding
              </button>
            </form>
          </div>
        )}

        <div className="f-card">
          <LicenseKeyForm themed accept={(p) => p.startsWith('fitness-')} onApplied={() => undefined} />
        </div>

        {DEMO_UNLOCK_ENABLED && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-xs" style={{ borderColor: 'var(--f-gold)' }} data-testid="fitness-demo-unlock">
            <span>Demo unlock (testing only, not shown in production)</span>
            <button type="button" className="f-btn" style={{ minHeight: 32 }} data-testid="fitness-demo-toggle" onClick={() => updateEntitlements((e) => setDemoFitness(e, ent.fitness?.source !== 'demo'))}>
              {ent.fitness?.source === 'demo' ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        )}
        <p className="f-small">Your plan is stored on this device and checked in your browser. Nothing is sent to a server.</p>
      </div>
    </div>
  );
}
