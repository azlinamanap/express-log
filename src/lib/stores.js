import { writable } from 'svelte/store';

/** Whether a profile showcase is on screen — the layout waits for it before
 *  sliding the profile header from the homepage masthead's spot into place. */
export const showcase = writable(false);

/** Loading-overlay state, driven by the loader engine (loader.js). */
export const loading = writable({ active: false, pct: 0 });

/** Whether site sound is on — set by the music toggle (MusicPlayer), which
 *  also gates the UI sound effects (sfx.js). */
export const soundOn = writable(false);
