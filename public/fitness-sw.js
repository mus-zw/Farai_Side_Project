/*
 * Offline shell for the Fitness app. Registered from the fitness app only, with the scope /fitness, so
 * the portfolio and /demo never get a service worker. It caches no user data (that lives in IndexedDB)
 * and never touches a cross-origin request (Firebase, fonts, Google model hosts).
 *
 *   page loads          network first, falling back to the last good copy of the app shell
 *   /assets/*           the app's own hashed code and styles: cache first
 *   /ort, /models,
 *   /mediapipe          the large on-device AI files: cache first, only once the person has used the
 *                       feature, and only while the device has room
 *
 * Bump VERSION to drop every cache this worker made.
 */
const VERSION = 'fitness-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const BIG = `${VERSION}-big`;
const SHELL_KEY = '/__fitness_shell__';

// Works under a sub-path deploy: the directory this script is served from.
const BASE = new URL('./', self.location).pathname;
const MAX_ASSETS = 150;
const MAX_BIG_FILE = 70 * 1024 * 1024;
const MAX_QUOTA_SHARE = 0.6;
const NAV_TIMEOUT_MS = 5000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, BIG]);
      for (const key of await caches.keys()) if (key.startsWith('fitness-') && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigate(req));
  } else if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cacheFirst(req, ASSETS, false));
  } else if (/^(ort|models|mediapipe)\//.test(url.pathname.slice(BASE.length))) {
    event.respondWith(cacheFirst(req, BIG, true));
  }
});

/** A page load may not be answered with a redirected response, so rebuild one that came from a redirect. */
async function plain(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function navigate(req) {
  const cache = await caches.open(SHELL);
  try {
    const net = await Promise.race([fetch(req), new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NAV_TIMEOUT_MS))]);
    const res = await plain(net);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) await cache.put(SHELL_KEY, res.clone());
    return res;
  } catch {
    const shell = await cache.match(SHELL_KEY);
    if (shell) return shell;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><body style="font:16px system-ui;background:#0a0c0f;color:#eaeef3;padding:2rem"><h1>You are offline</h1><p>Open Fitness once while online and it will work offline after that.</p>', {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}

async function cacheFirst(req, name, guardSize) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200 && res.type === 'basic') {
    if (!guardSize) {
      await cache.put(req, res.clone());
      void trim(cache, MAX_ASSETS);
    } else if (await hasRoomFor(res)) {
      await cache.put(req, res.clone());
    }
  }
  return res;
}

/** A big file is kept only if it is a sane size and the device is not already short of space. */
async function hasRoomFor(res) {
  const size = Number(res.headers.get('content-length')) || 0;
  if (size > MAX_BIG_FILE) return false;
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {};
    return !quota || usage + size < quota * MAX_QUOTA_SHARE;
  } catch {
    return true;
  }
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}
