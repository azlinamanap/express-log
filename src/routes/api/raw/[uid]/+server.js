import { relay } from '$lib/server/relay.js';
import { withEnkaFallback } from '$lib/server/enka.js';

export const config = { maxDuration: 30 };

/** GET /api/raw/{uid} -> mihomo sr_info (raw profile: avatar frame & cosmetics),
 *  or Enka's equivalent detailInfo when Mihomo is down */
export async function GET({ params, url }) {
	return withEnkaFallback(await relay('sr_info', params.uid + url.search), params.uid, 'raw');
}
