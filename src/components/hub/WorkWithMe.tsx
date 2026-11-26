import { useState } from 'react';
import { CalendarClock, Rocket } from 'lucide-react';
import { BOOKING_URL, CONTACT_EMAIL } from '../../utils/site';

type Kind = 'call' | 'poc';
const KINDS: Record<Kind, { title: string; price: string; blurb: string }> = {
  call: { title: '20-minute Technical Discovery Call', price: 'Free', blurb: 'Tell me what you want to see or measure. We work out whether on-device computer vision is the right fit, and what a proof of concept would take.' },
  poc: { title: '14-Day CV Proof of Concept', price: '$2,000–$3,500', blurb: 'A working prototype on your data in two weeks: model, edge/browser deployment and a measured latency and accuracy report. Scoped on the call.' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The hub's call to action: book a discovery call or request a 14-day PoC. Composes an email; sends nothing itself. */
export default function WorkWithMe() {
  const [kind, setKind] = useState<Kind>('call');
  const [f, setF] = useState({ name: '', email: '', company: '', brief: '', timeline: 'Exploring' });
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; brief?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!f.name.trim()) next.name = 'Your name, please.';
    if (!EMAIL_RE.test(f.email.trim())) next.email = 'A valid email so I can reply.';
    if (f.brief.trim().length < 10) next.brief = 'A sentence or two about what you want to build or measure.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = `${KINDS[kind].title}\n\nName: ${f.name}\nEmail: ${f.email}\nCompany: ${f.company || '-'}\nTimeline: ${f.timeline}\n\nWhat I want to detect or build:\n${f.brief}\n`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(KINDS[kind].title)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const input = 'min-h-[42px] w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none';

  return (
    <section id="work-with-me" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8" data-testid="work-with-me">
      <div className="rounded-2xl border border-[#32FF00]/30 bg-[#16213E]/40 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold text-white">Work with me</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">Custom edge vision and AI engineering. Start with a short call, or go straight to a two-week proof of concept.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="What would you like?">
          {(['call', 'poc'] as const).map((k) => {
            const Icon = k === 'call' ? CalendarClock : Rocket;
            return (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`intake-${k}`} className={`rounded-xl border p-4 text-left transition-colors ${kind === k ? 'border-[#32FF00] bg-[#32FF00]/10' : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-white"><Icon className="h-4 w-4 text-[#32FF00]" /> {KINDS[k].title}</span>
                  <span className="shrink-0 text-xs font-semibold text-[#32FF00]">{KINDS[k].price}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">{KINDS[k].blurb}</p>
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} noValidate className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="intake-form">
          <label className="space-y-1 text-xs text-neutral-300">
            Name
            <input className={input} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="intake-name" aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="text-rose-300">{errors.name}</span>}
          </label>
          <label className="space-y-1 text-xs text-neutral-300">
            Email
            <input className={input} type="email" value={f.email} maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="intake-email" aria-invalid={Boolean(errors.email)} />
            {errors.email && <span className="text-rose-300">{errors.email}</span>}
          </label>
          <label className="space-y-1 text-xs text-neutral-300">
            Company (optional)
            <input className={input} value={f.company} maxLength={80} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-300">
            Timeline
            <select className={input} value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })}>
              {['Exploring', 'Within 3 months', 'Within a month', 'As soon as possible'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-300 sm:col-span-2">
            What do you want to detect or build?
            <textarea className={`${input} min-h-[96px] py-2`} value={f.brief} maxLength={1200} onChange={(e) => setF({ ...f, brief: e.target.value })} data-testid="intake-brief" aria-invalid={Boolean(errors.brief)} />
            {errors.brief && <span className="text-rose-300">{errors.brief}</span>}
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="min-h-[44px] rounded-xl bg-[#32FF00] px-5 text-sm font-bold text-[#0F1419]" data-testid="intake-submit">
              {kind === 'call' ? 'Request a discovery call' : 'Request a proof of concept'}
            </button>
            {BOOKING_URL && (
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#32FF00] underline-offset-2 hover:underline" data-testid="booking-link">
                Or pick a time directly
              </a>
            )}
          </div>
          <p className="text-xs text-neutral-400 sm:col-span-2" data-testid="intake-note">
            {sent ? 'Your email app should have opened with the request ready to send. If it did not, write to ' : 'This opens a pre-filled email in your own mail app; nothing is sent from this page. Or write to '}
            <a className="text-neutral-300 underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </form>
      </div>
    </section>
  );
}
