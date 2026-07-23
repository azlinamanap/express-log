import { relay } from '$lib/server/relay.js';

export const config = { maxDuration: 30 };

/** GET /api/raw/{uid} -> mihomo sr_info (raw profile: avatar frame & cosmetics) */
export function GET({ params, url }) {
	return relay('sr_info', params.uid + url.search);
}
