import { jsonResponse } from './http.js';

/** Enka.Network fallback for when the Mihomo API is down. Enka returns the
 *  same game-format detailInfo as Mihomo's raw sr_info, but no parsed layer
 *  (names, icons, final stats). We rebuild the sr_info_parsed shape from it
 *  using the StarRailRes index files, the same dataset Mihomo's icon paths
 *  point into, so the render code can't tell the two sources apart. */
const ENKA = 'https://enka.network/api/hsr/uid/';
const UA = 'TheExpressLog/1.0 (+https://expresslog.vercel.app)';
const INDEX = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/';
const INDEX_FILES = [
	'characters', 'character_promotions', 'character_ranks', 'character_skills',
	'character_skill_trees', 'light_cones', 'light_cone_promotions', 'light_cone_ranks',
	'relics', 'relic_sets', 'relic_main_affixes', 'relic_sub_affixes',
	'properties', 'avatars', 'paths', 'elements'
];
const INDEX_TTL = 6 * 3600 * 1000; // pick up new characters on long-lived instances
const TIMEOUT = 10000;
const ENKA_ERRORS = {
	400: 'Invalid UID format.',
	404: 'No player found with this UID.',
	424: 'The game is under maintenance — try again later.',
	429: 'Too many requests — wait a moment and try again.'
};

let index = null; // { at, promise }
export function loadIndex() {
	if (index && Date.now() - index.at < INDEX_TTL) return index.promise;
	const promise = Promise.all(
		INDEX_FILES.map((f) =>
			fetch(`${INDEX}${f}.json`, { signal: AbortSignal.timeout(TIMEOUT) }).then((r) => {
				if (!r.ok) throw new Error(`${f}.json: HTTP ${r.status}`);
				return r.json();
			})
		)
	).then((all) => Object.fromEntries(INDEX_FILES.map((f, i) => [f, all[i]])));
	index = { at: Date.now(), promise };
	promise.catch(() => (index = null));
	return promise;
}

/* Both /api/{uid} and /api/raw/{uid} fall back together, so share one Enka
   fetch per UID for Enka's advertised ttl (60s). */
const enkaCache = new Map(); // uid -> { until, promise }
function fetchEnka(uid) {
	const now = Date.now();
	const hit = enkaCache.get(uid);
	if (hit && hit.until > now) return hit.promise;
	for (const [k, v] of enkaCache) if (v.until <= now) enkaCache.delete(k);

	const promise = (async () => {
		const r = await fetch(ENKA + uid, {
			headers: { 'User-Agent': UA },
			signal: AbortSignal.timeout(TIMEOUT)
		});
		if (!r.ok) {
			throw Object.assign(new Error(ENKA_ERRORS[r.status] || `Enka API error ${r.status}`), {
				status: r.status
			});
		}
		// signatures can carry raw control characters, as with Mihomo
		return JSON.parse((await r.text()).replace(/[\u0000-\u001f]/g, ' '));
	})();
	enkaCache.set(uid, { until: now + 60000, promise });
	promise.catch(() => enkaCache.delete(uid));
	return promise;
}

/* ---- sr_info_parsed reconstruction ---- */

// the game truncates rather than rounds displayed stats
const trunc1 = (v) => (Math.floor(v * 1000 + 1e-6) / 10).toFixed(1);

function prop(ix, type, value) {
	const p = ix.properties[type] || {};
	return {
		type,
		field: p.field || '',
		name: p.name || type,
		icon: p.icon || '',
		value,
		display: p.percent ? trunc1(value) + '%' : String(Math.floor(value + 1e-6)),
		percent: !!p.percent
	};
}

const fillParams = (desc, params) =>
	(desc || '').replace(/#(\d+)\[(i|f\d)\](%?)/g, (full, i, fmt, pct) => {
		const v = params?.[Number(i) - 1];
		if (v == null) return full;
		return (pct ? v * 100 : v).toFixed(fmt === 'i' ? 0 : Number(fmt.slice(1)) || 0) + pct;
	});

const statAt = (values, promotion, level, key) => {
	const s = values?.[promotion]?.[key];
	return s ? s.base + s.step * (level - 1) : 0;
};

