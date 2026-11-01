# SA Web

GTA San Andreas (PS2) in your browser. Bring your own PS2 BIOS and your own game disc image.
Nothing is uploaded; the BIOS, disc and saves stay in the browser.

Based on [TabStationToo](https://github.com/TabStationToo/TabStationToo), which runs
[PCSX2](https://github.com/PCSX2/pcsx2) compiled to WebAssembly. GPL-3.0, see COPYING.GPLv3 in that repo.
This repo contains no game, BIOS or disc data.

## Deploy on Cloudflare Pages

1. Put these files in the repo root, together with the emulator build: `pcsx2-wasm.js`, `pcsx2-wasm.wasm`,
   `pcsx2-wasm.data` (and any other files the TabStationToo build puts next to its index.html).
2. Cloudflare Pages: connect the repo, build command empty, output directory `/`.
3. `_headers` makes the page cross-origin isolated (needed for the emulator's threads).
   `coi-serviceworker.js` is the fallback if a host can't send headers.

## What changed from TabStationToo

- New launcher: the PS2 console and tray are gone; the disc is the hero. BIOS, disc, Play.
- Opens full window; Fullscreen or Small window; 4:3 or 16:9 picture shape.
- Controls panel (remap keyboard and gamepad buttons) from the bar.
- Recognises San Andreas discs (serials SLUS-20552, SLES-52712, or by title/file name).
- SA theme, logo, Archivo type (SIL OFL).
