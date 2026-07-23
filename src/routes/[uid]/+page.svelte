<script>
	import { showcase } from '$lib/stores.js';
	import { startLoad, bumpLoad, finishLoad, stopLoad, preloadImages } from '$lib/loader.js';
	import { fetchProfile, fetchRaw, fetchActivity, fetchBattle } from '$lib/api.js';
	import { characterImageUrls } from '$lib/render.js';
	import { renderTLOverview, renderCSOverview } from '$lib/battle.js';
	import Hero from '$lib/components/Hero.svelte';
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import Roster from '$lib/components/Roster.svelte';
	import CharacterDetail from '$lib/components/CharacterDetail.svelte';
	import EndgameOverview from '$lib/components/EndgameOverview.svelte';
	import BattleStats from '$lib/components/BattleStats.svelte';
	import Collection from '$lib/components/Collection.svelte';

	let { data } = $props();
	let uid = $derived(data.uid);

	// showcase data
	let profile = $state(null);
	let cosmetics = $state(null);
	let assistIds = $state(new Set());
	let activityInfo = $state(null);
	let tlData = $state({ aa: {}, moc: {}, pf: {}, as: {} });
	let csData = $state({});
	let error = $state(null);

	// view state
	let view = $state('chars');
	let prevView = $state(null);
	let currentChar = $state(null);
	let tlKind = $state(null);
	let tlCycle = $state('1');
	let enterX = $state('0px');

	const VIEW_ORDER = ['battle', 'chars', 'coll'];

	let tlOverview = $derived(renderTLOverview(tlData));
	let csOverview = $derived(renderCSOverview(csData));
	let hasEndgame = $derived(tlOverview.queried.length > 0 || csOverview.has);

	// switching top tabs resets the drilled-in selection in both showcases,
	// with the slide direction set by the tab-order delta
	function setView(v) {
		const dir = prevView && prevView !== v ? VIEW_ORDER.indexOf(v) - VIEW_ORDER.indexOf(prevView) : 0;
		enterX = (dir > 0 ? 28 : dir < 0 ? -28 : 0) + 'px';
		prevView = v;
		view = v;
		currentChar = null;
		tlKind = null;
	}

	// pick a Treasures Lightward mode, resolving the best cycle up front
	function pickMode(k) {
		tlKind = k;
		if (k === 'aa') {
			tlCycle = '1';
			return;
		}
		tlCycle = tlData[k]['1']?.has_data ? '1' : tlData[k]['2']?.has_data ? '2' : tlData[k]['1'] ? '1' : '2';
	}

	let runToken = 0;
	async function run(id) {
		const token = ++runToken;
		// reset
		profile = null;
		cosmetics = null;
		assistIds = new Set();
		activityInfo = null;
		tlData = { aa: {}, moc: {}, pf: {}, as: {} };
		csData = {};
		error = null;
		currentChar = null;
		tlKind = null;
		tlCycle = '1';
		view = 'chars';
		prevView = null;
		showcase.set(false);
		startLoad(id);
		try {
			const p = await fetchProfile(id);
			if (token !== runToken) return;
			bumpLoad(45);
			// raw profile, activity, and battle records load together so the
			// page appears once, fully populated, rather than panel by panel
			const [raw, act, battle] = await Promise.all([
				fetchRaw(id),
				fetchActivity(id),
				fetchBattle(id)
			]);
			if (token !== runToken) return;
			bumpLoad(65);
			profile = p;
			cosmetics = raw.di;
			assistIds = raw.assistIds;
			activityInfo = act;
			tlData = battle.tlData;
			csData = battle.csData;
			bumpLoad(60);
			// warm every character's detail-card art before revealing
			await preloadImages(characterImageUrls(p.characters), 60, 98);
			if (token !== runToken) return;
			showcase.set(true);
			await finishLoad();
		} catch (e) {
			if (token !== runToken) return;
			stopLoad();
			showcase.set(false);
			error = e.message;
		}
	}

	// load on mount and on client-side navigation between profiles
	$effect(() => {
		const id = uid;
		run(id);
	});
</script>

{#if error}
	<Hero {error} value={uid} />
{:else if profile}
	<nav class="view-tabs show" role="tablist" aria-label="Showcase section">
		<button aria-pressed={view === 'battle'} onclick={() => setView('battle')}>
			Battle Records Showcase
		</button>
		<button aria-pressed={view === 'chars'} onclick={() => setView('chars')}>
			Character Showcase
		</button>
		<button aria-pressed={view === 'coll'} onclick={() => setView('coll')}>
			Collection Showcase
		</button>
	</nav>

	<div class="showcase show" id="player">
		<ProfileCard player={profile.player} {cosmetics} {activityInfo} {tlData} />
		<div class="pane" style:--enter-x={enterX}>
			<Roster
				characters={profile.characters}
				{assistIds}
				selected={currentChar}
				hidden={view !== 'chars'}
				onselect={(i) => (currentChar = i)}
			/>
			{#if view === 'battle' && !hasEndgame}
				<div class="notice show">No battle records are available for this profile.</div>
			{/if}
			{#if hasEndgame}
				<EndgameOverview
					tl={tlOverview}
					cs={csOverview}
					{tlKind}
					hidden={view !== 'battle'}
					onpick={pickMode}
				/>
			{/if}
			<Collection player={profile.player} hidden={view !== 'coll'} />
		</div>
	</div>

	<BattleStats {tlKind} {tlData} {tlCycle} hidden={view !== 'battle'} oncycle={(c) => (tlCycle = c)} />

	{#if currentChar != null}
		<CharacterDetail character={profile.characters[currentChar]} hidden={view !== 'chars'} />
	{/if}
{/if}