function parseLightCone(ix, eq, charPath) {
	const lc = eq && ix.light_cones[String(eq.tid)];
	if (!lc) return null;
	const level = eq.level ?? 1;
	const promotion = eq.promotion ?? 0;
	const rank = eq.rank ?? 1;
	const values = ix.light_cone_promotions[lc.id]?.values;
	return {
		id: lc.id,
		name: lc.name,
		rarity: lc.rarity,
		rank,
		level,
		promotion,
		icon: lc.icon,
		preview: lc.preview,
		portrait: lc.portrait,
		path: ix.paths[lc.path],
		attributes: [
			prop(ix, 'BaseHP', statAt(values, promotion, level, 'hp')),
			prop(ix, 'BaseAttack', statAt(values, promotion, level, 'atk')),
			prop(ix, 'BaseDefence', statAt(values, promotion, level, 'def'))
		],
		// the passive's flat stat bonus only applies on a matching path
		properties:
			lc.path === charPath
				? (ix.light_cone_ranks[lc.id]?.properties?.[rank - 1] || []).map((p) => prop(ix, p.type, p.value))
				: []
	};
}

function parseRelic(ix, r) {
	const info = ix.relics[String(r.tid)];
	const main = info && ix.relic_main_affixes[info.main_affix_id]?.affixes[r.mainAffixId];
	if (!main) return null;
	const level = r.level ?? 0;
	const subs = ix.relic_sub_affixes[info.sub_affix_id]?.affixes || {};
	return {
		id: info.id,
		name: info.name,
		set_id: info.set_id,
		set_name: ix.relic_sets[info.set_id]?.name ?? '',
		rarity: info.rarity,
		level,
		icon: info.icon,
		type: r.type,
		main_affix: prop(ix, main.property, main.base + main.step * level),
		sub_affix: (r.subAffixList || [])
			.map((s) => {
				const af = subs[s.affixId];
				if (!af) return null;
				const count = s.cnt ?? 1;
				const step = s.step ?? 0;
				return { ...prop(ix, af.property, af.base * count + af.step * step), count, step };
			})
			.filter(Boolean)
	};
}

function relicSetBonuses(ix, relics) {
	const counts = new Map();
	for (const r of relics) counts.set(r.set_id, (counts.get(r.set_id) || 0) + 1);
	const out = [];
	for (const [id, n] of counts) {
		const set = ix.relic_sets[id];
		if (!set) continue;
		[2, 4].forEach((num, i) => {
			if (n < num || !set.desc[i]) return;
			out.push({
				id,
				name: set.name,
				icon: set.icon,
				num,
				desc: set.desc[i],
				properties: (set.properties[i] || []).map((p) => prop(ix, p.type, p.value))
			});
		});
	}
	return out;
}

