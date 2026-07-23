import { ASSETS, traceDescData, ranksIndex, lcRanksIndex } from './meta.js';

/* Ported near-verbatim from the original app.js render logic. These return
   HTML strings that the components inject with {@html}; the surrounding CSS
   targets the exact class structure emitted here, so keeping the markup
   identical guarantees visual parity. All game text is escaped before any
   intentional <b> highlight markup is added (see resolveTemplate). */

export const ELEMENT_AURA = {
	Fire: 'rgba(255, 107, 88, 0.34)',
	Ice: 'rgba(88, 199, 245, 0.32)',
	Lightning: 'rgba(164, 138, 245, 0.34)',
	Wind: 'rgba(94, 214, 165, 0.30)',
	Quantum: 'rgba(125, 141, 245, 0.36)',
	Imaginary: 'rgba(242, 209, 88, 0.28)',
	Physical: 'rgba(200, 204, 214, 0.26)'
};
const STAT_ORDER = ['hp', 'atk', 'def', 'spd', 'crit_rate', 'crit_dmg'];
const CORE_LABELS = {
	basic_atk: 'Basic ATK', skill: 'Skill', ultimate: 'Ultimate', talent: 'Talent',
	technique: 'Technique', memosprite_skill: 'Memo Skill', memosprite_talent: 'Memo Talent'
};

export const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function resolveTemplate(desc, params) {
	if (!desc) return '';
	return escHtml(desc).replace(/#(\d+)\[(i|f\d)\](%?)/g, (full, idxStr, fmt, pct) => {
		const v = params?.[Number(idxStr) - 1];
		if (v == null) return full;
		const n = pct ? v * 100 : v;
		const decimals = fmt === 'i' ? 0 : Number(fmt.slice(1)) || 0;
		return `<b class="tt-num">${n.toFixed(decimals)}${pct}</b>`;
	});
}

function traceDescFor(n) {
	if (!traceDescData) return '';
	const entry = traceDescData.trees[String(n.id)];
	if (!entry) return '';
	if (entry.desc) return resolveTemplate(entry.desc, entry.params?.[0]);
	const linked = (entry.level_up_skills || [])
		.map((s) => traceDescData.skills[String(s.id)])
		.filter((s) => s?.desc);
	return linked
		.map((s) => `<b class="tt-ability">${escHtml(s.name)}:</b> ${resolveTemplate(s.desc, s.params?.[0])}`)
		.join('\n\n');
}

function traceKind(n) {
	const suffix = Number(String(n.id).slice(-3));
	return suffix <= 99 || suffix >= 300 ? 'core' : suffix <= 199 ? 'major' : 'minor';
}

function traceTitle(n, kind) {
	const base = n.icon.slice(n.icon.lastIndexOf('/') + 1).replace('.png', '');
	if (kind === 'major') return 'Bonus Ability ' + base.slice(-1) + ' (A' + base.slice(-1) * 2 + ')';
	return CORE_LABELS[base.replace(/^\d+_/, '')] || 'Ability';
}

function minorTitle(c, n) {
	for (const pool of [c.properties, c.attributes, c.additions]) {
		const hit = (pool || []).find((p) => p.icon === n.icon);
		if (hit) return hit.name.replace(/^Base /, '');
	}
	return 'Trace';
}

function traceNodeHtml(n, kind, title, size, x, y, desc) {
	const lv = n.max_level > 1 ? `<span class="tn-lv">${n.level}</span>` : '';
	const pos = x == null ? '' : `position:absolute; left:${x}px; top:${y}px; width:${size}px; height:${size}px;`;
	const name = `${title}${n.max_level > 1 ? ` · Lv ${n.level}/${n.max_level}` : ''}`;
	return `<div class="tn ${kind}${n.level > 0 ? '' : ' off'}" style="${pos}"
      data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc || '')}">
      <img src="${ASSETS + n.icon}" alt="">${lv}
    </div>`;
}

function layoutTraceBranch(root, childrenOf) {
	let nextCol = 0;
	function place(node, depth) {
		const kids = childrenOf.get(String(node.id)) || [];
		if (!kids.length) return { node, x: nextCol++, y: depth, kids: [] };
		const placedKids = kids.map((k) => place(k, depth + 1));
		const x = (placedKids[0].x + placedKids[placedKids.length - 1].x) / 2;
		return { node, x, y: depth, kids: placedKids };
	}
	return place(root, 0);
}
function flattenTraceBranch(t, out = []) {
	out.push(t);
	t.kids.forEach((k) => flattenTraceBranch(k, out));
	return out;
}

