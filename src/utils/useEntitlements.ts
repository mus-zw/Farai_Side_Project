import { useSyncExternalStore } from 'react';
import { ENTITLEMENT_KEY, Entitlements, parseEntitlements } from './entitlements';

// A tiny external store over localStorage, so every component sees an unlock the moment it happens
// (and in other tabs). If storage is blocked, the value is kept in memory for this page view.
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Entitlements } = { raw: null, value: {} };
let memory: Entitlements | null = null;

function snapshot(): Entitlements {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ENTITLEMENT_KEY);
  } catch {
    return cache.value;
  }
  if (raw !== cache.raw) cache = { raw, value: parseEntitlements(raw) };
  return cache.value;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ENTITLEMENT_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function updateEntitlements(fn: (e: Entitlements) => Entitlements): void {
  const next = fn(snapshot());
  try {
    localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(next));
    memory = null;
  } catch {
    memory = next;
  }
  listeners.forEach((l) => l());
}

export function useEntitlements(): Entitlements {
  return useSyncExternalStore(subscribe, snapshot, () => ({}));
}
