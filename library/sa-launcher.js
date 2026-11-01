// SPDX-License-Identifier: GPL-3.0+
//
// SA Web launcher: the home screen of the page. It replaces the PS2 console and tray of the old
// disc library with one thing, the disc. Two steps (the BIOS from your own PS2, the disc image of
// your own copy of GTA San Andreas), then Play.
//
// It keeps the contract player-library.js relies on: createDiscLibrary(root, { host, onBooted })
// returns { shown, reset, rise, pad, busy }. `host` is window.PCSX2WebLibrary (app.js):
//   blocked(), insert(file, handle), status(), bios(), chooseBios(), takeBios(file).

import {
	readFolder, filesFromDrop, filesFromDirectory, canPickFolder, pickFolder, discMeta,
} from './folder.js';

const DISC_EXT = ['.iso', '.bin', '.img', '.chd', '.cso', '.zso', '.gz'];

// Serials of the PS2 releases of GTA San Andreas that are certain. Any other copy is recognised by
// the game's title in PCSX2's database or by its file name (see isSanAndreas).
const SA_SERIALS = new Set(['SLUS-20552', 'SLES-52712']);
const SA_NAME = /san[\s._-]*andreas|\bgta[\s._-]*sa\b/i;

export const isSanAndreas = (d) =>
	!!d && (SA_SERIALS.has(d.serial) || SA_NAME.test(d.title || '') || SA_NAME.test(d.fileName || ''));

const COPY = {
	titleSetup: 'Play San Andreas in your browser.',
	titleReady: 'Ready when you are.',
	titleStarting: 'Starting up.',
	lead: 'Add the BIOS from your own PS2 and a disc image of your own copy of the game. Both stay on this device.',
	biosTitle: 'PS2 BIOS',
	biosEmpty: 'The .bin file dumped from your PS2.',
	biosReading: 'Reading the file…',
	biosChoose: 'Choose BIOS',
	biosChange: 'Change',
	gameTitle: 'San Andreas disc',
	gameEmpty: 'The .iso of your game disc.',
	gameChoose: 'Choose disc image',
	gameChange: 'Change',
	gameFolder: 'Pick a folder instead',
	gameReading: (done, total) => (total ? `Reading ${done} of ${total}…` : 'Reading…'),
	gameNone: 'No PS2 disc image found there. Use an .iso, .bin, .img, .chd, .cso, .zso or .gz file.',
	gameOther: 'This doesn’t look like GTA San Andreas. It may still start.',
	gameOtherFolder: 'No San Andreas disc in that folder. Pick one of the discs it does have.',
	again: (name) => `Use ${name}`,
	play: 'Play San Andreas',
	playBios: 'Add your BIOS first',
	playGame: 'Add your disc image first',
	fine: 'Nothing is uploaded. Your BIOS, disc and saves stay in this browser.',
	starting: {
		queued: 'Loading the emulator. The first visit takes a moment.',
		starting: 'Starting the PS2.',
		running: 'Loading the game.',
	},
};

