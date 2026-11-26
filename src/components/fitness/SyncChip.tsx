import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, CloudOff, HardDrive, RefreshCw, TriangleAlert } from 'lucide-react';
import { useFitnessAuth } from './FitnessAuthProvider';

/** Where your data lives right now: this device only, syncing, synced, waiting offline, or a sync problem. */
export default function SyncChip() {
  const { status, sync } = useFitnessAuth();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  let label = 'On this device';
  let hint = 'Saved in this browser only. Create an account in Profile to back it up and use it on other devices.';
  let Icon = HardDrive;
  let color = 'var(--f-muted)';
  let phase = 'local';
  if (status === 'signedIn') {
    if (sync.phase === 'error') ({ label, hint, Icon, color, phase } = { label: 'Sync problem', hint: `Your data is safe on this device. ${sync.error ?? ''}`.trim(), Icon: TriangleAlert, color: 'var(--f-bad)', phase: 'error' });
    else if (!online) ({ label, hint, Icon, color, phase } = { label: sync.queued ? `Offline · ${sync.queued} waiting` : 'Offline', hint: 'Changes are saved here and sync when you are back online.', Icon: CloudOff, color: 'var(--f-gold)', phase: 'offline' });
    else if (sync.phase === 'syncing' || sync.queued > 0) ({ label, hint, Icon, color, phase } = { label: sync.queued ? `Syncing · ${sync.queued}` : 'Syncing', hint: 'Sending your latest changes to your account.', Icon: RefreshCw, color: 'var(--f-gold)', phase: 'syncing' });
    else ({ label, hint, Icon, color, phase } = { label: 'Synced', hint: sync.lastSyncedAt ? `Backed up to your account at ${new Date(sync.lastSyncedAt).toLocaleTimeString()}.` : 'Backed up to your account.', Icon: Cloud, color: 'var(--f-good)', phase: 'synced' });
  } else if (status === 'loading') {
    label = 'Checking sign-in';
  }
  return (
    <Link to="/fitness/profile" className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold" style={{ borderColor: 'var(--f-border)', color: 'var(--f-text)' }} title={hint} aria-label={`${label}. ${hint}`} data-testid="sync-chip" data-phase={phase}>
      <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
      {label}
    </Link>
  );
}
