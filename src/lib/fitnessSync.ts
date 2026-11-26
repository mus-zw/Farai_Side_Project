/**
 * Local-first sync between the Dexie fitness database and a user's private Firestore area.
 *
 *  - The device keeps working with no network: every change lands in Dexie first.
 *  - Changes are pushed to users/{uid}/{sessions|meals|weights|prefs}/{id} shortly after they happen.
 *  - Changes from other devices arrive by live subscription and are applied to Dexie.
 *  - On start, the two sides are merged without losing anything either has (see reconcile()).
 *
 * "Did this change?" is a string compare of canonical documents (`known`), which is also how
 * echoes are suppressed: a write that came from the cloud is recorded before it is applied locally,
 * so the resulting local change is recognised and not pushed back.
 *
 * Only documents rebuilt by toCloudDoc() are ever sent: nothing from the camera or pose pipeline
 * is part of the fitness database, and the guard in cloudDocs.ts would refuse it anyway.
 */
import { db, isSeeded, onBulkChange } from '../utils/fitnessDb';
import type { CloudChange, CloudStore, Coll } from './cloud';
import { FromCloud, PREF_IDS, PrefId, canon, fromCloudDoc, planReconcile, toCloudDoc } from './cloudDocs';

export interface SyncState {
  phase: 'idle' | 'syncing' | 'error' | 'stopped';
  error?: string;
  lastSyncedAt?: number;
  /** Local changes waiting to be pushed. */
  queued: number;
}

const FLUSH_DELAY_MS = 300;
const WRITE_TIMEOUT_MS = 8000;
const keyOf = (coll: Coll, id: string) => `${coll}:${id}`;
const sleep = (ms: number) => new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms));

type LocalEntry = { value: unknown };

async function readLocal(coll: Coll): Promise<Map<string, LocalEntry>> {
  const out = new Map<string, LocalEntry>();
  if (coll === 'sessions') (await db.sessions.toArray()).forEach((s) => out.set(s.id, { value: s }));
  else if (coll === 'meals') (await db.meals.toArray()).forEach((m) => out.set(m.id, { value: m }));
  else if (coll === 'weights') (await db.weights.toArray()).forEach((w) => out.set(w.date, { value: w }));
  else {
    for (const id of PREF_IDS) {
      const row = await db.kv.get(id);
      if (row?.value !== undefined && row.value !== null) out.set(id, { value: row.value });
    }
  }
  return out;
}

async function readOne(coll: Coll, id: string): Promise<unknown | undefined> {
  if (coll === 'sessions') return db.sessions.get(id);
  if (coll === 'meals') return db.meals.get(id);
  if (coll === 'weights') return db.weights.get(id);
  return (await db.kv.get(id))?.value ?? undefined;
}

async function writeLocal(f: FromCloud): Promise<void> {
  if (f.coll === 'sessions') await db.sessions.put(f.value);
  else if (f.coll === 'meals') await db.meals.put(f.value);
  else if (f.coll === 'weights') await db.weights.put(f.value);
  else await db.kv.put({ key: f.pref, value: f.value });
}

async function deleteLocal(coll: Coll, id: string): Promise<void> {
  if (coll === 'sessions') await db.sessions.delete(id);
  else if (coll === 'meals') await db.meals.delete(id);
  else if (coll === 'weights') await db.weights.delete(id);
  // Profile, settings and cues are never deleted by a remote removal.
}

/** The cloud form of a local value, as { id, data, canon }, or null if it must not be uploaded. */
function cloudFormOf(coll: Coll, id: string, value: unknown) {
  const r = toCloudDoc(coll, value, coll === 'prefs' ? (id as PrefId) : undefined);
  if (!r.ok) {
    console.warn(`[sync] not uploading ${coll}/${id}: ${r.reason}`);
    return null;
  }
  return { id: r.id, data: r.data, canon: canon(r.data) };
}

/** A cloud document, sanitised and normalised: the local value it maps to and its canonical form. */
function normalizeCloud(coll: Coll, id: string, data: Record<string, unknown>) {
  const from = fromCloudDoc(coll, id, data);
  if (!from) return null;
  const again = cloudFormOf(coll, id, from.value);
  return again ? { from, canon: again.canon } : null;
}

export class FitnessSync {
  private known = new Map<string, string>(); // coll:id -> canonical cloud doc last seen or written
  private dirty = new Set<string>();
  private unsubs: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private stopped = false;
  private flushing = false;
  private lastSyncedAt: number | undefined;
  private state: SyncState = { phase: 'idle', queued: 0 };

  constructor(
    private store: CloudStore,
    private onState: (s: SyncState) => void
  ) {}