const MARKUP = `
<div class="sal" data-el="root" data-mode="setup" data-bios="missing" data-game="none">
  <div class="sal-sky" aria-hidden="true"></div>
  <header class="sal-top">
    <div class="sal-brand">
      <img class="sal-mark" src="sa-logo.png" alt="" width="52" height="43" draggable="false">
      <span class="sal-brandname">SA Web</span>
    </div>
    <div class="sal-screen" role="radiogroup" aria-label="Screen size" data-el="screen">
      <button type="button" role="radio" class="sal-seg" data-view="full" aria-checked="true">Fullscreen</button>
      <button type="button" role="radio" class="sal-seg" data-view="small" aria-checked="false">Small</button>
    </div>
  </header>

  <main class="sal-main">
    <section class="sal-stage" aria-hidden="true">
      <div class="sal-halo"></div>
      <div class="sal-disc" data-el="disc">
        <svg viewBox="0 0 400 400" focusable="false">
          <defs>
            <radialGradient id="sal-g-body" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="#2b2b2d"/><stop offset="0.28" stop-color="#171718"/>
              <stop offset="0.62" stop-color="#242426"/><stop offset="1" stop-color="#101011"/>
            </radialGradient>
            <clipPath id="sal-clip-label"><circle cx="200" cy="200" r="118"/></clipPath>
          </defs>
          <circle cx="200" cy="200" r="196" fill="url(#sal-g-body)" stroke="#3b3b3d" stroke-width="2"/>
          <g class="sal-sheen">
            <path d="M200 200 L200 6 A194 194 0 0 1 292 28 Z" fill="#fff" opacity=".035"/>
            <path d="M200 200 L200 394 A194 194 0 0 1 108 372 Z" fill="#fff" opacity=".035"/>
          </g>
          <circle cx="200" cy="200" r="168" fill="none" stroke="#ffffff" stroke-opacity=".06"/>
          <circle cx="200" cy="200" r="144" fill="none" stroke="#ffffff" stroke-opacity=".05"/>
          <circle class="sal-ring" cx="200" cy="200" r="132" fill="none" stroke="var(--sa-orange, #ff8a1f)" stroke-width="3" stroke-dasharray="310 520" stroke-linecap="round"/>
          <circle cx="200" cy="200" r="118" fill="#0b0b0c"/>
          <g clip-path="url(#sal-clip-label)">
            <rect x="82" y="82" width="236" height="236" fill="#0b0b0c"/>
            <image href="sa-logo.png" x="128" y="92" width="144" height="120" preserveAspectRatio="xMidYMid meet"/>
            <text x="200" y="262" text-anchor="middle" fill="#ffffff" fill-opacity=".55" font-family="Archivo, sans-serif" font-weight="800" font-size="15" letter-spacing="3">SA WEB</text>
          </g>
          <circle cx="200" cy="200" r="118" fill="none" stroke="#ffffff" stroke-opacity=".18"/>
          <circle cx="200" cy="228" r="0" fill="none"/>
          <circle cx="200" cy="200" r="13" fill="#050505" stroke="#4a4a4d" stroke-width="2"/>
          <circle cx="200" cy="200" r="46" fill="none" stroke="#ffffff" stroke-opacity=".12"/>
        </svg>
      </div>
    </section>

    <section class="sal-panel">
      <h1 class="sal-title" data-el="title" tabindex="-1">${COPY.titleSetup}</h1>
      <p class="sal-lead" data-el="lead">${COPY.lead}</p>

      <ol class="sal-steps">
        <li class="sal-step" data-step="bios" data-state="todo">
          <span class="sal-badge" aria-hidden="true"></span>
          <div class="sal-step-text">
            <h2>${COPY.biosTitle}</h2>
            <p data-el="biosText">${COPY.biosEmpty}</p>
          </div>
          <button type="button" class="sal-btn" data-el="biosBtn">${COPY.biosChoose}</button>
        </li>
        <li class="sal-step" data-step="game" data-state="todo">
          <span class="sal-badge" aria-hidden="true"></span>
          <div class="sal-step-text">
            <h2>${COPY.gameTitle}</h2>
            <p data-el="gameText">${COPY.gameEmpty}</p>
            <p class="sal-warn" data-el="gameWarn" hidden></p>
            <div class="sal-pick" data-el="pick" role="group" aria-label="Discs found" hidden></div>
          </div>
          <div class="sal-step-actions">
            <button type="button" class="sal-btn" data-el="gameBtn">${COPY.gameChoose}</button>
            <button type="button" class="sal-link" data-el="folderBtn">${COPY.gameFolder}</button>
          </div>
        </li>
      </ol>

      <div class="sal-actions">
        <button type="button" class="sal-play" data-el="play" disabled>
          <span class="sal-play-label" data-el="playLabel">${COPY.playBios}</span>
        </button>
      </div>
      <p class="sal-note" data-el="note" role="status" aria-live="polite"></p>
      <p class="sal-fine">${COPY.fine}</p>
    </section>
  </main>

  <div class="sal-drop" aria-hidden="true"><span>Drop your BIOS or disc image</span></div>
  <input type="file" data-el="fileInput" accept="${DISC_EXT.join(',')}" hidden>
  <input type="file" data-el="folderInput" webkitdirectory multiple hidden>
  <input type="file" data-el="biosInput" hidden>
</div>`;

// ---- the last disc, remembered on this device (a file handle, Chromium only)

