import { writable } from 'svelte/store';

/** Whether a profile showcase is on screen — the layout uses it to add
 *  `.has-showcase` (which moves the search form into the header) and to show
 *  the compact header form. */
export const showcase = writable(false);

/** Loading-overlay state, driven by the loader engine (loader.js). */
export const loading = writable({ active: false, pct: 0, label: '' });
