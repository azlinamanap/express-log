<script>
	import { onMount } from 'svelte';

	// Background music. Drop an audio file at static/music.mp3 (served from
	// /music.mp3) to enable it — no file just means the button no-ops.
	//
	// Browsers refuse to start sound before the first user gesture, so when the
	// saved preference is "on" we try to play immediately and, if that's blocked,
	// arm a one-shot listener to begin on the first click/keypress instead. The
	// on/off choice is remembered across visits.
	const SRC = '/music.mp3';
	const VOLUME = 0.32;

	let audio;
	let on = $state(false);

	let armed = false;
	function arm() {
		if (armed) return;
		armed = true;
		window.addEventListener('pointerdown', onGesture);
		window.addEventListener('keydown', onGesture);
	}
	function disarm() {
		armed = false;
		window.removeEventListener('pointerdown', onGesture);
		window.removeEventListener('keydown', onGesture);
	}
	function onGesture() {
		disarm();
		if (on) audio.play().catch(() => {});
	}

	async function enable() {
		on = true;
		localStorage.setItem('music', 'on');
		try {
			await audio.play();
		} catch {
			// autoplay blocked before any interaction — resume on the next gesture
			arm();
		}
	}

	function disable() {
		on = false;
		localStorage.setItem('music', 'off');
		disarm();
		audio.pause();
	}

	function toggle() {
		on ? disable() : enable();
	}

	onMount(() => {
		audio.volume = VOLUME;
		// default to on for first-time visitors; honour an explicit "off"
		if (localStorage.getItem('music') !== 'off') enable();
		return disarm;
	});
</script>

<audio bind:this={audio} src={SRC} loop preload="auto"></audio>

<button
	type="button"
	class="music-toggle"
	class:on
	onclick={toggle}
	aria-pressed={on}
	aria-label={on ? 'Mute background music' : 'Play background music'}
	title={on ? 'Mute music' : 'Play music'}
>
	{#if on}
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
			<path
				d="M16 8.5a4.5 4.5 0 0 1 0 7"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
			<path
				d="M16 9.5l5 5m0-5l-5 5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>

<style>
	.music-toggle {
		position: fixed;
		right: 20px;
		top: 20px;
		z-index: 50;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--panel);
		border: 1px solid var(--line);
		color: var(--muted);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
		transition:
			color 0.18s ease,
			border-color 0.18s ease,
			transform 0.18s ease;
	}
	.music-toggle:hover {
		color: var(--gold-hi);
		border-color: var(--gold);
		transform: translateY(-1px);
	}
	.music-toggle.on {
		color: var(--gold);
	}
	.music-toggle svg {
		width: 22px;
		height: 22px;
	}
</style>