export function renderTraceTree(c) {
	const nodes = (c.skill_trees || []).slice();
	const byId = new Map(nodes.map((n) => [String(n.id), n]));
	const childrenOf = new Map();
	nodes.forEach((n) => {
		if (n.parent && byId.has(String(n.parent))) {
			const arr = childrenOf.get(String(n.parent)) || [];
			arr.push(n);
			childrenOf.set(String(n.parent), arr);
		}
	});

	const skillDescByIcon = new Map();
	for (const s of c.skills || []) {
		if (!s.icon || skillDescByIcon.has(s.icon)) continue;
		const srr = traceDescData?.skills?.[String(s.id)];
		const resolved = srr?.desc
			? resolveTemplate(srr.desc, srr.params?.[Math.min(s.level, srr.params.length) - 1])
			: s.desc ? escHtml(s.desc) : null;
		if (resolved) skillDescByIcon.set(s.icon, resolved);
	}

	const cores = nodes.filter((n) => traceKind(n) === 'core').sort((a, b) => a.anchor.localeCompare(b.anchor));
	const branchRoots = nodes
		.filter((n) => traceKind(n) !== 'core' && (!n.parent || !byId.has(String(n.parent))))
		.sort((a, b) => a.anchor.localeCompare(b.anchor));

	const coreRow = `<div class="trace-row">${cores
		.map((n) => traceNodeHtml(n, 'core', traceTitle(n, 'core'), null, null, null,
			skillDescByIcon.get(n.icon) || traceDescFor(n)))
		.join('')}</div>`;

	if (!branchRoots.length) return coreRow;

	const COL = 37, ROW = 56, MAJOR_SIZE = 42, MINOR_SIZE = 29;
	const CORE_ICON = 46, CORE_PITCH = 66;
	const targetCxFor = (slot) => slot * CORE_PITCH + CORE_ICON / 2;
	const majorSlot = new Map(
		nodes.filter((n) => traceKind(n) === 'major')
			.sort((a, b) => a.anchor.localeCompare(b.anchor))
			.map((m, i) => [String(m.id), i])
	);
	const placeBranch = (root, slot) => {
		const flat = flattenTraceBranch(layoutTraceBranch(root, childrenOf));
		const xs = flat.map((f) => f.x);
		const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
		const anchor = targetCxFor(slot) / COL - 0.5 - mid;
		flat.forEach((f) => { f.x += anchor; });
		return flat;
	};

	let maxRow = 0, maxCol = 0;
	const placed = [];
	let nextPlainSlot = majorSlot.size;
	for (const root of branchRoots) {
		const majorKids = (childrenOf.get(String(root.id)) || []).filter((k) => traceKind(k) === 'major');
		if (traceKind(root) !== 'major' && majorKids.length >= 2) {
			const subFlats = majorKids.map((mk) => placeBranch(mk, majorSlot.get(String(mk.id))));
			subFlats.forEach((flat) => flat.forEach((f) => { f.y += 1; }));
			const rootXs = subFlats.map((flat) => flat[0].x);
			placed.push({
				node: root, y: 0,
				x: (Math.min(...rootXs) + Math.max(...rootXs)) / 2,
				kids: subFlats.map((flat) => flat[0])
			});
			subFlats.forEach((flat) => placed.push(...flat));
		} else {
			const slot = traceKind(root) === 'major' ? majorSlot.get(String(root.id)) : nextPlainSlot++;
			placed.push(...placeBranch(root, slot));
		}
	}
	placed.forEach((f) => {
		maxRow = Math.max(maxRow, f.y);
		maxCol = Math.max(maxCol, f.x);
	});

	const centerOf = (f) => ({
		cx: f.x * COL + COL / 2,
		top: f.y * ROW,
		size: traceKind(f.node) === 'major' ? MAJOR_SIZE : MINOR_SIZE
	});
	const nodesHtml = placed
		.map((f) => {
			const kind = traceKind(f.node);
			const { cx, top, size } = centerOf(f);
			const title = kind === 'major' ? traceTitle(f.node, kind) : minorTitle(c, f.node);
			const desc = kind === 'major' ? traceDescFor(f.node) : undefined;
			return traceNodeHtml(f.node, kind, title, size, cx - size / 2, top, desc);
		})
		.join('');
	const linesHtml = placed
		.flatMap((f) => {
			const p = centerOf(f);
			return f.kids.map((k) => {
				const kc = centerOf(k);
				return `<line x1="${p.cx}" y1="${p.top + p.size}" x2="${kc.cx}" y2="${kc.top}" />`;
			});
		})
		.join('');
	const treeW = Math.max((maxCol + 1) * COL, cores.length * CORE_PITCH);
	const treeH = (maxRow + 1) * ROW;

	return `${coreRow}<div class="trace-tree" style="width:${treeW}px; height:${treeH}px;">
      <svg class="trace-lines" width="${treeW}" height="${treeH}">${linesHtml}</svg>
      ${nodesHtml}
    </div>`;
}