function parseCharacter(ix, a) {
	const ch = ix.characters[String(a.avatarId)];
	if (!ch) return null; // released after the StarRailRes snapshot
	const level = a.level ?? 1;
	const promotion = a.promotion ?? 0;
	const rank = a.rank ?? 0;

	const treeLv = new Map((a.skillTreeList || []).map((t) => [String(t.pointId), t.level]));
	const trees = ch.skill_trees.map((id) => ix.character_skill_trees[id]).filter(Boolean);
	const skill_trees = trees.map((t) => ({
		id: t.id,
		level: treeLv.get(t.id) ?? 0,
		anchor: t.anchor,
		max_level: t.max_level,
		icon: t.icon,
		parent: t.pre_points[0] ?? null
	}));

	// skill level = its trace level, plus E3/E5-style bonus levels
	const skillLv = new Map();
	for (const t of trees)
		for (const s of t.level_up_skills) skillLv.set(s.id, Math.max(skillLv.get(s.id) || 0, treeLv.get(t.id) ?? 0));
	for (const rid of ch.ranks.slice(0, rank))
		for (const s of ix.character_ranks[rid]?.level_up_skills || [])
			skillLv.set(s.id, (skillLv.get(s.id) || 1) + s.num);
	const skills = ch.skills
		.map((id) => ix.character_skills[id])
		.filter(Boolean)
		.map((s) => {
			const lv = Math.min(s.max_level, Math.max(1, skillLv.get(s.id) || 1));
			return {
				id: s.id,
				name: s.name,
				level: lv,
				max_level: s.max_level,
				element: s.element,
				type: s.type,
				type_text: s.type_text,
				effect: s.effect,
				effect_text: s.effect_text,
				simple_desc: s.simple_desc,
				desc: fillParams(s.desc, s.params?.[Math.min(lv, s.params.length) - 1]),
				icon: s.icon
			};
		});

	const light_cone = parseLightCone(ix, a.equipment, ch.path);
	const relics = (a.relicList || []).map((r) => parseRelic(ix, r)).filter(Boolean);
	const relic_sets = relicSetBonuses(ix, relics);

	// base stats: character + light cone base, like the in-game white numbers
	const cv = ix.character_promotions[ch.id]?.values;
	const lcBase = (field) => light_cone?.attributes.find((x) => x.field === field)?.value ?? 0;
	const attributes = [
		prop(ix, 'BaseHP', statAt(cv, promotion, level, 'hp') + lcBase('hp')),
		prop(ix, 'BaseAttack', statAt(cv, promotion, level, 'atk') + lcBase('atk')),
		prop(ix, 'BaseDefence', statAt(cv, promotion, level, 'def') + lcBase('def')),
		prop(ix, 'BaseSpeed', statAt(cv, promotion, level, 'spd')),
		prop(ix, 'CriticalChanceBase', statAt(cv, promotion, level, 'crit_rate')),
		prop(ix, 'CriticalDamageBase', statAt(cv, promotion, level, 'crit_dmg'))
	];

	// every unconditional bonus: minor traces, relic stats, set bonuses, LC passive
	const bonuses = [
		...trees.flatMap((t) => {
			const lv = treeLv.get(t.id) ?? 0;
			return lv > 0 ? (t.levels[lv - 1]?.properties || []) : [];
		}),
		...relics.flatMap((r) => [r.main_affix, ...r.sub_affix]),
		...relic_sets.flatMap((s) => s.properties),
		...(light_cone?.properties || [])
	];
	const byType = new Map();
	for (const b of bonuses) byType.set(b.type, (byType.get(b.type) || 0) + b.value);
	const properties = [...byType].map(([type, value]) => prop(ix, type, value));

	// additions: bonuses merged per field, % of HP/ATK/DEF/SPD applied to base
	const byField = new Map();
	for (const p of properties) {
		if (!p.field) continue;
		const base = attributes.find((x) => x.field === p.field);
		const value = ix.properties[p.type]?.ratio ? (base?.value ?? 0) * p.value : p.value;
		const cur = byField.get(p.field);
		if (cur) cur.value += value;
		else
			byField.set(p.field, {
				field: p.field,
				name: (base?.name ?? p.name).replace(/^Base /, ''),
				icon: base?.icon ?? p.icon,
				value,
				percent: base ? base.percent : p.percent
			});
	}
	const additions = [...byField.values()].map((x) => ({
		...x,
		display: x.percent ? trunc1(x.value) + '%' : String(Math.floor(x.value + 1e-6))
	}));

	return {
		id: ch.id,
		name: ch.name,
		rarity: ch.rarity,
		rank,
		level,
		promotion,
		icon: ch.icon,
		preview: ch.preview,
		portrait: ch.portrait,
		rank_icons: ch.ranks.map((id) => ix.character_ranks[id]?.icon).filter(Boolean),
		path: ix.paths[ch.path],
		element: ix.elements[ch.element],
		skills,
		skill_trees,
		light_cone,
		relics,
		relic_sets,
		attributes,
		additions,
		properties
	};
}

function parsePlayer(ix, di) {
	const rec = di.recordInfo || {};
	const av = ix.avatars[String(di.headIcon)];
	return {
		uid: String(di.uid),
		nickname: di.nickname ?? '',
		level: di.level ?? 1,
		world_level: di.worldLevel ?? 0,
		friend_count: di.friendCount ?? 0,
		avatar: { id: String(di.headIcon ?? ''), name: av?.name ?? '', icon: av?.icon ?? '' },
		signature: di.signature ?? '',
		is_display: !!di.isDisplayAvatar,
		// Mirrors sr_info_parsed's cycled counters (see renderCollection) so one
		// renderer reads both sources: avatar_count = light cones,
		// light_cone_count = music, music_count = characters.
		space_info: {
			avatar_count: rec.equipmentCount,
			light_cone_count: rec.musicCount,
			music_count: rec.avatarCount,
			achievement_count: rec.achievementCount,
			book_count: rec.bookCount,
			relic_count: rec.relicCount,
			universe_level: rec.maxRogueChallengeScore
		}
	};
}

