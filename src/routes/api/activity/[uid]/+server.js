import { relay } from '$lib/server/relay.js';
import { loadIndex } from '$lib/server/enka.js';
import { jsonResponse } from '$lib/server/http.js';

export const config = { maxDuration: 30 };

/* sr_activity leaves the name blank ("" in the text) for characters and
   light cones Mihomo's data doesn't know yet; fill them from StarRailRes. */
const INDEX_FOR = { character: 'characters', light_cone: 'light_cones' };

async function withItemNames(res) {
	if (!res.ok) return res;
	try {
		const data = JSON.parse((await res.clone().text()).replace(/[\u0000-\u001f]/g, ' '));
		const blank = (data.info || []).filter((a) => INDEX_FOR[a.type] && a.text.includes('""'));
		if (!blank.length) return res;
		const ix = await loadIndex();
		for (const a of blank) {
			const name = ix[INDEX_FOR[a.type]][String(a.content?.id)]?.name;
			if (name) a.text = a.text.replace('""', `"${name}"`);
		}
		return jsonResponse(200, JSON.stringify(data));
	} catch (e) {
		console.error('filling activity names failed:', e);
		return res;
	}
}

/** GET /api/activity/{uid}?lang=xx -> mihomo sr_activity (recent activity) */
export async function GET({ params, url }) {
	return withItemNames(await relay('sr_activity', params.uid + url.search));
}
