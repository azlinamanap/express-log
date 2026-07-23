<script>
	// The Treasures Lightward / Cosmic Strife overview (mode selector).
	// tl = { heroHtml, tilesHtml, queried }, cs = { heroesHtml, has }
	let { tl, cs, tlKind = null, hidden = false, onpick } = $props();

	let heroEl = $state(null);
	let tilesEl = $state(null);

	function pick(e) {
		const b = e.target.closest('[data-kind]');
		if (b) onpick(b.dataset.kind);
	}

	// reflect the selected mode onto the injected hero/tile buttons
	$effect(() => {
		tl.heroHtml;
		tl.tilesHtml;
		for (const el of [heroEl, tilesEl]) {
			el?.querySelectorAll('[data-kind]').forEach((b) =>
				b.setAttribute('aria-pressed', String(b.dataset.kind === tlKind))
			);
		}
	});
</script>

<div class="activity" id="endgame" class:show={true} class:view-hidden={hidden}>
	<div id="tl" class:show={tl.queried.length > 0}>
		<h3>Treasures Lightward</h3>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div bind:this={heroEl} onclick={pick}>{@html tl.heroHtml}</div>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="tl-tiles" role="tablist" aria-label="Endgame mode" bind:this={tilesEl} onclick={pick}>
			{@html tl.tilesHtml}
		</div>
	</div>

	<div id="cs" class:show={cs.has}>
		<h3>Cosmic Strife</h3>
		<div class="cs-heroes">{@html cs.heroesHtml}</div>
		<div class="cs-tiles"></div>
	</div>
</div>
