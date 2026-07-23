<script>
	import { page } from '$app/state';
	import { showcase } from '$lib/stores.js';
	import Hero from '$lib/components/Hero.svelte';

	// landing screen: no showcase
	$effect(() => {
		showcase.set(false);
	});

	// a failed profile load redirects here with the error and attempted UID in
	// navigation state, so the landing form can explain what went wrong and keep
	// the UID ready to retry. Plain visits to / carry no such state.
	let error = $derived(page.state.searchError ?? null);
	let value = $derived(page.state.searchUid ?? '');
</script>

<Hero {error} {value} />
