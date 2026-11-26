/**
 * Firebase initialisation and the Auth / Firestore adapters. Loaded lazily (dynamic import) and
 * only by the fitness app, so none of the SDK is in the portfolio bundle.
 *
 * The Firebase app is NAMED "fitness" so its sign-in state and cache are kept apart from anything
 * else on the same origin: the portfolio, the CV lab and the fitness product do not share a login.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { AuthBackend, CloudBackend, CloudStore, COLLS, Coll, toAuthError } from './cloud';
import type { FirebaseWebConfig } from './firebaseConfig';

const APP_NAME = 'fitness';
let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/** Initialise (once) the named Firebase app with Auth and an offline-capable Firestore. */
export function getFirebase(config: FirebaseWebConfig) {
  if (cached) return cached;
  const app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(config, APP_NAME);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    // Reads and writes work offline and sync later; several tabs can share the cache.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {}); // already initialised, or no IndexedDB: plain in-memory cache
  }
  cached = { app, auth, db };
  return cached;
}

function authBackend(auth: Auth): AuthBackend {
  const ready = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  // If a Google redirect sign-in (the popup fallback) just completed, the user arrives via onAuthChange.
  void getRedirectResult(auth).catch(() => undefined);

  const wrap = async (fn: () => Promise<unknown>) => {
    try {
      await ready;
      await fn();
    } catch (e) {
      throw toAuthError(e);
    }
  };

  return {
    onAuthChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)),
    signUpEmail: (email, password, displayName) =>
      wrap(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName?.trim()) await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 40) });
      }),
    signInEmail: (email, password) => wrap(() => signInWithEmailAndPassword(auth, email.trim(), password)),
    signInGoogle: () =>
      wrap(async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          await signInWithPopup(auth, provider);
        } catch (e: any) {
          // Some mobile browsers block pop-ups: fall back to a full-page redirect.
          if (e?.code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
          else throw e;
        }
      }),
    sendPasswordReset: (email) => wrap(() => sendPasswordResetEmail(auth, email.trim())),
    signOut: () => wrap(() => fbSignOut(auth)),
    deleteAccount: () =>
      wrap(async () => {
        if (!auth.currentUser) return;
        await deleteUser(auth.currentUser);
      }),
  };
}

function firestoreStore(db: Firestore, uid: string): CloudStore {
  const coll = (c: Coll) => collection(db, 'users', uid, c);
  return {
    async list(c) {
      const snap = await getDocs(coll(c));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
    },
    set: (c, id, data) => setDoc(doc(db, 'users', uid, c, id), data),
    remove: (c, id) => deleteDoc(doc(db, 'users', uid, c, id)),
    subscribe(c, onChanges, onError) {
      return onSnapshot(
        coll(c),
        (snap) =>
          onChanges(
            snap.docChanges().map((ch) => ({
              type: ch.type,
              doc: { id: ch.doc.id, data: ch.doc.data() as Record<string, unknown> },
              pending: ch.doc.metadata.hasPendingWrites,
            }))
          ),
        (e) => onError(e)
      );
    },
    async deleteAll() {
      for (const c of COLLS) {
        const snap = await getDocs(coll(c));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await deleteDoc(doc(db, 'users', uid)).catch(() => undefined);
    },
  };
}

export function createFirebaseBackend(config: FirebaseWebConfig): CloudBackend {
  const { auth, db } = getFirebase(config);
  return { kind: 'firebase', auth: authBackend(auth), store: (uid) => firestoreStore(db, uid) };
}
