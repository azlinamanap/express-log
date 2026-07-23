<script>
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { showcase } from '$lib/stores.js';
	import TraceTip from '$lib/components/TraceTip.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import SearchForm from '$lib/components/SearchForm.svelte';

	let { children } = $props();
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
		<a href="https://github.com/Mar-7th/StarRailRes" rel="noopener">StarRailRes</a> · Not affiliated
		with HoYoverse.
	</footer>
</div>

<LoadingOverlay />
<TraceTip />
