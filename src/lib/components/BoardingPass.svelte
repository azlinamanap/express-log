<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SiteFooter from './SiteFooter.svelte';

	// Homepage: a UID lookup styled as an Astral Express boarding pass. Type a
	// UID onto the ticket and tear off the red stub ("BOARD") to open that
	// player's profile. `error`/`value` carry a failed profile load back here.
	let { heading, error: loadError = null, value = '' } = $props();

	const EXAMPLE_UID = '800579959';
	const RECENT_KEY = 'expresslog-recent';
	const RECENT_MAX = 4;
	// server by the UID's first digit
	const REGIONS = {
		1: 'China',
		2: 'China',
		5: 'China (Bilibili)',
		6: 'America',
		7: 'Europe',
		8: 'Asia',
		9: 'TW, HK, MO'
	};
	const regionOf = (u) => REGIONS[u[0]] ?? null;
	const clean = (v) => String(v).replace(/\D/g, '').slice(0, 9);

	let uid = $state('');
	let error = $state('');
	let opening = $state('');
	let recent = $state([]);
	let howOpen = $state(false);
	let today = $state('');

	let boarding = $derived(!error && !!opening && opening === uid);

	$effect(() => {
		uid = clean(value);
		error = loadError ?? '';
		opening = '';
	});

	onMount(() => {
		// client-only so the date is the visitor's, not the server's
		today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
		try {
			const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
			if (Array.isArray(r)) recent = r.filter((u) => /^\d{9}$/.test(u)).slice(0, RECENT_MAX);
		} catch {}
	});

	function saveRecent(list) {
		recent = list;
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(list));
		} catch {}
	}

	function board(u) {
		saveRecent([u, ...recent.filter((r) => r !== u)].slice(0, RECENT_MAX));
		uid = u;
		error = '';
		opening = u;
		goto(`/${u}`);
	}

	function oninput(e) {
		uid = clean(e.currentTarget.value);
		// stripped characters leave state unchanged, so write the DOM back too
		e.currentTarget.value = uid;
		error = '';
		opening = '';
	}

	function submit(e) {
		e.preventDefault();
		const n = uid.length;
		if (n !== 9) {
			error = n ? `That’s ${n} digit${n === 1 ? '' : 's'} — a UID has nine.` : 'The passenger UID is still blank.';
		} else if (!regionOf(uid)) {
			error = `No line departs from “${uid[0]}”. Check the first digit.`;
		} else {
			board(uid);
		}
	}
</script>

