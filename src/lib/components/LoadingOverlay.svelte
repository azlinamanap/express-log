<script>
	import { loading } from '$lib/stores.js';
</script>

<div class="loading-overlay" class:show={$loading.active} aria-hidden={!$loading.active}>
	<div class="loading-box">
		<div class="loading-label">{@html $loading.label}</div>
		<div class="loadbar">
			<div class="loadbar-track"><span style="width:{$loading.pct}%"></span></div>
			<div class="loadbar-pct">{Math.round($loading.pct)}%</div>
		</div>
	</div>
</div>
