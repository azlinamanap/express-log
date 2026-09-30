<script>
	import { renderActivityRows } from '$lib/battle.js';

	// re-renders reactively when either source lands (sr_activity leaves the
	// Treasures Lightward theme names blank; they're patched from tlData)
	// `unavailable` = the Mihomo activity feed couldn't be reached
	let { activityInfo = null, tlData = null, unavailable = false } = $props();

	let rows = $derived(activityInfo ? renderActivityRows(activityInfo, tlData || {}) : '');
</script>

<section class="pc-sec" id="activity" class:show={!!rows || unavailable}>
	<h4>✦ Trailblaze Activity</h4>
	{#if rows}
		<div id="activity-rows">{@html rows}</div>
	{:else}
		<div class="act-note">Recent activity is currently unavailable.</div>
	{/if}
</section>
