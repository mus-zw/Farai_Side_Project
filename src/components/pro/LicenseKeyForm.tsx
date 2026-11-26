import { useState } from 'react';
import { applyLicense, verifyLicense, type Product } from '../../utils/entitlements';
import { LICENSE_PUBLIC_KEY } from '../../utils/checkout';
import { updateEntitlements } from '../../utils/useEntitlements';

/** Paste a license key; it is checked in the browser against the public key and nothing is sent anywhere. */
export default function LicenseKeyForm({ accept, onApplied, themed = false }: { accept: (p: Product) => boolean; onApplied: () => void; themed?: boolean }) {
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await verifyLicense(key, LICENSE_PUBLIC_KEY);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.reason });
    if (!accept(r.product)) return setMsg({ ok: false, text: 'That key is for a different product.' });
    updateEntitlements((cur) => applyLicense(cur, r));
    setMsg({ ok: true, text: r.expiresAt ? `Unlocked until ${new Date(r.expiresAt).toLocaleDateString()}.` : 'Unlocked.' });
    setKey('');
    onApplied();
  };

  const input = themed ? 'f-input' : 'min-h-[40px] w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#32FF00] focus:outline-none';
  const button = themed ? 'f-btn' : 'min-h-[40px] rounded-lg border border-neutral-700 px-4 text-sm font-semibold text-neutral-200 hover:border-neutral-500 disabled:opacity-40';

  return (
    <form onSubmit={submit} className="space-y-2" data-testid="license-form">
      <label className="block text-xs font-semibold">Have a license key?</label>
      <div className="flex gap-2">
        <input className={input} value={key} onChange={(e) => { setKey(e.target.value); setMsg(null); }} placeholder="FARAI1.…" aria-label="License key" autoComplete="off" spellCheck={false} data-testid="license-input" />
        <button type="submit" className={button} disabled={!key.trim() || busy} data-testid="license-apply">
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </div>
      {msg && (
        <p role="status" className="text-xs" style={{ color: msg.ok ? '#32FF00' : '#ff5470' }} data-testid="license-msg">
          {msg.text}
        </p>
      )}
      {!LICENSE_PUBLIC_KEY && <p className="text-[11px] opacity-60">License keys are not enabled on this build.</p>}
    </form>
  );
}
