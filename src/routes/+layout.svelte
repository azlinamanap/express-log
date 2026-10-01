<script>
	import '../app.css';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { showcase, loading } from '$lib/stores.js';
	import { coverLoad } from '$lib/loader.js';
	import TraceTip from '$lib/components/TraceTip.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import MusicPlayer from '$lib/components/MusicPlayer.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';

	let { children } = $props();

	// the homepage draws its own full-bleed masthead and reflows down to phone
	// width; profile pages keep the shared chrome and desktop layout
	let home = $derived(page.route.id === '/');

	// The homepage masthead sits at the ticket's edge, the profile header at
	// the 1200px container's, and both stay visible over the loading screen.
	//
	// Homepage → profile: the route swaps under the loading screen, but the
	// profile wordmark is held (translated) exactly where the homepage one was,
	// with the header rule hidden, so nothing moves while loading. Once the
	// profile is ready and the screen starts to fade, it's released and slides
	// into place. A failed or abandoned load just heads home from the held spot.
	let held = $state(null);

	$effect(() => {
		if (held && $showcase && !$loading.active) held = null;
	});

	// Profile → homepage: run the swap as a view transition so the masthead
	// glides between the two spots and the rest cross-fades.
	function slideMasthead(nav) {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	}

	onNavigate(async (nav) => {
		const uid = nav.to?.route.id === '/[uid]' ? nav.to.params?.uid : null;
		if (uid && uid !== nav.from?.params?.uid) {
			const from = nav.from?.route.id === '/' ? document.querySelector('.lockup')?.getBoundingClientRect() : null;
			// heading to a different profile: fade the loading screen in over
			// the current content first, and only swap routes once it covers it
			await coverLoad();
			if (!from) return;
			// runs once the profile header is in the DOM, before it paints
			return () => {
				const to = document.querySelector('header .wordmark')?.getBoundingClientRect();
				if (to) held = { x: from.left - to.left, y: from.top - to.top };
			};
		}
		// drop any hold only once we've left (a held header heading home
		// should leave from where it's shown, not snap back first)
		nav.complete.then(() => (held = null)).catch(() => {});
		// back home from a profile (wordmark, Back, or a failed load)
		if (nav.to?.route.id === '/' && nav.from?.route.id === '/[uid]') return slideMasthead(nav);
	});
</script>

<svelte:head>
	<title>The Express Log · HSR showcase</title>
	<!-- profiles are desktop-only: pin their viewport to the app's fixed width
	     (matches .app max-width) so phones render the full desktop layout
	     scaled-to-fit rather than reflowing to a narrow/stacked one -->
	<meta name="viewport" content={home ? 'width=device-width, initial-scale=1' : 'width=1200'} />
	<!-- EB Garamond + Plex Mono for the homepage ticket -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Mono:wght@400;500&display=swap"
	/>
</svelte:head>

{#if home}
	{@render children()}
{:else}
<div class="app">
	<header class:held={!!held}>
		<button
			type="button"
			class="wordmark"
			style:translate={held ? `${held.x}px ${held.y}px` : null}
			onclick={() => goto('/')}>The Express Log</button
		>
	</header>

	{@render children()}

	<SiteFooter />
</div>
{/if}

<LoadingScreen />
<TraceTip />
<MusicPlayer />
