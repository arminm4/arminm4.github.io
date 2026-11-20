/* Service worker: precaches the whole app (shell + every lesson file) so it works
 * fully offline after the first visit. Responses are served from cache first and
 * refreshed in the background, so content updates arrive on the next launch. */
importScripts('content/catalog.js');

const CACHE = 'armo-learn-' + self.APP_VERSION;
const RUNTIME = 'armo-learn-runtime';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'content/catalog.js', 'content/roadmap.md', 'content/data/shop.sql',
  'js/md.js', 'js/parser.js', 'js/store.js', 'js/runners.js', 'js/app.js', 'js/py-worker.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/maskable-512.png'
];
const COURSES = Object.values(self.CATALOG.courses);
const CONTENT = COURSES.flatMap((c) => c.modules.map((m) => 'content/' + m)).concat(COURSES.map((c) => c.art));
const OPTIONAL = ['vendor/sqljs/sql-wasm.js', 'vendor/sqljs/sql-wasm.wasm'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add files one by one so a single missing file does not break installation.
    await Promise.all(SHELL.concat(CONTENT, OPTIONAL).map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => console.warn('[sw] skip', url))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('armo-learn-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Big, versioned runtime files (Pyodide): cache-first, cached on first use.
  if (url.pathname.includes('/vendor/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') { const shell = await cache.match('index.html'); if (shell) return shell; }
    return new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
