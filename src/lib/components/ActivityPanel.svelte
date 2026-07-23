<script>
	import { renderActivityRows } from '$lib/battle.js';

	// re-renders reactively when either source lands (sr_activity leaves the
	// Treasures Lightward theme names blank; they're patched from tlData)
	let { activityInfo = null, tlData = null } = $props();

	let rows = $derived(activityInfo ? renderActivityRows(activityInfo, tlData || {}) : '');
</script>

<section class="pc-sec" id="activity" class:show={!!rows}>
	<h4>✦ Trailblaze Activity</h4>
	<div id="activity-rows">{@html rows}</div>
</section>
