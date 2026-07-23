import { writable } from 'svelte/store';

/** StarRailRes asset base + background-loaded game metadata.
 *  These datasets aren't in the Mihomo payload — they carry the templated
 *  skill/trace/eidolon/light-cone text (keyed by id, with "#1[i]"-style
 *  placeholders). They're fetched once in the background; `metaVersion`
 *  bumps whenever one lands so any showcase already on screen re-renders
 *  with the now-available descriptions. ESM live bindings mean importers of
 *  the mutable vars below always see the current value. */
export const ASSETS = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/';

export let traceDescData = null; // { trees, skills }
export let ranksIndex = null; // eidolon names/descriptions by charId+rank
export let lcRanksIndex = null; // light-cone passives by light-cone id

export const metaVersion = writable(0);
const bump = () => metaVersion.update((n) => n + 1);

if (typeof window !== 'undefined') {
	Promise.all([
		fetch(`${ASSETS}index_new/en/character_skill_trees.json`).then((r) => r.json()),
		fetch(`${ASSETS}index_new/en/character_skills.json`).then((r) => r.json())
	])
		.then(([trees, skills]) => {
			traceDescData = { trees, skills };
			bump();
		})
		.catch(() => {});

	fetch(`${ASSETS}index_min/en/character_ranks.json`)
		.then((r) => (r.ok ? r.json() : null))
		.then((j) => {
			ranksIndex = j;
			bump();
		})
		.catch(() => {});

	fetch(`${ASSETS}index_min/en/light_cone_ranks.json`)
		.then((r) => (r.ok ? r.json() : null))
		.then((j) => {
			lcRanksIndex = j;
			bump();
		})
		.catch(() => {});
}
