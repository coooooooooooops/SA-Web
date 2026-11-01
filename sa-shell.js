// SPDX-License-Identifier: GPL-3.0+
//
// SA Web shell. Plain script, loaded in <head> before app.js, so the screen size is set before the
// first paint. It owns three preferences (kept in this browser) and the controls they need:
//   view    "full" (fills the window, the default) or "small" (a compact window)
//   aspect  "4:3" or "16:9" (San Andreas has a widescreen option of its own; 16:9 shows it right)
//   panel   the Controls panel: the two controllers, where keys and gamepad buttons are remapped
// The emulator and the page's own logic stay in app.js; this file only reads and sets attributes
// and clicks the page's own buttons.
(function () {
	'use strict';

	const root = document.documentElement;
	const KEY = { view: 'sa-web.view', aspect: 'sa-web.aspect' };

	function read(k, fallback, allowed) {
		try {
			const v = localStorage.getItem(k);
			return allowed.includes(v) ? v : fallback;
		} catch {
			return fallback;
		}
	}

	function write(k, v) {
		try {
			localStorage.setItem(k, v);
		} catch {
			// Private windows: the choice lasts for this visit.
		}
	}

	let pref = read(KEY.view, 'full', ['full', 'small']);
	let aspect = read(KEY.aspect, '4:3', ['4:3', '16:9']);

	const chips = {};
	const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

	function apply() {
		// Fullscreen is always the full layout, whatever the preference.
		root.dataset.view = fsElement() ? 'full' : pref;
		root.dataset.aspect = aspect === '16:9' ? 'wide' : 'normal';
		window.dispatchEvent(new Event('sa-view'));
		refreshChips();
	}

	function enterFullscreen() {
		if (pref !== 'full' || fsElement())
			return;
		const el = root;
		const req = el.requestFullscreen || el.webkitRequestFullscreen;
		if (!req)
			return;
		try {
			const p = req.call(el, { navigationUI: 'hide' });
			if (p && p.catch)
				p.catch(() => {});
		} catch {
			// Refused: the window layout is still full.
		}
	}

	function exitFullscreen() {
		const exit = document.exitFullscreen || document.webkitExitFullscreen;
		if (fsElement() && exit)
			exit.call(document);
	}

	window.SAWeb = Object.freeze({
		view: () => pref,
		aspect: () => aspect,
		setView(v) {
			if (v !== 'full' && v !== 'small')
				return;
			pref = v;
			write(KEY.view, v);
			if (v === 'small')
				exitFullscreen();
			apply();
		},
		setAspect(a) {
			if (a !== '4:3' && a !== '16:9')
				return;
			aspect = a;
			write(KEY.aspect, a);
			apply();
		},
		enterFullscreen,
		exitFullscreen,
		controls(open) {
			const on = open === undefined ? document.body.dataset.panel !== 'controls' : !!open;
			if (on) {
				document.body.dataset.panel = 'controls';
				const a = document.activeElement;
				if (a && a !== document.body)
					a.blur();
				const done = document.getElementById('sa-panel-close');
				if (done)
					done.focus({ preventScroll: true });
			} else {
				delete document.body.dataset.panel;
				const chip = document.getElementById('sa-controls');
				if (chip)
					chip.focus({ preventScroll: true });
			}
			refreshChips();
		},
	});

	apply();
	for (const t of ['fullscreenchange', 'webkitfullscreenchange'])
		document.addEventListener(t, apply);

	// ---- the extra controls on the bar

	function chip(id, label, onClick) {
		const b = document.createElement('button');
		b.type = 'button';
		b.id = id;
		b.className = 'rm-btn sa-chip';
		b.dataset.label = label;
		b.addEventListener('click', onClick);
		chips[id] = b;
		return b;
	}

	function refreshChips() {
		if (chips['sa-controls'])
			chips['sa-controls'].setAttribute('aria-expanded', document.body.dataset.panel === 'controls' ? 'true' : 'false');
		if (chips['sa-size']) {
			chips['sa-size'].dataset.label = pref === 'full' ? 'Small window' : 'Large window';
			chips['sa-size'].setAttribute('aria-label', pref === 'full' ? 'Switch to the small window' : 'Switch to the large window');
		}
		if (chips['sa-shape']) {
			chips['sa-shape'].dataset.label = `Shape ${aspect}`;
			chips['sa-shape'].setAttribute('aria-label', `Picture shape ${aspect}. Press to switch to ${aspect === '4:3' ? '16:9' : '4:3'}.`);
		}
	}

	function build() {
		const remote = document.getElementById('remote');
		if (!remote)
			return;
		remote.append(
			chip('sa-controls', 'Controls', () => window.SAWeb.controls()),
			chip('sa-shape', 'Shape', () => window.SAWeb.setAspect(aspect === '4:3' ? '16:9' : '4:3')),
			chip('sa-size', 'Window', () => window.SAWeb.setView(pref === 'full' ? 'small' : 'full')),
			chip('sa-about', 'About', () => {
				const b = document.getElementById('about-btn');
				if (b)
					b.click();
			}),
		);
		chips['sa-controls'].setAttribute('aria-haspopup', 'dialog');
		chips['sa-controls'].setAttribute('aria-expanded', 'false');
		const done = document.getElementById('sa-panel-close');
		if (done)
			done.addEventListener('click', () => window.SAWeb.controls(false));
		refreshChips();
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', build, { once: true });
	else
		build();


	// ---- offline and isolation: sw.js keeps the page and the emulator in this browser, and adds the isolation
	// headers on hosts that don't send them (one reload, the first time only).
	if ('serviceWorker' in navigator && window.isSecureContext) {
		const needsIsolation = window.crossOriginIsolated === false;
		const KEY = 'sa-web.swReload';
		const reloadOnce = () => {
			try {
				const n = Number(sessionStorage.getItem(KEY) || 0);
				if (n >= 2)
					return;
				sessionStorage.setItem(KEY, String(n + 1));
			} catch {
				return;
			}
			location.reload();
		};
		if (needsIsolation && !navigator.serviceWorker.controller)
			navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('sw.js').catch(() => {});
			navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage('cache-big')).catch(() => {});
		});
	}

	// Esc closes the Controls panel (unless the page used it to cancel a remap).
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && document.body.dataset.panel === 'controls' && !e.defaultPrevented)
			window.SAWeb.controls(false);
	});

	// The Controls panel can be opened from the keyboard: C while the player has focus is left to the
	// emulator (it is a game key), so only the chip and the launcher's gamepad action open it.
})();
