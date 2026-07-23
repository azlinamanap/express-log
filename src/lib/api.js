/* Client-side fetches to the relay routes, ported from app.js's load flow.
   Player signatures may contain raw control characters, so strip them before
   JSON.parse (as the original did). */

const clean = (text) => text.replace(/[\u0000-\u001f]/g, ' ');

export async function fetchProfile(uid) {
	const res = await fetch(`/api/${uid}?lang=en`);
	const text = await res.text();
	if (!res.ok) {
		let detail = '';
		try {
			detail = JSON.parse(text).detail || '';
		} catch {}
		if (res.status === 500 && /queue/i.test(detail)) {
			throw new Error('The Mihomo API is busy (queue timeout) — wait a few seconds and try again.');
		}
		throw new Error(detail || `API error ${res.status} — check that the UID exists.`);
	}
	const data = JSON.parse(clean(text));
	if (!data.characters?.length) {
		throw new Error(
			'This profile has no characters on display — enable showcase in-game (Profile → Support/Display).'
		);
	}
	return data;
}

/* The raw endpoint carries what the parsed one lacks: the assist/display slot
   split, head frame, personal card, and birthday. Best-effort. The parsed
   character list dedupes a character shared by both slots, so we keep the two
   id sets separate to place shared characters in both rosters. */
export async function fetchRaw(uid) {
	const assistIds = new Set();
	const displayIds = new Set();
	try {
		const res = await fetch(`/api/raw/${uid}`);
		if (!res.ok) return { di: null, assistIds, displayIds };
		const raw = JSON.parse(clean(await res.text()));
		(raw.detailInfo?.assistAvatarList || []).forEach((a) => assistIds.add(String(a.avatarId)));
		(raw.detailInfo?.avatarDetailList || []).forEach((a) => displayIds.add(String(a.avatarId)));
		return { di: raw.detailInfo || null, assistIds, displayIds };
	} catch {
		return { di: null, assistIds, displayIds };
	}
}

/* Best-effort activity feed — its endpoint queue-times-out more often than
   the showcase one, so a failure just leaves the panel hidden. */
export async function fetchActivity(uid) {
	try {
		const res = await fetch(`/api/activity/${uid}?lang=en`);
		if (!res.ok) return null;
		const { info } = JSON.parse(clean(await res.text()));
		return info?.length ? info : null;
	} catch {
		return null;
	}
}

/* Treasures Lightward + Cosmic Strife via HoYoLAB. Best-effort: any error
   just leaves those panels hidden. */
export async function fetchBattle(uid) {
	const tlData = { aa: {}, moc: {}, pf: {}, as: {} };
	const csData = {};
	const kinds = ['aa', 'moc', 'pf', 'as'];
	const csKinds = ['cw', 'du'];
	await Promise.allSettled([
		...kinds.flatMap((k) =>
			// Anomaly Arbitration (challenge_peak) has no schedule_type variants
			(k === 'aa' ? ['1'] : ['1', '2']).map(async (c) => {
				const res = await fetch(`/api/challenge/${k}/${uid}?schedule=${c}`);
				if (!res.ok) return;
				const { retcode, data } = await res.json();
				if (retcode === 0 && data) tlData[k][c] = data;
			})
		),
		...csKinds.map(async (k) => {
			const res = await fetch(`/api/challenge/${k}/${uid}`);
			if (!res.ok) return;
			const { retcode, data } = await res.json();
			if (retcode === 0 && data) csData[k] = data;
		})
	]);
	return { tlData, csData };
}
