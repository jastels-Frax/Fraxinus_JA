// sw.js — Fraxinus Wildlife App service worker
// Strategy: cache-first for same-origin assets; network-only for external CDN
// and Felt API calls.

const CACHE_NAME = 'fraxinus-v1';

const APP_SHELL = [
  './',
  './css/style.css',
  './js/main.js',
  './data/species_list.js',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for same-origin; network-only for cross-origin ─────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Felt API calls or POST requests
  if (url.hostname.includes('felt.com') || event.request.method !== 'GET') {
    return;
  }

  // External CDN resources (Leaflet tiles, Font Awesome, Google Fonts, ArcGIS):
  // network-first, fall back silently — no caching to avoid unbounded growth.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 408 }))
    );
    return;
  }

  // Same-origin requests: cache-first, update cache in background.
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }).catch(() => null);
      return cached || await networkFetch;
    })
  );
});
