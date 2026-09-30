<script>
	import '../app.css';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { showcase } from '$lib/stores.js';
	import { coverLoad } from '$lib/loader.js';
	import TraceTip from '$lib/components/TraceTip.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import SearchForm from '$lib/components/SearchForm.svelte';
	import MusicPlayer from '$lib/components/MusicPlayer.svelte';

	let { children } = $props();

	// heading to a different profile: fade the loading screen in over the
	// current page first, and only swap routes once it fully covers it
	onNavigate((nav) => {
		const uid = nav.to?.route.id === '/[uid]' ? nav.to.params?.uid : null;
		if (uid && uid !== nav.from?.params?.uid) return coverLoad(uid);
	});
</script>

<svelte:head>
	<title>The Express Log · HSR showcase</title>
</svelte:head>

<div class="app" class:has-showcase={$showcase}>
	<header>
		<button type="button" class="wordmark" onclick={() => goto('/')}>The Express Log</button>
		{#if $showcase}
			<SearchForm value={page.params.uid ?? ''} />
		{/if}
	</header>

	{@render children()}

	<footer>
		Data: <a href="https://api.mihomo.me" rel="noopener">Mihomo API</a> · Assets:
		<a href="https://github.com/Mar-7th/StarRailRes" rel="noopener">StarRailRes</a> · Music by HOYO-MiX · Not affiliated
		with HoYoverse.
	</footer>
</div>

<LoadingScreen />
<TraceTip />
<MusicPlayer />
