import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { db, exportBackup, useLive } from '../../utils/fitnessDb';
import { downloadTextFile } from '../../utils/yoloLabels';
import { toISODate } from '../../utils/fitness';
import { backupDue, lastBackupAt, markBackup, snoozeBackup, snoozedUntil, storageStatus } from '../../utils/offline';
import { useFitness } from './FitnessProvider';
import { useFitnessAuth } from './FitnessAuthProvider';

/**
 * For a log that lives only on this device: a reminder to download a backup, because a cleared browser
 * or a lost phone would take the log with it. Shown rarely (no recent backup, snoozed for two weeks).
 */
export default function BackupNudge() {
  const { seeded, notify } = useFitness();
  const { status } = useFitnessAuth();
  const sessions = useLive(() => db.sessions.count(), [], 0);
  const meals = useLive(() => db.meals.count(), [], 0);
  const weights = useLive(() => db.weights.count(), [], 0);
  const [gone, setGone] = useState(false);
  const [protectedStore, setProtectedStore] = useState<boolean | null>(null);
  useEffect(() => {
    void storageStatus().then((s) => setProtectedStore(s.persisted));
  }, []);

  const due = !gone && backupDue({ records: sessions + meals + weights, signedIn: status === 'signedIn', seeded, lastBackup: lastBackupAt(), snoozedUntil: snoozedUntil() });
  if (!due) return null;

  const download = async () => {
    try {
      const backup = await exportBackup();
      downloadTextFile(`farai-fitness-backup-${toISODate()}.json`, JSON.stringify(backup, null, 2), 'application/json');
      markBackup();
      setGone(true);
      notify('success', `Backup saved: ${backup.sessions.length} sessions, ${backup.meals.length} meals, ${backup.weights.length} weigh-ins.`);
    } catch {
      notify('error', 'Could not create the backup. Try again from Profile.');
    }
  };

  return (
    <section className="f-card space-y-2" data-testid="backup-nudge" aria-label="Back up your log">
      <h2 className="f-h">Back up your log</h2>
      <p className="f-small">
        Your log is saved only in this browser.{protectedStore === false ? ' This browser has not marked it as protected, so it could be cleared if space runs short.' : ''} A backup file keeps it safe if the browser is cleared or the phone is lost.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="f-btn-primary" data-testid="backup-now" style={{ minHeight: 44 }} onClick={() => void download()}>
          <Download className="h-4 w-4" aria-hidden="true" /> Download backup
        </button>
        <button
          type="button"
          className="f-btn"
          data-testid="backup-later"
          style={{ minHeight: 44 }}
          onClick={() => {
            snoozeBackup();
            setGone(true);
          }}
        >
          Remind me later
        </button>
      </div>
    </section>
  );
}
