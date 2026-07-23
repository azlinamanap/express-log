import { relay } from '$lib/server/relay.js';

export const config = { maxDuration: 30 };

/** GET /api/{uid}?lang=xx -> mihomo sr_info_parsed (parsed profile + builds) */
export function GET({ params, url }) {
	return relay('sr_info_parsed', params.uid + url.search);
}
