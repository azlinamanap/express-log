import { ASSETS } from './meta.js';

/* Battle-records rendering (Treasures Lightward + Cosmic Strife), ported
   from app.js. Functions take the fetched data as arguments instead of
   reading module globals. Each returns HTML strings injected with {@html};
   the detail renderers return the four regions of the Battle Stats card. */

const cleanFloorName = (s) => s.replace(/\)(\S)/, ') $1');
function splitStarward(name, tierce) {
	const sw = tierce || /Starward Mode\s*$/.test(name);
	return { name: cleanFloorName(name.replace(/\s*Starward Mode\s*$/, '')), sw };
}

const CS_GLYPHS = { cw: 'GridFightIcon', du: 'DailyQuestRogueTournIcon' };
const MODE_GLYPHS = { moc: 'AbyssIcon01', pf: 'ChallengeStory', as: 'ChallengeBoss' };
const MODE_NAMES = { moc: 'Memory of Chaos', pf: 'Pure Fiction', as: 'Apocalyptic Shadow' };
const ROMAN = { I: 1, V: 5, X: 10 };

function hasAttempt(k, tlData) {
	if (k === 'aa') return !!tlData.aa['1']?.challenge_peak_records?.some((r) => r.has_challenge_record);
	return !!(tlData[k]['1']?.has_data || tlData[k]['2']?.has_data);
}

function floorNumber(name) {
	const m = name.match(/\(([IVX]+)\)/);
	if (m) {
		let n = 0;
		for (let i = 0; i < m[1].length; i++) {
			const v = ROMAN[m[1][i]];
			n += v < (ROMAN[m[1][i + 1]] || 0) ? -v : v;
		}
		return n;
	}
	const d = name.match(/(\d+)\s*$/);
	return d ? Number(d[1]) : '';
}

function csHeroCard(kind, icon, title, rankLabel, rankIcon, rankText) {
	return `<div class="cs-hero-row">
      <div class="chr-icon-clip"><span class="chr-icon ${kind}"><img src="${icon}" alt=""></span></div>
      <div class="chr-main">
        <div class="chr-name">${title}</div>
        <div class="chr-rank">
          <span class="chr-rank-label">${rankLabel}</span>
          <span class="chr-rank-chip"><span class="chr-rank-icon" style="-webkit-mask-image:url('${rankIcon}');mask-image:url('${rankIcon}')"></span>${rankText}</span>
        </div>
      </div>
    </div>`;
}

export function renderCSOverview(csData) {
	const heroes = [];
	const cw = csData.cw?.grid_fight_brief;
	if (cw?.has_played) {
		heroes.push(csHeroCard(
			'cw', cw.division.icon, 'Currency Wars', 'Current Rank',
			`${ASSETS}icon/sign/${CS_GLYPHS.cw}.png`, cw.division.name_with_num
		));
	}
	const du = csData.du?.basic;
	if (du?.normal_record_brief?.common_info_v2?.exist_data || Number(du?.season_level) > 0) {
		const icon = du.normal_record_brief?.icon || `${ASSETS}icon/sign/${CS_GLYPHS.du}.png`;
		heroes.push(csHeroCard(
			'du', icon, 'Divergent Universe', 'Current Rank',
			`${ASSETS}icon/sign/${CS_GLYPHS.du}.png`, du.normal_record_brief?.title || '—'
		));
	}
	return { heroesHtml: heroes.join(''), has: heroes.length > 0 };
}

/* AA hero banner + one medal tile per Treasures Lightward mode — the mode
   selector. Returns which kinds were queried so the component knows what's
   clickable. */