const DB = 'sa-web-launcher';
function kv(mode, fn) {
	return new Promise((resolve, reject) => {
		if (!('indexedDB' in window)) {
			reject(new Error('no IndexedDB'));
			return;
		}
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore('kv');
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			const db = req.result;
			const tx = db.transaction('kv', mode);
			const r = fn(tx.objectStore('kv'));
			tx.oncomplete = () => { db.close(); resolve(r && r.result); };
			tx.onerror = () => { db.close(); reject(tx.error); };
		};
	});
}
const remember = (handle) => kv('readwrite', (s) => s.put(handle, 'disc')).catch(() => {});
const remembered = () => kv('readonly', (s) => s.get('disc')).catch(() => null);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function createDiscLibrary(root, { host = null, onBooted = () => {} } = {}) {
	root.innerHTML = MARKUP;
	const els = {};
	for (const e of root.querySelectorAll('[data-el]'))
		els[e.dataset.el] = e;
	const stepEls = {
		bios: root.querySelector('[data-step="bios"]'),
		game: root.querySelector('[data-step="game"]'),
	};

	let mode = 'setup'; // setup | starting
	let candidates = [];
	let selected = null;
	let rememberedHandle = null;
	let reading = false;
	let poll = 0;
	let startTimer = 0;
	let shownOnce = false;

	const setData = (k, v) => { els.root.dataset[k] = v; };
	const note = (t) => { els.note.textContent = t || ''; };
	const biosOk = () => !host || !host.bios || host.bios().ok;

	// ---- screen size (shared with the page: sa-shell.js)

	function renderScreen() {
		const v = window.SAWeb ? window.SAWeb.view() : 'full';
		for (const b of els.screen.querySelectorAll('.sal-seg'))
			b.setAttribute('aria-checked', b.dataset.view === v ? 'true' : 'false');
	}
	els.screen.addEventListener('click', (e) => {
		const b = e.target.closest('.sal-seg');
		if (!b || !window.SAWeb)
			return;
		window.SAWeb.setView(b.dataset.view);
		renderScreen();
	});
	window.addEventListener('sa-view', renderScreen);

	// ---- BIOS step

	let biosWas = '';
	function renderBios() {
		const b = host && host.bios ? host.bios() : { ok: false, name: '', reading: false, error: '' };
		const key = `${b.ok}|${b.name}|${b.reading}|${b.error}`;
		if (key === biosWas)
			return;
		biosWas = key;
		setData('bios', b.ok ? 'ok' : 'missing');
		const st = stepEls.bios;
		if (b.reading) {
			st.dataset.state = 'busy';
			els.biosText.textContent = COPY.biosReading;
			els.biosBtn.disabled = true;
		} else if (b.ok) {
			st.dataset.state = 'done';
			els.biosText.textContent = b.name || 'BIOS ready.';
			els.biosBtn.textContent = COPY.biosChange;
			els.biosBtn.disabled = false;
		} else {
			st.dataset.state = b.error ? 'error' : 'todo';
			els.biosText.textContent = b.error || COPY.biosEmpty;
			els.biosBtn.textContent = COPY.biosChoose;
			els.biosBtn.disabled = false;
		}
		renderPlay();
	}

	// The BIOS file is picked here (any name: dumps are called .bin, .rom, scph...) and handed to the page.
	function takeBios(file) {
		if (!file || !host)
			return;
		const why = host.biosBlocked ? host.biosBlocked() : '';
		if (why) {
			note(why);
			return;
		}
		note('');
		biosWas = '';
		if (host.takeBiosFile)
			host.takeBiosFile(file);
		else
			host.takeBios(file);
		setTimeout(renderBios, 150);
	}

	els.biosBtn.addEventListener('click', async () => {
		if (!host)
			return;
		const why = host.biosBlocked ? host.biosBlocked() : '';
		if (why) {
			note(why);
			return;
		}
		note('');
		if (typeof window.showOpenFilePicker === 'function') {
			try {
				const [h] = await window.showOpenFilePicker({ id: 'sa-web-bios', multiple: false });
				takeBios(await h.getFile());
			} catch (err) {
				if (!err || err.name !== 'AbortError')
					els.biosInput.click();
			}
			return;
		}
		els.biosInput.click();
	});
	els.biosInput.addEventListener('change', () => {
		const f = els.biosInput.files && els.biosInput.files[0];
		els.biosInput.value = '';
		if (f)
			takeBios(f);
	});

	// ---- game step

	function renderGame() {
		const st = stepEls.game;
		els.pick.hidden = candidates.length < 2;
		els.pick.replaceChildren();
		if (candidates.length > 1) {
			for (const d of candidates) {
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'sal-chip';
				b.setAttribute('aria-pressed', d === selected ? 'true' : 'false');
				b.textContent = d.title;
				b.title = discMeta(d);
				b.addEventListener('click', () => { selected = d; renderGame(); });
				els.pick.append(b);
			}
		}
		if (reading) {
			st.dataset.state = 'busy';
			setData('game', 'busy');
		} else if (selected) {
			st.dataset.state = 'done';
			setData('game', 'ok');
			els.gameText.textContent = `${selected.title} · ${discMeta(selected)}`;
			els.gameBtn.textContent = COPY.gameChange;
			const sa = isSanAndreas(selected);
			els.gameWarn.hidden = sa;
			els.gameWarn.textContent = sa ? '' : (candidates.length > 1 ? COPY.gameOtherFolder : COPY.gameOther);
		} else if (rememberedHandle) {
			st.dataset.state = 'todo';
			setData('game', 'none');
			els.gameText.textContent = COPY.again(rememberedHandle.name);
			els.gameBtn.textContent = COPY.again(rememberedHandle.name).length > 28 ? 'Open it again' : COPY.again(rememberedHandle.name);
			els.gameWarn.hidden = true;
		} else {
			st.dataset.state = 'todo';
			setData('game', 'none');
			els.gameText.textContent = COPY.gameEmpty;
			els.gameBtn.textContent = COPY.gameChoose;
			els.gameWarn.hidden = true;
		}
		els.folderBtn.hidden = !!selected || reading;
		els.gameBtn.disabled = reading;
		els.folderBtn.disabled = reading;
		renderPlay();
	}

	async function adopt(files, handles) {
		reading = true;
		rememberedHandle = null;
		els.gameText.textContent = COPY.gameReading(0, 0);
		renderGame();
		let discs = [];
		try {
			({ discs } = await readFolder(files, (done, total) => {
				els.gameText.textContent = COPY.gameReading(done, total);
			}, handles));
		} catch {
			discs = [];
		}
		reading = false;
		if (!discs.length) {
			candidates = [];
			selected = null;
			note(COPY.gameNone);
			renderGame();
			return false;
		}
		note('');
		const sa = discs.filter(isSanAndreas);
		candidates = sa.length ? sa : discs;
		selected = candidates[0];
		if (selected.handle)
			remember(selected.handle);
		renderGame();
		return true;
	}

	async function chooseFile() {
		if (reading)
			return;
		if (rememberedHandle && !selected) {
			try {
				const perm = await rememberedHandle.requestPermission({ mode: 'read' });
				if (perm === 'granted') {
					const file = await rememberedHandle.getFile();
					await adopt([file], new Map([[file, rememberedHandle]]));
					return;
				}
			} catch {
				// Fall through to the picker.
			}
		}
		if (typeof window.showOpenFilePicker === 'function') {
			try {
				const [h] = await window.showOpenFilePicker({
					id: 'sa-web-disc',
					types: [{ description: 'PS2 disc image', accept: { 'application/octet-stream': DISC_EXT } }],
				});
				const file = await h.getFile();
				await adopt([file], new Map([[file, h]]));
			} catch (err) {
				if (!err || err.name !== 'AbortError')
					note('Couldn’t open that file. Try choosing it again.');
			}
			return;
		}
		els.fileInput.click();
	}

	async function chooseFolder() {
		if (reading)
			return;
		if (canPickFolder()) {
			try {
				const dir = await pickFolder();
				if (!dir)
					return;
				const { files, handles } = await filesFromDirectory(dir);
				await adopt(files, handles);
			} catch {
				note('Couldn’t read that folder. Try choosing it again.');
			}
			return;
		}
		els.folderInput.click();
	}

	els.gameBtn.addEventListener('click', chooseFile);
	els.folderBtn.addEventListener('click', chooseFolder);
	els.fileInput.addEventListener('change', () => {
		const f = els.fileInput.files && els.fileInput.files[0];
		els.fileInput.value = '';
		if (f)
			adopt([f], null);
	});
	els.folderInput.addEventListener('change', () => {
		const list = [...els.folderInput.files];
		els.folderInput.value = '';
		if (list.length)
			adopt(list, null);
	});

	// ---- drop a BIOS or a disc anywhere

	let dragDepth = 0;
	const dragging = (on) => { els.root.dataset.drag = on ? 'on' : ''; };
	els.root.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; dragging(true); });
	els.root.addEventListener('dragover', (e) => e.preventDefault());
	els.root.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragging(false); });
	els.root.addEventListener('drop', async (e) => {
		e.preventDefault();
		dragDepth = 0;
		dragging(false);
		if (mode !== 'setup')
			return;
		const files = await filesFromDrop(e.dataTransfer);
		if (!files.length)
			return;
		const ok = await adopt(files, null);
		if (!ok && files.length === 1) {
			note('');
			takeBios(files[0]); // not a disc: the BIOS
		}
	});

	// ---- Play

	function renderPlay() {
		const ready = !!selected && biosOk() && !reading;
		els.play.disabled = !ready || mode !== 'setup';
		els.playLabel.textContent = ready ? COPY.play : (!biosOk() ? COPY.playBios : COPY.playGame);
		els.title.textContent = mode === 'starting' ? COPY.titleStarting : (ready ? COPY.titleReady : COPY.titleSetup);
		els.lead.hidden = mode === 'starting' || ready;
	}

	function setMode(m) {
		mode = m;
		setData('mode', m);
		renderPlay();
	}

	const FINISHED = new Set(['failed', 'dead', 'unsupported', 'stopped', 'nobios']);

	function play() {
		if (mode !== 'setup' || !selected || !biosOk())
			return;
		if (host) {
			const why = host.blocked();
			if (why) {
				note(why);
				return;
			}
			// Inside the press: fullscreen, the sound and the boot all need the gesture.
			if (window.SAWeb)
				window.SAWeb.enterFullscreen();
			host.insert(selected.file, selected.handle || null, false);
		}
		note('');
		setMode('starting');
		const t0 = performance.now();
		let runningSince = 0;
		clearInterval(poll);
		poll = setInterval(() => {
			if (!host) {
				return;
			}
			const s = host.status();
			if (COPY.starting[s.view])
				note(COPY.starting[s.view]);
			if (s.view === 'running' && !runningSince)
				runningSince = performance.now();
			const minShown = performance.now() - t0 > (reduced.matches ? 0 : 1400);
			const done = s.lit || FINISHED.has(s.view) || !!s.error || (runningSince && performance.now() - runningSince > 25000);
			if (minShown && done) {
				clearInterval(poll);
				poll = 0;
				note('');
				onBooted();
			}
		}, 250);
		if (!host) {
			startTimer = setTimeout(() => { setMode('setup'); note('Preview only: nothing was started.'); }, 2600);
		}
	}
	els.play.addEventListener('click', play);

	// ---- the library's contract with player-library.js

	function tick() {
		renderBios();
		// The emulator failing to load is why nothing else works: say so here, where the person is looking.
		if (host && mode === 'setup' && host.biosBlocked) {
			const v = host.status().view;
			if (v === 'dead' || v === 'unsupported')
				note(host.biosBlocked());
		}
	}

	async function restoreLast() {
		if (selected || reading || rememberedHandle)
			return;
		const h = await remembered();
		if (!h || selected)
			return;
		rememberedHandle = h;
		try {
			const perm = await h.queryPermission({ mode: 'read' });
			if (perm === 'granted') {
				const file = await h.getFile();
				await adopt([file], new Map([[file, h]]));
				return;
			}
		} catch {
			rememberedHandle = null;
		}
		renderGame();
	}

	renderScreen();
	renderBios();
	renderGame();

	return {
		shown() {
			renderScreen();
			biosWas = '';
			tick();
			if (!shownOnce) {
				shownOnce = true;
				restoreLast();
			}
			clearInterval(tick.id);
			tick.id = setInterval(() => {
				if (!root.isConnected || !els.root.offsetParent && !root.closest('dialog[open]')) {
					clearInterval(tick.id);
					return;
				}
				tick();
			}, 300);
			els.title.focus({ preventScroll: true });
		},
		reset() {
			clearInterval(poll);
			clearTimeout(startTimer);
			poll = 0;
			if (mode !== 'setup')
				setMode('setup');
			note('');
			biosWas = '';
			renderGame();
		},
		rise() {},
		// A gamepad plays the launcher: D-pad or left stick moves focus, Cross presses.
		pad(action) {
			if (!action || mode !== 'setup')
				return;
			if (action.confirm) {
				const a = document.activeElement;
				if (a && root.contains(a) && a !== els.title && a.tagName === 'BUTTON' && !a.disabled)
					a.click();
				else if (!els.play.disabled)
					els.play.click();
				return;
			}
			if (action.step) {
				const items = [els.biosBtn, els.gameBtn, els.folderBtn, els.play].filter((b) => b && !b.hidden && !b.disabled);
				const i = items.indexOf(document.activeElement);
				const n = items[(i + (action.step > 0 ? 1 : -1) + items.length) % items.length];
				if (n)
					n.focus();
			}
		},
		get busy() {
			return mode === 'starting';
		},
	};
}
