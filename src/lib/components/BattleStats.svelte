<script>
	import { renderTLDetail } from '$lib/battle.js';

	let { tlKind = null, tlData, tlCycle = '1', hidden = false, oncycle } = $props();

	// cycle already resolved by the parent's pickMode, so freshKind=false
	let d = $derived(tlKind ? renderTLDetail(tlKind, tlData, tlCycle, false) : null);

	function cycleClick(e) {
		const b = e.target.closest('button[data-cycle]');
		if (!b || b.disabled) return;
		oncycle(b.dataset.cycle);
	}
</script>

<article class="activity tl-stats-card" class:show={!!tlKind} class:view-hidden={hidden}>
	<h3>Battle Stats</h3>
	<div class="tl-detail">
		<div class="tl-detail-head">
			<div class="moc-sum">{@html d?.sum ?? ''}</div>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<span class="tl-cycles" role="tablist" aria-label="Cycle" onclick={cycleClick}>
				{@html d?.cycles ?? ''}
			</span>
		</div>
		<div class="boss-strip">{@html d?.bosses ?? ''}</div>
		<div>{@html d?.rows ?? ''}</div>
	</div>
</article>
