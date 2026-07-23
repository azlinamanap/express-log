<script>
	import { ASSETS, metaVersion } from '$lib/meta.js';
	import {
		ELEMENT_AURA,
		renderStats,
		renderTraceTree,
		renderEidolons,
		renderLightCone,
		renderRelics
	} from '$lib/render.js';

	let { character, hidden = false } = $props();
	let c = $derived(character);

	let aura = $derived(ELEMENT_AURA[c.element.name] || ELEMENT_AURA.Quantum);
	let statsHtml = $derived(renderStats(c));
	let relicsHtml = $derived(renderRelics(c));
	// these depend on the background-loaded StarRailRes metadata, so re-run
	// when metaVersion bumps
	let tracesHtml = $derived.by(() => ($metaVersion, renderTraceTree(c)));
	let eidolonsHtml = $derived.by(() => ($metaVersion, renderEidolons(c)));
	let lcHtml = $derived.by(() => ($metaVersion, renderLightCone(c.light_cone)));

	let lcArtEl = $state(null);

	function tilt(ev) {
		const img = ev.target.closest('.lc-icon');
		if (!img || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const r = img.getBoundingClientRect();
		const px = (ev.clientX - r.left) / r.width - 0.5;
		const py = (ev.clientY - r.top) / r.height - 0.5;
		img.style.transform = `perspective(600px) rotateY(${(px * 16).toFixed(2)}deg) rotateX(${(-py * 16).toFixed(2)}deg) scale(1.04)`;
	}
	function untilt() {
		const img = lcArtEl?.querySelector('.lc-icon');
		if (img) img.style.transform = '';
	}
</script>

<article class="detail show" class:view-hidden={hidden}>
	<div class="left-col">
		<div class="stage" style:--aura={aura}>
			<img class="portrait" src={ASSETS + c.portrait} alt={c.name} />
			<div class="badges">
				<img src={ASSETS + c.element.icon} alt={c.element.name} title={c.element.name} />
				<img src={ASSETS + c.path.icon} alt={c.path.name} title={'Path of ' + c.path.name} />
			</div>
			<div class="eido-col">
				<div class="eidolon">E{c.rank}</div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="eidolons">{@html eidolonsHtml}</div>
			</div>
		</div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="lc-art" bind:this={lcArtEl} onmousemove={tilt} onmouseleave={untilt}>
			{@html lcHtml}
		</div>
	</div>
	<div class="sheet">
		<div class="char-head">
			<span class="char-name">{c.name}</span>
			<span class="stars" class:r4={c.rarity < 5}>{'★'.repeat(c.rarity)}</span>
			<span class="char-lv">Lv {c.level} / {20 + c.promotion * 10}</span>
		</div>
		<div class="sheet-cols">
			<div>
				<div class="stats">{@html statsHtml}</div>
			</div>
			<div>
				<div class="traces">{@html tracesHtml}</div>
			</div>
		</div>
		<div class="relics">{@html relicsHtml}</div>
	</div>
</article>
