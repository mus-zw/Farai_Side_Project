import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { MAX_BACKUP_BYTES, MAX_CSV_BYTES, db, exportBackup, importBackup, importCsv, nutritionCsv, weightsCsv, workoutsCsv } from '../../utils/fitnessDb';
import { downloadTextFile } from '../../utils/yoloLabels';
import { Unit, toISODate } from '../../utils/fitness';
import { markBackup, protectStorage, storageStatus } from '../../utils/offline';

type Notify = (type: 'success' | 'error' | 'info', message: string) => void;

/** Export everything as JSON or CSV, and restore from a JSON backup. All of it happens in the browser. */
export default function BackupPanel({ unit, notify }: { unit: Unit; notify: Notify }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stamp = toISODate();
  const [store, setStore] = useState<{ persisted: boolean | null; usedMB: number | null } | null>(null);
  useEffect(() => {
    void storageStatus().then(setStore);
  }, []);

  const exportJson = async () => {
    const backup = await exportBackup();
    downloadTextFile(`farai-fitness-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
    markBackup();
    notify('success', `Backup saved: ${backup.sessions.length} sessions, ${backup.meals.length} meals, ${backup.weights.length} weigh-ins.`);
  };

  const exportCsv = async (kind: 'workouts' | 'nutrition' | 'weight') => {
    if (kind === 'workouts') downloadTextFile(`workouts-${stamp}.csv`, workoutsCsv(await db.sessions.orderBy('date').toArray(), unit), 'text/csv;charset=utf-8');
    else if (kind === 'nutrition') downloadTextFile(`nutrition-${stamp}.csv`, nutritionCsv(await db.meals.orderBy('date').toArray()), 'text/csv;charset=utf-8');
    else downloadTextFile(`bodyweight-${stamp}.csv`, weightsCsv(await db.weights.orderBy('date').toArray(), unit), 'text/csv;charset=utf-8');
    notify('success', `${kind[0].toUpperCase() + kind.slice(1)} CSV downloaded.`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      notify('error', `That file is ${(file.size / 1048576).toFixed(1)} MB; backups are never that large (limit ${MAX_BACKUP_BYTES / 1048576} MB).`);
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      notify('error', 'That file is not valid JSON.');
      return;
    }
    if (!window.confirm('Restoring replaces everything currently in this app (sessions, meals, weigh-ins and settings) with the backup. Continue?')) return;
    setBusy(true);
    try {
      const r = await importBackup(json);
      notify('success', `Restored ${r.sessions} sessions, ${r.meals} meals and ${r.weights} weigh-ins${r.skipped ? ` (${r.skipped} unreadable entries skipped)` : ''}.`);
    } catch (e: any) {
      notify('error', e?.message || 'Could not restore that backup.');
    } finally {
      setBusy(false);
    }
  };

  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      notify('error', `That CSV is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_CSV_BYTES / 1048576} MB.`);
      return;
    }
    setBusy(true);
    try {
      const r = await importCsv(await file.text());
      notify('success', `Added ${r.added} ${r.kind === 'weight' ? 'weigh-ins' : r.kind === 'nutrition' ? 'meals' : 'sessions'} from CSV${r.skipped ? ` (${r.skipped} skipped: duplicates or unreadable rows)` : ''}.`);
    } catch (e: any) {
      notify('error', e?.message || 'Could not import that CSV.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="f-card space-y-3" data-testid="backup-card">
      <h2 className="f-h">Backup &amp; export</h2>
      <p className="f-small">
        Your data lives only in this browser. Download a backup now and then, and use it to move to another device. Restoring a JSON backup
        replaces everything; importing a CSV adds to what you have.
      </p>
      {store && (
        <p className="f-small" data-testid="storage-status" data-persisted={String(store.persisted)}>
          Browser storage protection:{' '}
          <strong style={{ color: 'var(--f-text)' }}>{store.persisted === true ? 'on' : store.persisted === false ? 'off' : 'not reported by this browser'}</strong>
          {store.usedMB !== null ? ` · ${store.usedMB} MB used` : ''}.
          {store.persisted === false && (
            <>
              {' '}
              <button
                type="button"
                className="underline"
                style={{ minHeight: 32 }}
                data-testid="protect-storage"
                onClick={() => void protectStorage().then(() => storageStatus().then(setStore))}
              >
                Ask the browser to protect it
              </button>
            </>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="f-btn-primary" data-testid="export-json" onClick={() => void exportJson()}>
          <Download className="h-4 w-4" /> Backup (JSON)
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="import-input" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className="f-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Restore from backup
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="f-btn" data-testid="export-csv-workouts" onClick={() => void exportCsv('workouts')}>
          Workouts CSV
        </button>
        <button type="button" className="f-btn" onClick={() => void exportCsv('nutrition')}>
          Nutrition CSV
        </button>
        <button type="button" className="f-btn" onClick={() => void exportCsv('weight')}>
          Body weight CSV
        </button>
        <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" data-testid="import-csv-input" onChange={(e) => { void onCsv(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className="f-btn" disabled={busy} data-testid="import-csv" onClick={() => csvRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import CSV
        </button>
      </div>
    </section>
  );
}