export function renderTLOverview(tlData) {
	const queried = ['aa', 'moc', 'pf', 'as'].filter((k) => tlData[k]['1'] || tlData[k]['2']);
	let heroHtml = '';
	const aa = tlData.aa['1'];
	if (aa) {
		const rec = aa.challenge_peak_records?.find((r) => r.has_challenge_record) || aa.challenge_peak_records?.[0] || {};
		const attempted = hasAttempt('aa', tlData);
		const g = rec.group || {};
		const brief = aa.challenge_peak_best_record_brief || {};
		const pips = [0, 1, 2]
			.map((i) => `<span class="pip${i < (Number(rec.boss_stars) || 0) ? ' lit' : ''}">✦</span>`)
			.join('');
		heroHtml = `<button class="tl-hero-card${attempted ? '' : ' no-data'}" data-kind="aa" role="tab" aria-pressed="false">
        <div class="th-main">
          <div>
            <div class="th-name">${g.name_mi18n || 'Anomaly Arbitration'}</div>
            ${attempted ? `<div class="th-pips">${pips}</div>` : `<div class="th-nodata">No Data</div>`}
          </div>
          ${attempted ? (rec.boss_record?.has_challenge_record
			? `<div class="th-num"><b>${rec.boss_record.round_num ?? 0}</b><span>Cycles</span></div>`
			: `<div class="th-num th-num-none">Not Attempted</div>`) : ''}
        </div>
        <div class="th-go">Go View ▸</div>
        ${(() => {
			const rankIcon = brief.challenge_peak_rank_icon || g.theme_pic_path;
			return rankIcon ? `<div class="th-icon-clip"><span class="th-icon"><img src="${rankIcon}" alt=""></span></div>` : '';
		})()}
      </button>`;
	}

	const tilesHtml = ['moc', 'pf', 'as']
		.filter((k) => tlData[k]['1'] || tlData[k]['2'])
		.map((k) => {
			if (!hasAttempt(k, tlData)) {
				return `<button class="tl-tile no-data" data-kind="${k}" role="tab" aria-pressed="false">
            <span class="tt-name">${MODE_NAMES[k]}</span>
            <span class="tt-medal ${k}"><img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt=""></span>
            <span class="tt-bar tt-nodata">No Data</span>
          </button>`;
			}
			const d = tlData[k]['1'] || tlData[k]['2'];
			const top =
				d.all_floor_detail.find((f) => f.maze_id === d.max_floor_id) ||
				d.all_floor_detail[0] || {};
			const floor = splitStarward(top.name || d.max_floor || '', top.is_tierce);
			return `<button class="tl-tile" data-kind="${k}" role="tab" aria-pressed="false">
          <span class="tt-name">${(d.groups || [])[0]?.name_mi18n || ''}</span>
          <span class="tt-medal ${k}"><img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt=""></span>
          <span class="tt-bar">
            <img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt="">
            ${floorNumber(floor.name)}
            <span class="stars">${'★'.repeat((Number(top.star_num) || 0) - (Number(top.extra_star_num) || 0))}</span>
            ${floor.sw ? '<span class="sw xstar">✦</span>' : ''}
          </span>
        </button>`;
		})
		.join('');

	return { heroHtml, tilesHtml, queried };
}

const EMPTY_DETAIL = { cycles: '', sum: '', bosses: '', rows: '' };

function renderTLEmpty(kind, tlData, tlCycle) {
	const cycles = ['1', '2']
		.map((c) => {
			const g = (tlData[kind][c]?.groups || [])[Number(c) - 1];
			const label = g?.name_mi18n || (c === '1' ? 'Current' : 'Previous');
			return `<button data-cycle="${c}" aria-pressed="${c === tlCycle}"${tlData[kind][c] ? '' : ' disabled'}>${label}</button>`;
		})
		.join('');
	return {
		cycles,
		sum: '',
		bosses: '',
		rows: `<div class="notice show">No data recorded for ${MODE_NAMES[kind]} yet.</div>`
	};
}

function renderAA(data) {
	const records = data.challenge_peak_records || [];
	const rec = records.find((r) => r.has_challenge_record) || records[0] || {};
	const attempted = !!rec.has_challenge_record;
	const g = rec.group || {};
	const brief = data.challenge_peak_best_record_brief || {};
	const cycles = `<button data-cycle="1" aria-pressed="true"${g.status ? ` title="${g.status}"` : ''}>${g.name_mi18n || 'Current'}</button>`;

	const b = g.begin_time, e = g.end_time;
	const rank = (brief.challenge_peak_rank_icon_type || '').replace('ChallengePeakRankIconType', '');
	const sum =
		`<span>Stages <b>★ ${rec.mob_stars ?? 0}</b></span>` +
		`<span>Boss <b>★ ${rec.boss_stars ?? 0}</b></span>` +
		`<span>Attempts <b>${rec.battle_num ?? 0}</b></span>` +
		(b && e ? `<span>Cycle <b>${b.month}/${b.day} – ${e.month}/${e.day}</b></span>` : '') +
		(rank ? `<span>Rank <b class="rank"><img class="aa-rank" src="${brief.challenge_peak_rank_icon}" alt="">${rank}</b></span>` : '');

	const mobs = rec.mob_infos || [];
	const strip = mobs.map((m) => `<div class="boss">
      <img src="${m.monster_icon}" alt="">
      <span><span class="bl">${m.name}</span><span class="bn">${m.monster_name}</span></span>
    </div>`);
	const bi = rec.boss_info;
	if (bi) {
		strip.push(`<div class="boss tierce">
      <img src="${bi.icon}" alt=""${bi.hard_mode_name_mi18n ? ` title="Hard mode: ${bi.hard_mode_name_mi18n}"` : ''}>
      <span><span class="bl">Boss</span><span class="bn">${bi.name_mi18n}</span></span>
    </div>`);
	}
	const bosses = strip.join('');

	const roster = (avs) => (avs || [])
		.map((a) => `<span class="tc-av"><img src="${a.icon}" alt=""><span>Lv ${a.level}</span></span>`)
		.join('');
	const starPips = (n) =>
		Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? '' : 'dim'}">★</span>`).join('');
	const stageCards = mobs
		.map((m) => ({ m, r: (rec.mob_records || []).find((x) => x.maze_id === m.maze_id) }))
		.filter(({ r }) => r?.has_challenge_record && r.avatars?.length)
		.map(({ m, r }) => `<div class="team-card">
      <div class="tc-head">
        <span class="tc-label">${m.name}</span>
        <span class="stars-sm">${starPips(Number(r.star_num) || 0)}</span>
        ${r.challenge_time ? `<span class="tc-meta">${r.challenge_time.month}/${r.challenge_time.day}</span>` : ''}
      </div>
      <div class="tc-roster">${roster(r.avatars)}</div>
    </div>`);
	const br = rec.boss_record;
	if (br?.has_challenge_record && br.avatars?.length) {
		stageCards.push(`<div class="team-card tierce">
      <div class="tc-head">
        <span class="tc-label">✦ Boss</span>
        <span class="stars-sm">${starPips(Number(br.star_num) || 0)}</span>
        ${br.challenge_time ? `<span class="tc-meta">${br.challenge_time.month}/${br.challenge_time.day}</span>` : ''}
      </div>
      <div class="tc-roster">${roster(br.avatars)}</div>
    </div>`);
	}
	const rows = attempted
		? `<div class="team-cards">${stageCards.join('')}</div>`
		: `<div class="notice show">No data recorded for Anomaly Arbitration yet.</div>`;
	return { cycles, sum, bosses, rows };
}

