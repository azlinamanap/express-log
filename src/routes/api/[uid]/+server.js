import { relay } from '$lib/server/relay.js';
import { withEnkaFallback } from '$lib/server/enka.js';

export const config = { maxDuration: 30 };

/** GET /api/{uid}?lang=xx -> mihomo sr_info_parsed (parsed profile + builds),
 *  rebuilt from Enka when Mihomo is down */
export async function GET({ params, url }) {
	return withEnkaFallback(await relay('sr_info_parsed', params.uid + url.search), params.uid, 'parsed');
}
