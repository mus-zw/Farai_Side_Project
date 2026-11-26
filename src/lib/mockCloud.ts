/**
 * A DEVELOPMENT-ONLY stand-in for Firebase, so sign-up, sign-in and sync can be exercised without
 * a project. It keeps "accounts" and "cloud data" in localStorage under __mockcloud_v1 (passwords
 * in the clear: it is a test double, not security). Enabled only by `npm run dev` with
 * VITE_FIREBASE_MOCK=true; the production build does not contain this file.
 */
import { AuthBackend, CloudBackend, CloudChange, CloudStore, CloudUser, CloudAuthError, COLLS, Coll } from './cloud';

const KEY = '__mockcloud_v1';
const SESSION_KEY = '__mockcloud_session_v1';

interface MockDb {
  users: Record<string, { uid: string; password: string; displayName: string | null }>;
  data: Record<string, Record<string, Record<string, Record<string, unknown>>>>; // uid -> coll -> id -> doc
}

const read = (): MockDb => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '') as MockDb;
  } catch {
    return { users: {}, data: {} };
  }
};
const write = (db: MockDb) => localStorage.setItem(KEY, JSON.stringify(db));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function createMockBackend(): CloudBackend {
  const currentUid = () => localStorage.getItem(SESSION_KEY);
  const asUser = (uid: string | null): CloudUser | null => {
    if (!uid) return null;
    const u = read().users[uid];
    return u ? { uid, email: uid.startsWith('google-') ? 'google.dev@example.com' : uid.replace(/^mock-/, ''), displayName: u.displayName } : null;
  };
  const login = (uid: string) => {
    localStorage.setItem(SESSION_KEY, uid);
    notify();
  };

  const auth: AuthBackend = {
    onAuthChange(cb) {
      let last: string | null | undefined; // like Firebase: only call back when the signed-in user changes
      const emit = () => {
        const uid = currentUid();
        if (uid === last) return;
        last = uid;
        cb(asUser(uid));
      };
      listeners.add(emit);
      const onStorage = (e: StorageEvent) => (e.key === SESSION_KEY || e.key === KEY) && emit();
      window.addEventListener('storage', onStorage);
      setTimeout(emit, 0);
      return () => {
        listeners.delete(emit);
        window.removeEventListener('storage', onStorage);
      };
    },
    async signUpEmail(email, password, displayName) {
      await delay(0);
      const e = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new CloudAuthError('auth/invalid-email', 'That email address does not look right.');
      if (password.length < 6) throw new CloudAuthError('auth/weak-password', 'Choose a password of at least 8 characters.');
      const db = read();
      const uid = `mock-${e}`;
      if (db.users[uid]) throw new CloudAuthError('auth/email-already-in-use', 'An account with that email already exists. Try signing in instead.');
      db.users[uid] = { uid, password, displayName: displayName?.trim() || null };
      write(db);
      login(uid);
    },
    async signInEmail(email, password) {
      await delay(0);
      const uid = `mock-${email.trim().toLowerCase()}`;
      const u = read().users[uid];
      if (!u || u.password !== password) throw new CloudAuthError('auth/invalid-credential', 'Email or password is incorrect.');
      login(uid);
    },
    async signInGoogle() {
      await delay(0);
      const uid = 'google-dev-user';
      const db = read();
      db.users[uid] ??= { uid, password: '', displayName: 'Google Dev' };
      write(db);
      login(uid);
    },
    async sendPasswordReset() {
      await delay(0);
    },
    async signOut() {
      await delay(0);
      localStorage.removeItem(SESSION_KEY);
      notify();
    },
    async deleteAccount() {
      await delay(0);
      const uid = currentUid();
      if (!uid) return;
      const db = read();
      delete db.users[uid];
      delete db.data[uid];
      write(db);
      localStorage.removeItem(SESSION_KEY);
      notify();
    },
  };

  const store = (uid: string): CloudStore => {
    const get = (c: Coll) => read().data[uid]?.[c] ?? {};
    return {
      async list(c) {
        return delay(Object.entries(get(c)).map(([id, data]) => ({ id, data: clone(data) })));
      },
      async set(c, id, data) {
        await delay(0);
        const db = read();
        ((db.data[uid] ??= {})[c] ??= {})[id] = clone(data);
        write(db);
        notify();
      },
      async remove(c, id) {
        await delay(0);
        const db = read();
        delete db.data[uid]?.[c]?.[id];
        write(db);
        notify();
      },
      subscribe(c, onChanges) {
        let known: Record<string, string> = Object.fromEntries(Object.entries(get(c)).map(([id, d]) => [id, JSON.stringify(d)]));
        const first = Object.entries(get(c)).map(([id, data]): CloudChange => ({ type: 'added', doc: { id, data: clone(data) } }));
        const t = setTimeout(() => first.length && onChanges(first), 0);
        const check = () => {
          const now = get(c);
          const changes: CloudChange[] = [];
          for (const [id, d] of Object.entries(now)) {
            const s = JSON.stringify(d);
            if (known[id] === undefined) changes.push({ type: 'added', doc: { id, data: clone(d) } });
            else if (known[id] !== s) changes.push({ type: 'modified', doc: { id, data: clone(d) } });
          }
          for (const id of Object.keys(known)) if (!(id in now)) changes.push({ type: 'removed', doc: { id, data: {} } });
          known = Object.fromEntries(Object.entries(now).map(([id, d]) => [id, JSON.stringify(d)]));
          if (changes.length) onChanges(changes);
        };
        listeners.add(check);
        const onStorage = (e: StorageEvent) => e.key === KEY && check();
        window.addEventListener('storage', onStorage);
        return () => {
          clearTimeout(t);
          listeners.delete(check);
          window.removeEventListener('storage', onStorage);
        };
      },
      async deleteAll() {
        await delay(0);
        const db = read();
        delete db.data[uid];
        write(db);
        notify();
        void COLLS;
      },
    };
  };

  return { kind: 'mock', auth, store };
}
