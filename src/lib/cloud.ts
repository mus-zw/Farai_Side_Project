/**
 * The two small interfaces the fitness sync talks to. The real implementation is Firebase
 * (src/lib/firebase.ts); a dev-only in-memory one (src/lib/mockCloud.ts) stands in for it while
 * developing without a project. Keeping the app behind these keeps the sync engine testable and
 * the Firebase SDK out of everything that does not need it.
 */

export type Coll = 'sessions' | 'meals' | 'weights' | 'prefs';
export const COLLS: readonly Coll[] = ['sessions', 'meals', 'weights', 'prefs'];

export interface CloudUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface CloudDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface CloudChange {
  type: 'added' | 'modified' | 'removed';
  doc: CloudDoc;
  /** True for this device's own writes that the server has not confirmed yet. */
  pending?: boolean;
}

/** A user's private area: users/{uid}/{coll}/{id}. */
export interface CloudStore {
  list(coll: Coll): Promise<CloudDoc[]>;
  set(coll: Coll, id: string, data: Record<string, unknown>): Promise<void>;
  remove(coll: Coll, id: string): Promise<void>;
  subscribe(coll: Coll, onChanges: (changes: CloudChange[]) => void, onError: (e: Error) => void): () => void;
  /** Delete everything under users/{uid}. */
  deleteAll(): Promise<void>;
}

export interface AuthBackend {
  /** Calls back with the current user (or null) now and on every change. Returns an unsubscribe. */
  onAuthChange(cb: (user: CloudUser | null) => void): () => void;
  signUpEmail(email: string, password: string, displayName?: string): Promise<void>;
  signInEmail(email: string, password: string): Promise<void>;
  signInGoogle(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

export interface CloudBackend {
  kind: 'firebase' | 'mock';
  auth: AuthBackend;
  store(uid: string): CloudStore;
}

/** An auth failure with a stable code and a message that is safe to show. */
export class CloudAuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

/** Plain-language messages for Firebase Auth error codes. Pure. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'Choose a password of at least 8 characters.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Email or password is incorrect.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach the sign-in service. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The Google sign-in window was closed before it finished.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'That email is already registered with a different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not turned on for this app yet.';
    case 'auth/unauthorized-domain':
      return 'This website address is not authorised for sign-in. Add it to the Firebase authorised domains.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out, sign in again, and then retry.';
    default:
      return 'Something went wrong signing in. Please try again.';
  }
}

/** Wrap whatever an SDK threw into a CloudAuthError. */
export function toAuthError(err: unknown): CloudAuthError {
  if (err instanceof CloudAuthError) return err;
  const code = typeof (err as any)?.code === 'string' ? (err as any).code : 'auth/unknown';
  return new CloudAuthError(code, authErrorMessage(code));
}
