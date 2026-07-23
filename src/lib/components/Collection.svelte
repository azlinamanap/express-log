<script>
	import { renderCollection } from '$lib/render.js';

	let { player, hidden = false } = $props();
	let html = $derived(renderCollection(player));
</script>

<section class="collection" class:view-hidden={hidden}>
	<div id="col-cards">{@html html}</div>
</section>
