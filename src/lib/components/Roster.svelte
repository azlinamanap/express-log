<script>
	import { renderRoster } from '$lib/render.js';

	let { characters, assistIds, selected = null, hidden = false, onselect } = $props();

	let supportEl = $state(null);
	let displayEl = $state(null);
	let r = $derived(renderRoster(characters, assistIds));

	function click(e) {
		const b = e.target.closest('[data-i]');
		if (b) onselect(Number(b.dataset.i));
	}

	// reflect the current selection onto the injected cards (runs after the
	// {@html} DOM update since it reads r's html as a dependency)
	$effect(() => {
		r.supportHtml;
		r.displayHtml;
		for (const el of [supportEl, displayEl]) {
			el?.querySelectorAll('[data-i]').forEach((b) =>
				b.setAttribute('aria-pressed', String(Number(b.dataset.i) === selected))
			);
		}
	});
</script>

<section class="roster" class:view-hidden={hidden}>
	<div style:display={r.hasSupport ? '' : 'none'}>
		<h4>✦ Support Characters</h4>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="char-cards big" bind:this={supportEl} onclick={click}>{@html r.supportHtml}</div>
	</div>
	<div>
		<h4>✦ Starfaring Companions</h4>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="char-cards" bind:this={displayEl} onclick={click}>{@html r.displayHtml}</div>
	</div>
</section>