/* Render the Battle Stats detail card for a mode. Returns the four card
   regions plus `cycle` (the resolved cycle, which may differ from the
   requested one when the requested cycle has no data). */
export function renderTLDetail(kind, tlData, tlCycle, freshKind) {
	if (kind === 'aa') return { ...renderAA(tlData.aa['1']), cycle: '1' };

	let cycle = tlCycle;
	if (freshKind || !tlData[kind][cycle]) {
		cycle = tlData[kind]['1']?.has_data ? '1' : tlData[kind]['2']?.has_data ? '2' : tlData[kind]['1'] ? '1' : '2';
	}
	const data = tlData[kind][cycle];
	if (!data?.has_data) return { ...renderTLEmpty(kind, tlData, cycle), cycle };

	const groups = data.groups || [];
	const cycles = ['1', '2']
		.map((c) => {
			const g = groups[Number(c) - 1];
			const label = g?.name_mi18n || (c === '1' ? 'Current' : 'Previous');
			return `<button data-cycle="${c}" aria-pressed="${c === cycle}"${tlData[kind][c] ? '' : ' disabled'}${g?.status ? ` title="${g.status}"` : ''}>${label}</button>`;
		})
		.join('');
	const grp = groups[Number(cycle) - 1] || {};
	const b = grp.begin_time || data.begin_time, e = grp.end_time || data.end_time;
	const sum =
		`<span>Stars <b>★ ${Number(data.star_num)}${Number(data.extra_star_num) ? ' ' + '<span class="xstar">✦</span>'.repeat(Number(data.extra_star_num)) : ''}</b></span>` +
		`<span>Attempts <b>${data.battle_num}</b></span>` +
		(b && e ? `<span>Cycle <b>${b.month}/${b.day} – ${e.month}/${e.day}</b></span>` : '');

	const strip = [];
	for (const [label, boss] of [['Node 1', grp.upper_boss], ['Node 2', grp.lower_boss], ['Starward', grp.tierce_boss]]) {
		if (!boss) continue;
		strip.push(`<div class="boss${label === 'Starward' ? ' tierce' : ''}">
        <img src="${boss.icon}" alt="">
        <span><span class="bl">${label === 'Starward' ? '✦ Starward' : label}</span><span class="bn">${boss.name_mi18n}</span></span>
      </div>`);
	}
	const bosses = strip.join('');

	const topFloor =
		data.all_floor_detail.find((f) => f.maze_id === data.max_floor_id) ||
		data.all_floor_detail[0];
	const rows = [topFloor]
		.filter(Boolean)
		.map((f) => {
			const nodes = ['node_1', 'node_2', 'node_3']
				.map((k, i) => ({ n: f[k], i }))
				.filter(({ n }) => n?.avatars?.length);
			const score = nodes.reduce((s, { n }) => s + (Number(n.score) || 0), 0);
			const clear =
				kind === 'moc'
					? f.is_fast ? 'fast clear' : f.round_num ? f.round_num + ' cycles' : ''
					: score ? 'total score ' + score.toLocaleString() : f.is_fast ? 'fast clear' : '';
			const floor = splitStarward(f.name, f.is_tierce);
			const cards = nodes
				.map(({ n, i }) => {
					const sw = f.is_tierce && i === 2;
					const roster = n.avatars
						.map((a) => `<span class="tc-av"><img src="${a.icon}" alt=""><span>Lv ${a.level}</span></span>`)
						.join('');
					const bf = n.buff;
					const tip = bf ? `${bf.name_mi18n}: ${bf.desc_mi18n || ''}`.replace(/"/g, '&quot;') : '';
					const meta = [];
					if (Number(n.score)) meta.push('score ' + Number(n.score).toLocaleString());
					const t = n.challenge_time;
					if (t) meta.push(`${t.month}/${t.day}`);
					return `<div class="team-card${sw ? ' tierce' : ''}">
            <div class="tc-head">
              <span class="tc-label">${sw ? '✦ Starward · Team 3' : 'Team ' + (i + 1)}</span>
              ${meta.length ? `<span class="tc-meta">${meta.join(' · ')}</span>` : ''}
            </div>
            <div class="tc-roster">${roster}</div>
            ${bf ? `<div class="tc-buff" title="${tip}"><img src="${bf.icon}" alt="">${bf.name_mi18n}</div>` : ''}
          </div>`;
				})
				.join('');
			return `<div class="act-row moc-row tl-top">
        <span class="floor">${floor.name}${floor.sw ? '<span class="sw-chip">✦ Starward</span>' : ''}</span>
        <span class="stars-sm">${'★'.repeat((Number(f.star_num) || 0) - (Number(f.extra_star_num) || 0))}${'<span class="xstar">✦</span>'.repeat(Number(f.extra_star_num) || 0)}</span>
        <span class="when">${clear}</span>
      </div>
      <div class="team-cards">${cards}</div>`;
		})
		.join('');

	return { cycles, sum, bosses, rows, cycle };
}

/* ---- Activity feed ---- */
const ACT_MODES = { 'Forgotten Hall': 'moc', 'Memory of Chaos': 'moc', 'Pure Fiction': 'pf', 'Apocalyptic Shadow': 'as' };

function themeForClear(kind, daysAgo, tlData) {
	const now = Date.now();
	const toMs = (ct) => ct?.year && new Date(ct.year, ct.month - 1, ct.day, ct.hour || 0, ct.minute || 0).getTime();
	let best = null;
	const inWindow = [];
	for (const c of ['1', '2']) {
		const d = tlData[kind]?.[c];
		const g = (d?.groups || [])[Number(c) - 1] || {};
		if (!d || !g.name_mi18n) continue;
		let t = 0;
		for (const f of d.all_floor_detail || [])
			for (const k of ['node_1', 'node_2', 'node_3']) t = Math.max(t, toMs(f[k]?.challenge_time) || 0);
		if (t) {
			const diff = Math.abs((now - t) / 86400000 - daysAgo);
			if (diff <= 1.5 && (!best || diff < best.diff)) best = { name: g.name_mi18n, diff };
		}
		const ev = now - daysAgo * 86400000;
		const b = toMs(g.begin_time), e = toMs(g.end_time);
		if (b && e && ev >= b - 43200000 && ev <= e + 43200000) inWindow.push(g.name_mi18n);
	}
	return best?.name || (inWindow.length === 1 ? inWindow[0] : undefined);
}

function fixActivityIcon(icon) {
	return icon.replace(/^icon\/sign\/RogueTourmS([2-9]\d*)\.png$/, 'icon/sign/RogueTournS$1.png');
}

export function renderActivityRows(activityInfo, tlData) {
	if (!activityInfo) return '';
	return activityInfo
		.map((a) => {
			const m = a.text.match(/^(.+? ago|Today|Yesterday):\s*(.*)$/);
			const when = (m ? m[1] : '').replace(/(\d+) day\(s\)/, (_, n) => n + (n === '1' ? ' day' : ' days'));
			let what = m ? m[2] : a.text;
			const gap = what.match(/^Completed (Forgotten Hall|Memory of Chaos|Pure Fiction|Apocalyptic Shadow):\s*$/);
			if (gap) {
				const theme = themeForClear(ACT_MODES[gap[1]], parseInt(when) || 0, tlData);
				what = theme ? `${what.trim()} ${theme}` : what.replace(/:\s*$/, '');
			}
			return `<div class="act-row">
        <img src="${ASSETS + fixActivityIcon(a.content.icon)}" alt="">
        <span>${what}</span>
        <span class="when">${when}</span>
      </div>`;
		})
		.join('');
}
