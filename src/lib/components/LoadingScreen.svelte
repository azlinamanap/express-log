<script>
	import { onMount } from 'svelte';
	import { loading } from '$lib/stores.js';

	let video = $state(null);
	let src = $state(null);
	let ready = $state(false);

	// pull the whole clip into memory up front: streamed playback stalls
	// while it competes with the API and image preloads for bandwidth, and
	// some browsers won't buffer a hidden video ahead of time at all
	onMount(() => {
		let url;
		fetch('/pom-pom-window.mp4')
			.then((r) => (r.ok ? r.blob() : Promise.reject()))
			.then((b) => (src = url = URL.createObjectURL(b)))
			.catch(() => (src = '/pom-pom-window.mp4'));
		return () => url && URL.revokeObjectURL(url);
	});

	// the store also carries the bar's pct, which ticks every 45ms; derive the
	// flag on its own so the restart below only re-runs when the screen
	// actually toggles, not on every bar tick (which kept rewinding the clip)
	let active = $derived($loading.active);

	// restart the animation from its first frame each time the screen comes up
	$effect(() => {
		if (!video || !ready || !active) return;
		video.currentTime = 0;
		video.play().catch(() => {});
	});

	// stop decoding once the screen has fully faded out
	function faded(e) {
		if (e.target === e.currentTarget && !active) video?.pause();
	}
</script>

<div
	class="loading-screen"
	class:show={active}
	aria-hidden={!active}
	ontransitionend={faded}
>
	<div class="loading-stage">
		<video
			class="loading-anim"
			class:ready
			{src}
			muted
			loop
			playsinline
			preload="auto"
			bind:this={video}
			oncanplaythrough={() => (ready = true)}
		></video>
		<div class="loading-divider" aria-hidden="true">
			<svg viewBox="0 0 28 19" width="28" height="19">
				<path d="M1 2 A13 11 0 0 0 27 2" />
				<circle cx="14" cy="2.6" r="2.3" />
				<path d="M14 13 V18" />
			</svg>
		</div>
	</div>
	<div class="loading-info">
		<div class="loading-label">{@html $loading.label}</div>
		<div class="loadbar">
			<div class="loadbar-track"><span style="width:{$loading.pct}%"></span></div>
		</div>
	</div>
</div>