/* Final stats = base attributes + additions, merged by field. */
function mergeStats(c) {
	const map = new Map();
	for (const a of c.attributes) map.set(a.field, { ...a });
	for (const a of c.additions) {
		const cur = map.get(a.field);
		if (cur) cur.value += a.value;
		else map.set(a.field, { ...a });
	}
	const fmt = (s) => ({
		...s,
		name: s.name.replace(/^Base /, ''),
		display: s.percent ? (s.value * 100).toFixed(1) + '%' : String(Math.floor(s.value))
	});
	const ordered = STAT_ORDER.map((f) => map.get(f)).filter(Boolean).map(fmt);
	const rest = [...map.entries()]
		.filter(([f]) => !STAT_ORDER.includes(f))
		.map(([, s]) => fmt(s))
		.filter((s) => s.value > 0.0001);
	return [...ordered, ...rest];
}

export function renderStats(c) {
	return mergeStats(c)
		.map((s) => `<div class="stat"><span class="k">${s.icon ? `<img src="${ASSETS + s.icon}" alt="">` : ''}<span>${s.name}</span></span><span class="v">${s.display}</span></div>`)
		.join('');
}

export function renderEidolons(c) {
	return (c.rank_icons || [])
		.map((icon, i) => {
			const locked = i >= c.rank;
			const info = ranksIndex?.[String(c.id) + String(i + 1).padStart(2, '0')];
			const name = `E${i + 1}${info ? ' · ' + info.name : ''}`;
			const desc = info ? resolveTemplate(info.desc, info.params?.[0]) : '';
			return `<div class="eido${locked ? ' locked' : ''}"
          data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc)}">
        <img src="${ASSETS + icon}" alt="Eidolon ${i + 1}">
      </div>`;
		})
		.join('');
}

export function renderLightCone(lc) {
	if (!lc) return `<div class="none">No light cone equipped</div>`;
	const info = lcRanksIndex?.[String(lc.id)];
	const name = `${lc.name} · S${lc.rank}`;
	const desc = info
		? `<b class="tt-ability">${escHtml(info.skill)}</b>\n${resolveTemplate(info.desc, info.params?.[lc.rank - 1])}`
		: '';
	return `<img class="lc-icon" src="${ASSETS + (lc.preview || lc.icon)}" alt="" loading="lazy"
        data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc)}">
      <div>
        <div class="lc-name">${lc.name}</div>
        <span class="stars${lc.rarity < 5 ? ' r4' : ''}">${'★'.repeat(lc.rarity)}</span>
        <div class="lc-meta">Lv ${lc.level} · S${lc.rank}</div>
      </div>`;
}

export function renderRelics(c) {
	// relic.type: 1 Head, 2 Hands, 3 Body, 4 Feet, 5 Planar Sphere, 6 Link Rope
	const RELIC_SLOT_ORDER = [1, 3, 6, 2, 4, 5];
	return (c.relics || [])
		.slice()
		.sort((a, b) => RELIC_SLOT_ORDER.indexOf(a.type) - RELIC_SLOT_ORDER.indexOf(b.type))
		.map((r) => {
			const subs = (r.sub_affix || [])
				.map((a) => {
					const q = a.count ? a.step / (2 * a.count) : 0;
					const tip = `${a.count} roll${a.count > 1 ? 's' : ''} · ${Math.round(q * 100)}% of max`;
					const extra = a.count - 1;
					return `<span>${a.name}</span><i class="rolls" title="${tip}">${'>'.repeat(extra)}</i><b>+${a.display}</b>`;
				})
				.join('');
			return `<div class="relic" title="${r.name} · ${r.set_name}">
        <div class="top">
          <img src="${ASSETS + r.icon}" alt="">
          <span class="mk">${r.main_affix.name}</span>
          <span class="mv">${r.main_affix.display}</span>
          <span class="lv r${r.rarity}">+${r.level}</span>
        </div>
        <div class="subs">${subs}</div>
      </div>`;
		})
		.join('');
}

