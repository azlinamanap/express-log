<script>
	import { ASSETS } from '$lib/meta.js';
	import { placeFrame } from '$lib/frame.js';
	import ActivityPanel from './ActivityPanel.svelte';

	let { player, cosmetics = null, activityInfo = null, tlData = null } = $props();

	let frameEl = $state(null);
	let uidLabel = $state('');

	let p = $derived(player);
	let meta = $derived(
		`Trailblaze Lv ${p.level} · Equilibrium ${p.world_level} · ${p.friend_count} friends`
	);
	let frameId = $derived(cosmetics?.headFrameInfo?.itemId ?? null);
	let cardId = $derived(cosmetics?.personalCardId ?? null);
	let birthday = $derived.by(() => {
		const bd = Number(cosmetics?.birthday) || 0;
		return bd ? `Birthday ${Math.floor(bd / 100)}/${bd % 100}` : '';
	});
	let cardBg = $derived(
		cardId
			? `linear-gradient(rgba(21, 26, 44, 0.45), rgba(21, 26, 44, 0.7)), url(${ASSETS}icon/item/${cardId}.png)`
			: ''
	);

	$effect(() => {
		uidLabel = `UID ${p.uid}`;
	});

	// load + fit the head frame whenever it changes
	$effect(() => {
		if (!frameId || !frameEl) return;
		frameEl.crossOrigin = 'anonymous';
		frameEl.onload = () => placeFrame(frameEl);
		frameEl.src = `${ASSETS}icon/item/${frameId}.png`;
	});

	async function copyUid() {
		try {
			await navigator.clipboard.writeText(String(p.uid));
			uidLabel = 'Copied!';
			setTimeout(() => (uidLabel = `UID ${p.uid}`), 1200);
		} catch {}
	}
</script>

<aside class="pcard">
	<div class="pc-art">
		<div class="pc-art-bg" style:display={cardId ? 'block' : 'none'} style:background-image={cardBg}></div>
		<div class="pc-art-top">
			<div class="avatar-wrap" class:framed={!!frameId}>
				<img class="avatar" src={ASSETS + p.avatar.icon} alt="" />
				<img class="frame" bind:this={frameEl} alt="" title="Avatar frame" />
				<span class="lv-badge">{p.level}</span>
			</div>
			<div class="pc-name">{p.nickname}</div>
		</div>
		<div class="pc-art-bottom">
			<div class="pc-bday">{birthday}</div>
			<button class="pc-uid" title="Copy UID" onclick={copyUid}>{uidLabel}</button>
		</div>
	</div>
	<div class="pc-meta">{meta}</div>
	{#if p.signature}
		<section class="pc-sec">
			<h4>✦ Signature</h4>
			<div class="pc-sig">{p.signature}</div>
		</section>
	{/if}
	<ActivityPanel {activityInfo} {tlData} />
</aside>
