# SA Web

GTA San Andreas (PS2) in your browser. Bring your own PS2 BIOS and your own game disc image.
Nothing is uploaded; the BIOS, disc and saves stay in the browser. Installable as an app, and works offline
after the first visit.

Based on [TabStationToo](https://github.com/TabStationToo/TabStationToo), which runs
[PCSX2](https://github.com/PCSX2/pcsx2) compiled to WebAssembly (GPL-3.0). This repo contains no game, BIOS or disc data.

## Deploy on Cloudflare Pages

Connect the repo, leave the build command empty, set the output directory to `/` (the repo root).
That's all: `functions/_middleware.js` supplies the emulator files (`pcsx2-wasm.js`, `.wasm`, `.data`,
`game-titles.tsv`) from TabStationToo's site, and `_headers` makes the page cross-origin isolated.

To pin a version instead, commit those files to the repo root: a committed file always wins.

## Offline and install

`sw.js` keeps the page and the emulator in the browser. Open the site once online, then it starts offline and
can be installed from the browser's address bar (Install app).
