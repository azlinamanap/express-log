import { relay } from '$lib/server/relay.js';

export const config = { maxDuration: 30 };

/** GET /api/activity/{uid}?lang=xx -> mihomo sr_activity (recent activity) */
export function GET({ params, url }) {
	return relay('sr_activity', params.uid + url.search);
}