  private emit(patch: Partial<SyncState>) {
    this.state = { ...this.state, queued: this.dirty.size, lastSyncedAt: this.lastSyncedAt, ...patch };
    if (!this.stopped || patch.phase === 'stopped') this.onState(this.state);
  }

  /** Merge device and cloud, then keep them in step. Resolves once the first merge is done. */
  async start(): Promise<{ cloudHadAthlete: boolean }> {
    this.emit({ phase: 'syncing', error: undefined });
    const info = await this.reconcile();
    this.installHooks();
    this.subscribeAll();
    window.addEventListener('online', this.onOnline);
    return info;
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    window.removeEventListener('online', this.onOnline);
    this.dirty.clear();
    this.emit({ phase: 'stopped', queued: 0 });
  }

  private onOnline = () => {
    if (this.dirty.size) this.scheduleFlush(0);
  };

  // --- Reconcile ---------------------------------------------------------------------------------

  /**
   * Union of both sides. Anything only on the device is uploaded, anything only in the cloud is
   * downloaded, and where both have the same document the cloud's copy wins (it is the account's
   * record). Nothing is deleted by a merge.
   */
  async reconcile(): Promise<{ cloudHadAthlete: boolean }> {
    this.emit({ phase: 'syncing' });
    let cloudHadAthlete = false;
    try {
      // Made-up sample data belongs to nobody: it must never be uploaded to an account.
      if (await isSeeded()) throw new Error('Sample data is never synced. Start fresh first.');
      for (const coll of ['sessions', 'meals', 'weights', 'prefs'] as const) {
        const [cloudDocs, local] = await Promise.all([this.store.list(coll), readLocal(coll)]);
        const cloud = new Map<string, { from: FromCloud; canon: string }>();
        for (const d of cloudDocs) {
          const n = normalizeCloud(coll, d.id, d.data);
          if (n) cloud.set(d.id, n);
        }
        if (coll === 'prefs' && cloud.has('athlete')) cloudHadAthlete = true;

        const localCanon = new Map<string, string>();
        for (const [id, e] of local) {
          const f = cloudFormOf(coll, id, e.value);
          if (f) localCanon.set(id, f.canon);
        }
        const plan = planReconcile(localCanon, new Map([...cloud].map(([id, c]) => [id, c.canon])));

        for (const id of plan.toLocal) {
          const c = cloud.get(id)!;
          this.known.set(keyOf(coll, id), c.canon);
          await writeLocal(c.from);
        }
        for (const id of plan.toCloud) {
          const f = cloudFormOf(coll, id, local.get(id)!.value);
          if (f) await this.push(coll, f.id, f.data, f.canon);
        }
        for (const [id, c] of cloud) this.known.set(keyOf(coll, id), c.canon);
      }
      this.lastSyncedAt = Date.now();
      this.retries = 0;
      this.emit({ phase: 'idle', error: undefined });
    } catch (e) {
      this.fail(e);
      throw e;
    }
    return { cloudHadAthlete };
  }

  /**
   * After a bulk local change (clear my logs, restore a backup): make the cloud match this device
   * for workouts, meals and weigh-ins, including deleting what is no longer here. Prefs are only
   * ever pushed, never deleted.
   */
  async mirror(): Promise<void> {
    if (this.stopped) return;
    this.emit({ phase: 'syncing' });
    try {
      for (const coll of ['sessions', 'meals', 'weights', 'prefs'] as const) {
        const [cloudDocs, local] = await Promise.all([this.store.list(coll), readLocal(coll)]);
        const localIds = new Set(local.keys());
        if (coll !== 'prefs') {
          for (const d of cloudDocs) {
            if (!localIds.has(d.id)) {
              await this.store.remove(coll, d.id);
              this.known.delete(keyOf(coll, d.id));
            }
          }
        }
        for (const [id, e] of local) this.markDirty(coll, id, e.value);
      }
      await this.flush();
    } catch (e) {
      this.fail(e);
    }
  }

  // --- Local -> cloud ----------------------------------------------------------------------------

