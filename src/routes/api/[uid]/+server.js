import { relay } from '$lib/server/relay.js';
import { withEnkaFallback, withMissingCharacters } from '$lib/server/enka.js';

export const config = { maxDuration: 30 };

/** GET /api/{uid}?lang=xx -> mihomo sr_info_parsed (parsed profile + builds),
 *  with characters it doesn't know yet rebuilt from the raw sr_info, or
 *  the whole profile rebuilt from Enka when Mihomo is down */
export async function GET({ params, url }) {
	const [parsed, raw] = await Promise.all([
		relay('sr_info_parsed', params.uid + url.search),
		relay('sr_info', params.uid)
	]);
	return withEnkaFallback(await withMissingCharacters(parsed, raw), params.uid, 'parsed');
}