/* Collection tiles from space_info. NOTE the field names are cycled by the
   sr_info_parsed upstream (verified against Enka): avatar_count = light cones,
   light_cone_count = music, music_count = characters. */
export function renderCollection(p) {
	const s = p.space_info || {};
	const sign = (n) => `${ASSETS}icon/sign/${n}.png`;
	const tall = [
		['Characters', s.music_count, 'AvatarIcon'],
		['Light Cones', s.avatar_count, 'ShopLightConIcon'],
		['Achievements', s.achievement_count, 'AchievementIcon']
	];
	const wide = [
		['Phonograph', s.light_cone_count, 'JukeboxIcon'],
		['Bookshelf', s.book_count, 'BookIcon']
	];
	const tallCards = tall.filter(([, v]) => v != null);
	const wideCards = wide.filter(([, v]) => v != null);
	return (
		(tallCards.length
			? `<div class="col-tall">${tallCards
					.map(([k, v, ic]) => `<div class="col-card tall"><img src="${sign(ic)}" alt=""><div class="cname">${k}</div><div class="cnum">${v}</div></div>`)
					.join('')}</div>`
			: '') +
		(wideCards.length
			? `<div class="col-wide">${wideCards
					.map(([k, v, ic]) => `<div class="col-card wide"><img src="${sign(ic)}" alt=""><span><span class="cname">${k}</span><div class="cnum">${v}</div></span></div>`)
					.join('')}</div>`
			: '')
	);
}

/* Roster cards. Fixed in-game slot counts (3 support, 5 display) padded with
   blanks so the grid keeps a consistent size. */
const MAX_SUPPORT = 3;
const MAX_DISPLAY = 5;

function rosterCard([c, i]) {
	return `<button class="char-card${c.rarity < 5 ? ' r4' : ''}" role="tab"
      aria-pressed="false" data-i="${i}" title="${c.name}">
      <span class="cc-eid"><i class="eid-glyph"></i><b class="eid-num">${c.rank}</b></span>
      <img class="cc-art" src="${ASSETS + c.preview}" alt="" loading="lazy">
      <span class="cc-name">${c.name}</span>
      <span class="cc-lv">Lv. ${c.level}</span>
    </button>`;
}

export function renderRoster(chars, assistIds, displayIds) {
	// The parsed character list dedupes a character that occupies both an assist
	// and a display slot, so we split by explicit membership: a shared character
	// lands in both rosters. Order each roster by its raw id list (assistAvatarList
	// / avatarDetailList are Sets that preserve the in-game slot order) rather than
	// the parsed character order, which floats assist characters to the front and
	// so scrambles the display roster. When the raw display list is unavailable
	// (best-effort fetch failed), fall back to treating every non-assist character
	// as display, in parsed order.
	const byId = new Map(chars.map((c, i) => [String(c.id), [c, i]]));
	const hasDisplayInfo = displayIds && displayIds.size > 0;
	const support = [...assistIds].map((id) => byId.get(id)).filter(Boolean);
	const display = [];
	if (hasDisplayInfo) {
		// displayIds order first, then any character in neither roster (parsed order).
		for (const id of displayIds) if (byId.has(id)) display.push(byId.get(id));
		chars.forEach((c, i) => {
			const id = String(c.id);
			if (!assistIds.has(id) && !displayIds.has(id)) display.push([c, i]);
		});
	} else {
		chars.forEach((c, i) => {
			if (!assistIds.has(String(c.id))) display.push([c, i]);
		});
	}
	const blank = `<div class="char-card blank" aria-hidden="true"><span class="cc-art"></span></div>`;
	const padded = (list, max) => list.map(rosterCard).join('') + blank.repeat(Math.max(0, max - list.length));
	return {
		hasSupport: support.length > 0,
		supportHtml: padded(support, MAX_SUPPORT),
		displayHtml: padded(display, MAX_DISPLAY)
	};
}

/* Walk character data for every .png path so the browser can warm its cache
   before the detail cards are opened. */
function collectImageUrls(node, out) {
	if (Array.isArray(node)) node.forEach((n) => collectImageUrls(n, out));
	else if (node && typeof node === 'object') Object.values(node).forEach((v) => collectImageUrls(v, out));
	else if (typeof node === 'string' && /\.png$/i.test(node))
		out.add(/^https?:/.test(node) ? node : ASSETS + node);
}

export function characterImageUrls(chars) {
	const urls = new Set();
	collectImageUrls(chars, urls);
	return [...urls];
}