<div class="home">
	<header class="masthead">
		<div class="lockup">
			<span class="brand">THE EXPRESS LOG</span>
			<span class="tagline">✦ a Trailblazer showcase ✦</span>
		</div>
	</header>

	<!-- the ticket + hint line sit centred between two equal spacers; the
	     "how to" note and previous entries live in an overlay in the lower
	     spacer, so they never push the ticket or the footer around -->
	<main>
		<div class="spacer" aria-hidden="true"></div>
		<div class="center">
			<form class="ticket" onsubmit={submit} novalidate>
				<div class="body notched">
					<div class="rule notched" aria-hidden="true"></div>
					<div class="fill notched" aria-hidden="true">
						<span class="orbit orbit-lg"></span>
						<span class="orbit orbit-md"></span>
						<span class="mauve"></span>
						<span class="rays"></span>
						<span class="sun-arc"></span>
						<span class="sun"></span>
						<span class="node"></span>
						<span class="moon"></span>
					</div>

					<div class="content notched">
						<div class="emblem" role="img" aria-label="Astral Express emblem">
							<div class="train"></div>
						</div>
						<div class="fields">
							<span class="mono kicker">ASTRAL EXPRESS ▸</span>
							<h1>{heading}</h1>
							<div class="uid-field">
								<label class="mono label" for="uid">PASSENGER UID</label>
								<input
									id="uid"
									class="uid-input"
									class:invalid={!!error}
									inputmode="numeric"
									autocomplete="off"
									spellcheck="false"
									placeholder="000000000"
									aria-invalid={!!error}
									aria-describedby="uid-status"
									value={uid}
									{oninput}
								/>
								<div id="uid-status" class="status" aria-live="polite">
									{#if error}
										<span class="err">{error}</span>
									{:else if boarding}
										<span>Now boarding — opening {opening}’s log…</span>
									{/if}
								</div>
							</div>
							<div class="meta">
								<div class="meta-item">
									<span class="mono label">SERVER</span>
									<span class="meta-val server">
										<span>{(uid && regionOf(uid)) || '—'}</span>
										<!-- reserve the widest value so DATE never shifts -->
										<span class="reserve" aria-hidden="true">China (Bilibili)</span>
									</span>
								</div>
								<div class="meta-item">
									<span class="mono label">DATE</span>
									<span class="meta-val">{today || ' '}</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<button type="submit" class="stub notched" aria-label="Board">
					<span class="rule notched" aria-hidden="true"></span>
					<span class="fill notched" aria-hidden="true"></span>
					<span class="hairline left" aria-hidden="true"></span>
					<span class="hairline right" aria-hidden="true"></span>
					<span class="flower" aria-hidden="true">
						<span class="petal tl"></span>
						<span class="petal tr"></span>
						<span class="petal bl"></span>
						<span class="petal br"></span>
					</span>
					<span class="stub-label">
						<span class="board">{boarding ? 'BOARDING' : 'BOARD'}</span>
						<span class="arrow">→</span>
					</span>
				</button>

				<div class="perf" aria-hidden="true">
					{#each { length: 8 } as _}<span></span>{/each}
				</div>
			</form>

			<p class="hint">
				<span class="hint-lead">
					No UID handy? Try
					<button type="button" class="example" onclick={() => board(EXAMPLE_UID)}>{EXAMPLE_UID}</button>.
					Only characters on the passenger’s in-game showcase are listed.
				</span>
				<button type="button" class="how" aria-expanded={howOpen} onclick={() => (howOpen = !howOpen)}>
					{howOpen ? 'Hide' : 'How to set it'}
				</button>
			</p>
		</div>

		<div class="spacer below-slot">
			<div class="below">
				{#if howOpen}
					<p class="how-text">
						In game, open the Phone menu, tap your avatar and edit the character showcase. Changes
						reach the Log within about five minutes.
					</p>
				{/if}
				{#if recent.length}
					<section class="recent" aria-label="Previous entries">
						<div class="recent-head">
							<span class="mono">PREVIOUS ENTRIES</span>
							<button type="button" class="clear" onclick={() => saveRecent([])}>clear</button>
						</div>
						{#each recent as r (r)}
							<button type="button" class="entry" onclick={() => board(r)}>
								<span class="entry-uid">{r}</span>
								<span class="leader"></span>
								<span class="entry-server">{regionOf(r) ?? '—'}</span>
							</button>
						{/each}
					</section>
				{/if}
			</div>
		</div>
	</main>

	<div class="foot">
		<SiteFooter />
	</div>
</div>

<style>
	.home {
		--bg: var(--space);
		--accent: #e9c47e;
		--accent-hi: #f5dcaa;
		--hint: #9097ad;
		--tk-ink: #2e200e;
		--tk-ink-2: #3b2a14;
		--cream: 255, 250, 225;
		--ticket: linear-gradient(90deg, #d4b689 0%, #ddc297 45%, #e6cea3 100%);
		--stub-red: linear-gradient(180deg, #9e4744, #7b2f34);
		--stub-w: clamp(76px, 15vw, 130px);
		--gutter: clamp(12px, 4vw, 32px);
		--plex: 'IBM Plex Mono', ui-monospace, monospace;

		position: relative;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: #e6e2d6;
		font-family: var(--body);
		font-size: 16px;
		line-height: normal;
	}
	.mono {
		font-family: var(--plex);
		font-size: 11px;
		font-weight: 500;
	}
	button {
		cursor: pointer;
	}

	/* ---------- header, left-aligned to the ticket edge ---------- */
	.masthead {
		position: relative;
		width: 100%;
		max-width: calc(860px + 2 * var(--gutter));
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: clamp(36px, 6vw, 56px) var(--gutter) 0;
		border-bottom: 0;
	}
	/* same box as the profile header's .wordmark, so the view transition
	   between them is a pure slide */
	.lockup {
		display: flex;
		flex-direction: column;
		gap: 10px;
		view-transition-name: masthead;
	}
	/* the site's game-font wordmark, as in the profile header (app.css) */
	.brand {
		font-family: var(--display);
		font-weight: 550;
		font-size: clamp(19px, 5vw, 28px);
		letter-spacing: 0.26em;
		color: var(--accent);
		line-height: 1;
	}
	.tagline {
		font-family: var(--body);
		font-size: 11.5px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--hint);
	}

	main {
		--pad-y: clamp(36px, 7vw, 72px);
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--pad-y) var(--gutter);
	}
	/* equal shares of the leftover height above and below keep .center (and
	   so the ticket) exactly where justify-content:center would put it */
	.spacer {
		flex: 1 1 0;
		width: 100%;
	}
	.center {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 28px;
	}

	/* ---------- ticket ----------
	   Every piece has concave quarter-circle corners: four corner masks of
	   radius --r, centred --o outside the piece. The inner rule and fill sit
	   7px / 8.5px in with matching offsets so the notches stay concentric. */
	.notched {
		--r: 20px;
		--o: 0px;
		--g: #0000 var(--r), #000 calc(var(--r) + 0.5px);
		--notches:
			radial-gradient(circle at calc(-1 * var(--o)) calc(-1 * var(--o)), var(--g)) top left / 51% 51% no-repeat,
			radial-gradient(circle at calc(100% + var(--o)) calc(-1 * var(--o)), var(--g)) top right / 51% 51% no-repeat,
			radial-gradient(circle at calc(-1 * var(--o)) calc(100% + var(--o)), var(--g)) bottom left / 51% 51% no-repeat,
			radial-gradient(circle at calc(100% + var(--o)) calc(100% + var(--o)), var(--g)) bottom right / 51% 51% no-repeat;
		-webkit-mask: var(--notches);
		mask: var(--notches);
	}
	.rule.notched {
		--r: 27px;
		--o: 7px;
		position: absolute;
		inset: 7px;
	}
	.fill.notched {
		--r: 28.5px;
		--o: 8.5px;
		position: absolute;
		inset: 8.5px;
		overflow: hidden;
	}

	/* the ticket keeps the design's EB Garamond (labels and the UID use Plex
	   Mono); everything around it is in the site's body font */
	.ticket {
		position: relative;
		font-family: 'EB Garamond', Georgia, serif;
		width: 100%;
		max-width: 860px;
		display: flex;
		align-items: stretch;
		gap: 5px;
		filter: drop-shadow(0 30px 36px rgba(0, 0, 0, 0.55));
	}

	/* gold body */
	.body {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		background: var(--ticket);
	}
	.body > .rule {
		background: rgba(var(--cream), 0.9);
	}
	.body > .fill {
		background: var(--ticket);
	}

	/* engraving, clipped inside the inner rule */
	.fill span {
		position: absolute;
		border-radius: 999px;
	}
	.orbit-lg {
		right: -300px;
		top: 60px;
		width: 1100px;
		height: 1100px;
		border: 1.5px solid rgba(var(--cream), 0.7);
	}
	.orbit-md {
		right: -160px;
		top: 170px;
		width: 760px;
		height: 760px;
		border: 1.5px solid rgba(var(--cream), 0.6);
	}
	.mauve {
		right: -80px;
		bottom: -170px;
		width: 300px;
		height: 300px;
		background: rgba(150, 110, 130, 0.18);
	}
	.rays {
		right: -70px;
		top: -150px;
		width: 380px;
		height: 380px;
		opacity: 0.5;
		background: repeating-conic-gradient(from 0deg, rgb(var(--cream)) 0deg 0.8deg, transparent 0.8deg 5deg);
		-webkit-mask-image: radial-gradient(circle, transparent 0 22%, #000 23% 62%, transparent 63%);
		mask-image: radial-gradient(circle, transparent 0 22%, #000 23% 62%, transparent 63%);
	}
	.sun-arc {
		right: -52px;
		top: -132px;
		width: 344px;
		height: 344px;
		border: 1.5px solid rgba(var(--cream), 0.6);
	}
	.sun {
		right: 68px;
		top: -12px;
		width: 104px;
		height: 104px;
		background: rgba(var(--cream), 0.7);
		box-shadow:
			0 0 0 6px rgba(var(--cream), 0),
			0 0 0 7.5px rgba(var(--cream), 0.55);
	}
	.node {
		left: calc(100% - 355px);
		top: 59px;
		width: 18px;
		height: 18px;
		background: #ddc297;
		border: 1.5px solid rgba(var(--cream), 0.85);
		box-shadow: inset 8px 0 0 rgba(var(--cream), 0.8);
	}
	.moon {
		right: -40px;
		top: calc(50% - 40px);
		width: 80px;
		height: 80px;
		background: rgba(255, 236, 226, 0.55);
	}

	/* content, clipped to the inner rule */
	.content.notched {
		--r: 28.5px;
		position: relative;
		z-index: 1;
		clip-path: inset(8.5px);
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 38px 28px;
		padding: 28px 52px 28px 40px;
		min-height: 330px;
	}
	.emblem {
		position: relative;
		top: 24px;
		flex: 0 0 auto;
		width: min(340px, 100%);
		aspect-ratio: 1 / 1;
		align-self: center;
		margin: -18px -50px -18px -14px;
	}
	.train {
		position: absolute;
		left: calc(-77.98% - 50px);
		top: -77.98%;
		width: 254.5%;
		height: 254.5%;
		pointer-events: none;
		background: rgba(var(--cream), 0.92);
		-webkit-mask: url(/train-only-clean.png) 0 0 / 100% 100% no-repeat;
		mask: url(/train-only-clean.png) 0 0 / 100% 100% no-repeat;
	}

	.fields {
		position: relative;
		z-index: 1;
		flex: 1.7 1 250px;
		min-width: 0;
		/* lets the heading size itself to this column (cqi below) */
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 14px;
		color: var(--tk-ink-2);
	}
	.kicker {
		letter-spacing: 0.24em;
	}
	.label {
		letter-spacing: 0.2em;
	}
	h1 {
		font-weight: 500;
		font-style: italic;
		/* the longer heading ("Who’s riding the Express?") is ~10em wide, so cap
		   the size at ~1/10 of the column to keep either one on one line */
		font-size: clamp(26px, min(4.2vw, 9.8cqi), 34px);
		line-height: 1.1;
		color: var(--tk-ink);
		text-wrap: balance;
	}
	.uid-field {
		/* extra room under the heading (on top of the column's 14px gap) */
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.uid-input {
		width: 100%;
		background: transparent;
		border: 0;
		border-bottom: 1.5px dashed rgba(46, 32, 14, 0.45);
		border-radius: 0;
		outline: 0;
		padding: 2px 0 8px;
		color: var(--tk-ink);
		font-family: var(--plex);
		font-weight: 500;
		font-size: clamp(24px, 5vw, 34px);
		letter-spacing: 0.16em;
	}
	.uid-input::placeholder {
		color: rgba(59, 42, 20, 0.38);
	}
	.uid-input:focus {
		border-bottom-color: rgba(46, 32, 14, 0.85);
	}
	.uid-input.invalid {
		border-bottom-color: #7a1f18;
	}
	.status {
		min-height: 22px;
		font-style: italic;
		font-size: 16px;
		color: var(--tk-ink);
	}
	.status .err {
		color: #6e1a14;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 10px 64px;
	}
	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.meta-val {
		font-size: 19px;
		color: var(--tk-ink);
	}
	.server {
		display: grid;
	}
	.server > span {
		grid-area: 1 / 1;
	}
	.server .reserve {
		visibility: hidden;
		white-space: nowrap;
	}

	/* red stub = submit */
	.stub {
		position: relative;
		flex: 0 0 var(--stub-w);
		border: 0;
		padding: 0;
		color: #f0d491;
		background: var(--stub-red);
	}
	.stub:hover {
		filter: brightness(1.12);
	}
	.stub > .rule {
		background: rgba(233, 196, 126, 0.7);
	}
	.stub > .fill {
		background: var(--stub-red);
	}
	.hairline {
		position: absolute;
		top: 14%;
		bottom: 22%;
		width: 1.5px;
		background: rgba(233, 196, 126, 0.45);
	}
	.hairline.left {
		left: 28%;
	}
	.hairline.right {
		right: 28%;
	}
	.stub-label {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 14px;
		padding-bottom: 20px;
	}
	.board {
		writing-mode: vertical-rl;
		font-weight: 600;
		font-size: clamp(17px, 2.4vw, 22px);
		letter-spacing: 0.34em;
	}
	.arrow {
		font-size: 20px;
		line-height: 1;
	}

	/* holographic four-pointed flower: four petals sharing one gradient */
	.flower {
		position: absolute;
		left: calc(50% - 13px);
		bottom: 8%;
		width: 26px;
		height: 26px;
	}
	.petal {
		position: absolute;
		width: 14px;
		height: 14px;
		background: linear-gradient(135deg, #b9a6f2 0%, #8fd8f0 38%, #a6f0d8 58%, #e6c4f2 82%, #f6d8e8 100%);
		background-size: 26px 26px;
	}
	.petal.tl {
		left: 0;
		top: 0;
		border-radius: 0 55% 0 55%;
		background-position: 0 0;
	}
	.petal.tr {
		left: 12px;
		top: 0;
		border-radius: 55% 0 55% 0;
		background-position: -12px 0;
	}
	.petal.bl {
		left: 0;
		top: 12px;
		border-radius: 55% 0 55% 0;
		background-position: 0 -12px;
	}
	.petal.br {
		left: 12px;
		top: 12px;
		border-radius: 0 55% 0 55%;
		background-position: -12px -12px;
	}

	/* perforation, centred on the gap between body and stub */
	.perf {
		position: absolute;
		right: calc(var(--stub-w) + 2.5px);
		top: 20px;
		bottom: 20px;
		transform: translateX(50%);
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		pointer-events: none;
		z-index: 3;
	}
	.perf span {
		width: 15px;
		height: 15px;
		border-radius: 999px;
		background: var(--bg);
	}

	/* ---------- below the ticket ---------- */
	.hint {
		max-width: 860px;
		text-align: center;
		font-style: italic;
		font-size: 14px;
		line-height: 1.5;
		color: var(--hint);
	}
	/* keep the lead sentence on one line wherever it fits */
	@media (min-width: 720px) {
		.hint-lead {
			white-space: nowrap;
		}
	}
	.example {
		font-family: var(--plex);
		font-style: normal;
		font-size: 12.5px;
		letter-spacing: 0.08em;
		color: var(--accent);
		border-bottom: 1px solid rgba(233, 196, 126, 0.4);
		padding: 1px 0;
	}
	.example:hover {
		color: var(--accent-hi);
		border-bottom-color: var(--accent-hi);
	}
	/* always on its own line, centred under the lead sentence */
	.how {
		display: block;
		margin: 2px auto 0;
		font-style: italic;
		font-size: 14px;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: rgba(233, 196, 126, 0.4);
	}
	.how:hover {
		color: var(--accent-hi);
	}
	.how-text {
		max-width: 46ch;
		font-size: 14px;
		line-height: 1.55;
		text-align: center;
		color: #cfcabd;
		text-wrap: pretty;
	}

	/* overlay filling the lower spacer plus main's bottom padding: taking no
	   layout space, it scrolls instead of growing the page */
	.below-slot {
		position: relative;
	}
	.below {
		position: absolute;
		top: 0;
		bottom: calc(-1 * var(--pad-y));
		left: 0;
		right: 0;
		/* 640px of content plus a side gutter each way, so the scrollbar runs
		   beside the list instead of over the server names */
		width: min(640px + 2 * 28px, 100%);
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		padding: 10px 28px 28px;
		overflow-y: auto;
		/* classic (space-taking) scrollbars: reserve both sides so the list
		   stays centred under the ticket */
		scrollbar-gutter: stable both-edges;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(233, 196, 126, 0.3) transparent;
		/* soften the cut where rows scroll out under the hint / into the footer */
		-webkit-mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 28px), transparent);
		mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 28px), transparent);
	}
	.below > .recent:first-child {
		margin-top: 18px;
	}
	/* phones: the ticket already makes the page scroll, so just flow */
	@media (max-width: 640px) {
		.below {
			position: static;
			overflow: visible;
			padding-inline: 0;
			padding-bottom: 0;
			-webkit-mask-image: none;
			mask-image: none;
		}
	}

	.recent {
		flex: none;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.recent-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0 2px 6px;
	}
	.recent-head .mono {
		font-weight: 400;
		letter-spacing: 0.22em;
		color: var(--accent);
	}
	.clear {
		font-style: italic;
		font-size: 13px;
		color: var(--hint);
	}
	.clear:hover {
		color: #e6e2d6;
	}
	.entry {
		display: flex;
		align-items: baseline;
		gap: 12px;
		width: 100%;
		padding: 8px 2px;
		color: #e6e2d6;
		text-align: left;
	}
	.entry:hover {
		color: var(--accent-hi);
	}
	.entry-uid {
		font-family: var(--plex);
		font-size: 14px;
		letter-spacing: 0.1em;
	}
	.leader {
		flex: 1;
		border-bottom: 1px dotted rgba(233, 196, 126, 0.3);
		transform: translateY(-4px);
	}
	.entry-server {
		font-style: italic;
		font-size: 14px;
		color: var(--hint);
	}

	/* ---------- footer: the shared site credits line ---------- */
	.foot {
		position: relative;
		width: 100%;
		max-width: calc(860px + 2 * var(--gutter));
		margin: 0 auto;
		padding: 0 var(--gutter) 60px;
		line-height: 1.5;
	}
</style>
