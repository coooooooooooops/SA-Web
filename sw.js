/* SA Web service worker.
 *
 * 1. Cross-origin isolation (from coi-serviceworker v0.1.7, MIT, Guido Zuidhof and contributors): adds the
 *    COOP/COEP/CORP headers to every response, so the emulator's threads work on hosts that can't send them.
 * 2. Offline: the page, the emulator and the fonts are kept in this browser. Online, files come from the
 *    network (so a new deploy shows at once) and the copy is refreshed; offline, the copy is used.
 *    The BIOS, your disc and your saves are never fetched, so they are never in this cache.
 */
const CACHE = 'sa-web-v1';

// What the install waits for. The emulator files are big: the page asks for them after it has loaded
// ('cache-big' message below), and they are also cached whenever the page loads them.
const SHELL = [
  './', 'index.html', 'style.css', 'sa.css', 'app.js', 'sa-shell.js', 'isolation.js',
  'disc-worker.js', 'cable-worker.js', 'audio-tap.js', 'icons.svg', 'manifest.webmanifest',
  'sa-logo.png', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
  'fonts/archivo.woff2', 'fonts/chivo-mono.woff2',
  'library/sa-launcher.js', 'library/sa-launcher.css', 'library/player-library.js', 'library/folder.js',
  'library/disc-info.js', 'library/console-pads.css',
];
const BIG = ['pcsx2-wasm.js', 'pcsx2-wasm.wasm', 'pcsx2-wasm.data', 'game-titles.tsv'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data !== 'cache-big')
    return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const u of BIG) {
      if (await cache.match(u))
        continue;
      try {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        const type = r.headers.get('content-type') || '';
        if (r.ok && !type.includes('text/html'))
          await cache.put(u, r);
      } catch {
        // Offline or missing: it is cached when the page loads it.
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k !== CACHE && k.startsWith('sa-web-'))
        await caches.delete(k);
    await self.clients.claim();
  })());
});

function isolate(response) {
  if (!response || response.status === 0 || response.status === 206)
    return response;
  const h = new Headers(response.headers);
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin')
    return;
  const url = new URL(req.url);
  // Only this site's own files are handled here (and cached). A range read is the browser's own business.
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) {
    if (url.origin !== self.location.origin || req.method !== 'GET')
      return;
    event.respondWith(fetch(req).then(isolate));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      // A host that answers a missing file with its home page (single-page-app mode) must not poison the cache.
      const type = fresh.headers.get('content-type') || '';
      const isPage = req.mode === 'navigate' || /\.html?$/.test(url.pathname) || url.pathname.endsWith('/');
      if (fresh.ok && (isPage || !type.includes('text/html')))
        cache.put(req, fresh.clone()).catch(() => {});
      return isolate(fresh);
    } catch {
      const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? (await cache.match('index.html')) || (await cache.match('./')) : null);
      if (hit)
        return isolate(hit);
      return new Response('Offline, and this file was never saved. Open SA Web once while online.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