  private installHooks() {
    const hooks: { table: { hook: any }; coll: Coll; keyOnly?: boolean }[] = [
      { table: db.sessions, coll: 'sessions' },
      { table: db.meals, coll: 'meals' },
      { table: db.weights, coll: 'weights' },
      { table: db.kv, coll: 'prefs', keyOnly: true },
    ];
    for (const { table, coll } of hooks) {
      const idOf = (pk: unknown, obj: any): string | null => {
        const id = pk !== undefined && pk !== null ? String(pk) : obj?.id ?? obj?.date ?? obj?.key;
        if (id === undefined || id === null) return null;
        if (coll === 'prefs' && !PREF_IDS.includes(String(id) as PrefId)) return null; // the draft and flags stay on this device
        return String(id);
      };
      const created = (pk: unknown, obj: unknown) => {
        const id = idOf(pk, obj);
        if (id) this.markDirty(coll, id);
      };
      const updated = (_mods: unknown, pk: unknown, obj: unknown) => {
        const id = idOf(pk, obj);
        if (id) this.markDirty(coll, id);
      };
      const deleted = (pk: unknown, obj: unknown) => {
        const id = idOf(pk, obj);
        if (id) this.markDirty(coll, id);
      };
      table.hook('creating', created);
      table.hook('updating', updated);
      table.hook('deleting', deleted);
      this.unsubs.push(() => {
        table.hook('creating').unsubscribe(created);
        table.hook('updating').unsubscribe(updated);
        table.hook('deleting').unsubscribe(deleted);
      });
    }
    this.unsubs.push(onBulkChange(() => void this.mirror()));
  }

  private markDirty(coll: Coll, id: string, _value?: unknown) {
    if (this.stopped) return;
    this.dirty.add(keyOf(coll, id));
    this.scheduleFlush(FLUSH_DELAY_MS);
    this.emit({});
  }

  private scheduleFlush(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  private async push(coll: Coll, id: string, data: Record<string, unknown>, c: string) {
    // Offline, Firestore queues the write and the promise stays pending: treat a slow ack as "queued", not failed.
    await Promise.race([this.store.set(coll, id, data), sleep(WRITE_TIMEOUT_MS)]);
    this.known.set(keyOf(coll, id), c);
  }

  /** Send every pending change: current local state is what gets written, or deleted if it is gone. */
  async flush(): Promise<void> {
    if (this.flushing || this.stopped) return;
    this.flushing = true;
    try {
      this.emit({ phase: 'syncing' });
      if (await isSeeded()) {
        this.dirty.clear(); // same rule as reconcile(): sample data stays on the device
        this.emit({ phase: 'idle' });
        return;
      }
      for (const key of [...this.dirty]) {
        const [coll, ...rest] = key.split(':') as [Coll, ...string[]];
        const id = rest.join(':');
        const current = await readOne(coll, id);
        if (current === undefined || current === null) {
          if (this.known.has(key) && coll !== 'prefs') {
            await Promise.race([this.store.remove(coll, id), sleep(WRITE_TIMEOUT_MS)]);
            this.known.delete(key);
          }
        } else {
          const f = cloudFormOf(coll, id, current);
          if (f && this.known.get(key) !== f.canon) await this.push(coll, f.id, f.data, f.canon);
        }
        this.dirty.delete(key);
      }
      this.lastSyncedAt = Date.now();
      this.retries = 0;
      this.emit({ phase: 'idle', error: undefined });
    } catch (e) {
      this.fail(e);
    } finally {
      this.flushing = false;
      // A change that arrived while this flush was running had its own flush skipped (we were busy):
      // pick it up now, or it would sit until the next unrelated edit.
      if (this.dirty.size > 0 && !this.stopped) this.scheduleFlush(FLUSH_DELAY_MS);
    }
  }

  private fail(e: unknown) {
    const message = (e as Error)?.message || 'Sync failed.';
    this.emit({ phase: 'error', error: message });
    if (this.stopped) return;
    this.retries += 1;
    this.scheduleFlush(Math.min(60_000, 2000 * 2 ** Math.min(this.retries, 5)));
  }

  // --- Cloud -> local ------------------------------------------------------------------------------

  private subscribeAll() {
    for (const coll of ['sessions', 'meals', 'weights', 'prefs'] as const) {
      this.unsubs.push(
        this.store.subscribe(
          coll,
          (changes) => void this.onRemote(coll, changes),
          (e) => this.fail(e)
        )
      );
    }
  }

  private async onRemote(coll: Coll, changes: CloudChange[]) {
    if (this.stopped) return;
    for (const ch of changes) {
      if (ch.pending) continue; // this device's own write, not yet confirmed
      const key = keyOf(coll, ch.doc.id);
      try {
        if (ch.type === 'removed') {
          this.known.delete(key);
          await deleteLocal(coll, ch.doc.id);
          continue;
        }
        const n = normalizeCloud(coll, ch.doc.id, ch.doc.data);
        if (!n || this.known.get(key) === n.canon) continue; // unusable, or an echo of what we already have
        this.known.set(key, n.canon);
        await writeLocal(n.from);
      } catch (e) {
        this.fail(e);
      }
    }
    this.lastSyncedAt = Date.now();
    this.emit({});
  }
}
