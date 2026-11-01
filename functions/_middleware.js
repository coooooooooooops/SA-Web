// Cloudflare Pages Function: supplies the emulator files, so the site works without them in the repo.
//
// SA Web runs PCSX2 compiled to WebAssembly (the TabStationToo build). Those files are too big and too
// build-specific to keep in this repo, so when a copy is not committed next to index.html, they are
// fetched from TabStationToo's own site and served from here (same origin, which the emulator needs),
// cached at Cloudflare's edge, and then kept offline by the page's service worker.
// To pin a version instead, commit pcsx2-wasm.js, pcsx2-wasm.wasm, pcsx2-wasm.data (and game-titles.tsv)
// to the repo root: a committed file always wins. _routes.json limits this function to those four paths.

const UPSTREAM = 'https://tabstationtoo.github.io/TabStationToo/';
const TYPES = {
  'pcsx2-wasm.js': 'text/javascript; charset=utf-8',
  'pcsx2-wasm.wasm': 'application/wasm',
  'pcsx2-wasm.data': 'application/octet-stream',
  'game-titles.tsv': 'text/tab-separated-values; charset=utf-8',
};

const ISOLATION = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export async function onRequest({ request, env }) {
  const name = new URL(request.url).pathname.replace(/^\//, '');
  if (!(name in TYPES))
    return env.ASSETS.fetch(request);

  // A committed copy (a real file, not the home page a missing file turns into).
  const local = await env.ASSETS.fetch(request);
  const type = local.headers.get('content-type') || '';
  if (local.ok && !type.includes('text/html'))
    return local;

  const up = await fetch(UPSTREAM + name, { cf: { cacheEverything: true, cacheTtl: 86400 } });
  if (!up.ok) {
    if (name === 'game-titles.tsv')
      return new Response('', { status: 404 });
    return new Response(`SA Web could not get ${name} (${up.status}). Reload to try again.`, { status: 502 });
  }
  const headers = new Headers({
    'Content-Type': TYPES[name],
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ...ISOLATION,
  });
  const length = up.headers.get('content-length');
  if (length && !up.headers.get('content-encoding'))
    headers.set('Content-Length', length);
  return new Response(up.body, { status: 200, headers });
}
