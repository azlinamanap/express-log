import { get } from 'svelte/store';
import { soundOn } from './stores.js';

/* In-game Trailblazer Profile sounds, recorded from the game: one per
   destination tab (the game plays a slightly different sound for each), plus
   the chimes for opening a character and a Battle Records mode. They follow the music toggle: muting
   the site silences these too. */
const SRC = {
	battle: '/sfx/tab-battle.m4a',
	chars: '/sfx/tab-chars.m4a',
	coll: '/sfx/tab-coll.m4a',
	char: '/sfx/char-select.m4a',
	mode: '/sfx/mode-select.m4a'
};
const VOLUME = 0.39;

let clips = null;
function load() {
	clips ??= Object.fromEntries(
		Object.entries(SRC).map(([k, src]) => {
			const a = new Audio(src);
			a.preload = 'auto';
			a.volume = VOLUME;
			return [k, a];
		})
	);
	return clips;
}

function play(key) {
	if (!get(soundOn)) return;
	const a = load()[key];
	if (!a) return;
	a.currentTime = 0;
	a.play().catch(() => {});
}

/** Fetch the clips ahead of the first click so it plays without delay. */
export function preloadSounds() {
	load();
}

export const playTabSound = (view) => play(view);
export const playCharSound = () => play('char');
export const playModeSound = () => play('mode');
