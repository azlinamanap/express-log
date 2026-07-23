<script>
	import SearchForm from './SearchForm.svelte';

	let { error = null, value = '' } = $props();
</script>

<section class="hero">
	<p class="hero-sub">Enter a <b>UID</b> to load a profile.</p>
	<div class="hero-slot">
		<SearchForm {value} />
	</div>
	<div class="notice" class:show={!!error}>{error ?? ''}</div>
	<p class="hero-note">
		Only characters set as “display” on the in-game profile are visible. Data comes from the Mihomo
		API and is cached for 5 minutes.
	</p>
</section>
