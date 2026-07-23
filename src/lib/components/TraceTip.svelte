<script>
	import { onMount } from 'svelte';

	/* One shared tooltip for every [data-tip-name] node (traces, eidolons,
	   light cone). Delegated on document since those nodes are injected via
	   {@html} and replaced wholesale on each character switch. Ported from
	   app.js's trace-tooltip section. */
	let tip = $state(null);
	let nameEl = $state(null);
	let descEl = $state(null);
	let target = null;
	let hideTimer = null;

	function position(t) {
		const r = t.getBoundingClientRect();
		const box = tip.getBoundingClientRect();
		let left = r.left + r.width / 2 - box.width / 2;
		left = Math.max(8, Math.min(left, window.innerWidth - box.width - 8));
		let top = r.top - box.height - 8;
		if (top < 8) top = r.bottom + 8;
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
	}

	function show(tn) {
		clearTimeout(hideTimer);
		if (tn === target) return;
		target = tn;
		nameEl.textContent = tn.dataset.tipName;
		// safe: every desc reaching here was escaped before any intentional
		// <b> markup was added (see resolveTemplate)
		descEl.innerHTML = tn.dataset.tipDesc;
		tip.classList.add('show');
		position(tn);
	}
	function scheduleHide() {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			target = null;
			tip.classList.remove('show');
		}, 150);
	}
	function wheelScroll(e) {
		const max = descEl.scrollHeight - descEl.clientHeight;
		if (max <= 0) return false;
		e.preventDefault();
		descEl.scrollTop = Math.max(0, Math.min(max, descEl.scrollTop + e.deltaY));
		return true;
	}

	onMount(() => {
		const onOver = (e) => {
			const tn = e.target.closest('[data-tip-name]');
			if (tn) return show(tn);
			if (tip.contains(e.target)) clearTimeout(hideTimer);
		};
		const onOut = (e) => {
			if (!target) return;
			if (e.target.closest('[data-tip-name]') === target || tip.contains(e.target)) scheduleHide();
		};
		const onScroll = (e) => {
			if (e.target !== document && e.target !== window) return;
			if (target) {
				clearTimeout(hideTimer);
				target = null;
				tip.classList.remove('show');
			}
		};
		const onWheel = (e) => {
			if (target && e.target.closest('[data-tip-name]') === target) wheelScroll(e);
		};
		document.addEventListener('mouseover', onOver);
		document.addEventListener('mouseout', onOut);
		window.addEventListener('scroll', onScroll, true);
		document.addEventListener('wheel', onWheel, { passive: false });
		tip.addEventListener('wheel', wheelScroll, { passive: false });
		return () => {
			document.removeEventListener('mouseover', onOver);
			document.removeEventListener('mouseout', onOut);
			window.removeEventListener('scroll', onScroll, true);
			document.removeEventListener('wheel', onWheel, { passive: false });
			tip.removeEventListener('wheel', wheelScroll, { passive: false });
		};
	});
</script>

<div class="trace-tip" bind:this={tip} role="tooltip">
	<div class="tt-name" bind:this={nameEl}></div>
	<div class="tt-desc" bind:this={descEl}></div>
</div>
