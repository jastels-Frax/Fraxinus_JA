// sw.js — Offline support. The whole app shell (every module) and its CDN
// libraries are cached at install, so the app opens with no signal.
// Map tiles and report imagery are network-only.

const CACHE = 'fraxinus-v2';

const APP = [
  './', './index.html', './manifest.json', './css/style.css',
  './data/species_list.js',
  './js/app.js', './js/location.js', './js/report.js',
  './js/core/export.js', './js/core/fields.js', './js/core/geo.js', './js/core/migrate.js',
  './js/core/session.js', './js/core/store.js', './js/core/zip.js',
  './js/map/leaflet.js',
  './js/surveys/index.js', './js/surveys/common.js', './js/surveys/bbs.js',
  './js/surveys/nest.js', './js/surveys/turtle.js', './js/surveys/wildlife.js',
  './js/ui/dom.js', './js/ui/exporter.js', './js/ui/form.js', './js/ui/home.js', './js/ui/survey.js',
  './img/icon-192.png', './img/icon-512.png',
  './img/LOGO w TEXT black bg.jpg', './img/LOGO w TEXT white and green.jpg', './img/LOGO w TEXT black.jpg',
];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
// Cross-origin hosts whose responses are cached on first use (fonts, Leaflet images)
const CACHEABLE_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP);
    await Promise.all(CDN.map(u => cache.add(u).catch(() => {})));   // best effort
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;   // tiles, imagery: network only

  // Stale-while-revalidate: serve from cache instantly, refresh in the background
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
