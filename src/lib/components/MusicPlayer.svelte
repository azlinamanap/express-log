<script>
	import { onMount } from 'svelte';
	import { soundOn } from '$lib/stores.js';
	import { initMusic, toggleMusic } from '$lib/music.js';

	// Floating music toggle; the audio itself lives in $lib/music.js.
	let on = $derived($soundOn);

	onMount(initMusic);
</script>

<button
	type="button"
	class="music-toggle"
	class:on
	onclick={toggleMusic}
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
	/* phones: smaller and tucked into the corner, clear of the homepage
	   masthead, which starts 36px down at this width (profiles render at a
	   fixed 1200px viewport, so this only reaches the homepage) */
	@media (max-width: 640px) {
		.music-toggle {
			top: 6px;
			right: 8px;
			width: 30px;
			height: 30px;
		}
		.music-toggle svg {
			width: 16px;
			height: 16px;
		}
	}
</style>
