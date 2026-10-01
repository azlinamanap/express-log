import { get } from 'svelte/store';
import { soundOn } from './stores.js';

// Background music behind the floating toggle (MusicPlayer). Served from
// static/music.mp3 — a missing file just means play() rejects and the toggle
// no-ops.
//
// Browsers refuse to start sound before the first user gesture, so when the
// saved preference is "on" we try to play immediately and, if that's blocked,
// arm a one-shot listener to begin on the first click/keypress instead. Music
// is off until the visitor turns it on; the choice is remembered across visits.
const SRC = '/music.mp3';
const VOLUME = 0.39;

let audio = null;
let armed = false;

function arm() {
	if (armed) return;
	armed = true;
	window.addEventListener('pointerdown', onGesture);
	window.addEventListener('keydown', onGesture);
}
function disarm() {
	armed = false;
	window.removeEventListener('pointerdown', onGesture);
	window.removeEventListener('keydown', onGesture);
}
function onGesture() {
	disarm();
	if (get(soundOn)) audio.play().catch(() => {});
}

async function enable() {
	soundOn.set(true);
	localStorage.setItem('music', 'on');
	try {
		await audio.play();
	} catch {
		// autoplay blocked before any interaction — resume on the next gesture
		arm();
	}
}

function disable() {
	soundOn.set(false);
	localStorage.setItem('music', 'off');
	disarm();
	audio.pause();
}

/** Create the audio element once and honour a saved "on" preference. */
export function initMusic() {
	if (audio) return;
	audio = new Audio(SRC);
	audio.loop = true;
	audio.preload = 'auto';
	audio.volume = VOLUME;
	if (localStorage.getItem('music') === 'on') enable();
}

export function toggleMusic() {
	if (!audio) return;
	get(soundOn) ? disable() : enable();
}