/* Enka merges both rosters into avatarDetailList, flagging support slots with
   _assist; split them back into the game's two lists, each in slot order. */
function splitRosters(di) {
	const list = di.avatarDetailList || [];
	const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0);
	return {
		assist: list.filter((a) => a._assist).sort(byPos),
		display: list.filter((a) => !a._assist).sort(byPos)
	};
}

function parsedProfile(ix, di) {
	const { assist, display } = splitRosters(di);
	// like sr_info_parsed: support characters first, one entry per character
	const seen = new Set();
	const characters = [...assist, ...display]
		.filter((a) => !seen.has(a.avatarId) && seen.add(a.avatarId))
		.map((a) => parseCharacter(ix, a))
		.filter(Boolean);
	// carry the raw detailInfo too, so the client can skip /api/raw, which
	// would otherwise wait out a second Mihomo timeout before falling back
	return {
		player: parsePlayer(ix, di),
		characters,
		raw: rawProfile(di).detailInfo,
		source: 'enka'
	};
}

function rawProfile(di) {
	const { assist, display } = splitRosters(di);
	return {
		detailInfo: { ...di, assistAvatarList: assist, avatarDetailList: display },
		source: 'enka'
	};
}

/** Mihomo's sr_info_parsed silently drops characters its own data doesn't
 *  know yet (new releases, until Mihomo updates), though its raw sr_info
 *  still lists them in the same game format Enka uses. Rebuild any such
 *  character from its raw entry, keeping sr_info_parsed's order, and carry
 *  the raw detailInfo along so the client can skip /api/raw. The index is
 *  English-only, matching the client's lang=en. Best-effort: any failure
 *  returns `parsedRes` untouched. */
export async function withMissingCharacters(parsedRes, rawRes) {
	if (!parsedRes.ok || !rawRes.ok) return parsedRes;
	try {
		const clean = (text) => JSON.parse(text.replace(/[\u0000-\u001f]/g, ' '));
		const parsed = clean(await parsedRes.clone().text());
		const di = clean(await rawRes.text()).detailInfo;
		const byId = new Map((parsed.characters || []).map((c) => [String(c.id), c]));
		const rawAvatars = [...(di?.assistAvatarList || []), ...(di?.avatarDetailList || [])];
		const missing = rawAvatars.filter((a) => !byId.has(String(a.avatarId)));
		const ix = missing.length ? await loadIndex() : null;
		const seen = new Set();
		const characters = rawAvatars
			.filter((a) => !seen.has(a.avatarId) && seen.add(a.avatarId))
			.map((a) => byId.get(String(a.avatarId)) ?? parseCharacter(ix, a))
			.filter(Boolean);
		// anything Mihomo parsed that the raw lists lack keeps its place at the end
		for (const c of byId.values()) if (!characters.includes(c)) characters.push(c);
		return jsonResponse(200, JSON.stringify({ ...parsed, characters, raw: di }));
	} catch (e) {
		console.error('filling missing characters failed:', e);
		return parsedRes;
	}
}

/** Return `primary` (a Mihomo relay Response) if it succeeded, otherwise
 *  rebuild the payload from Enka. `kind` is 'parsed' or 'raw'. If Enka fails
 *  too, surface its message for UID problems and keep Mihomo's error
 *  otherwise. */
export async function withEnkaFallback(primary, uid, kind) {
	if (primary.ok) return primary;
	try {
		if (kind === 'raw') {
			const { detailInfo } = await fetchEnka(uid);
			return jsonResponse(200, JSON.stringify(rawProfile(detailInfo)));
		}
		const [{ detailInfo }, ix] = await Promise.all([fetchEnka(uid), loadIndex()]);
		return jsonResponse(200, JSON.stringify(parsedProfile(ix, detailInfo)));
	} catch (e) {
		console.error(`enka fallback (${kind}) for ${uid} failed:`, e);
		if (e.status === 400 || e.status === 404) {
			return jsonResponse(e.status, JSON.stringify({ detail: e.message }));
		}
		return primary;
	}
}
