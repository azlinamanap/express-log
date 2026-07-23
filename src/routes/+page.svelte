<script>
	import { showcase } from '$lib/stores.js';
	import Hero from '$lib/components/Hero.svelte';

	// landing screen: no showcase
	$effect(() => {
		showcase.set(false);
	});
</script>

<Hero />
