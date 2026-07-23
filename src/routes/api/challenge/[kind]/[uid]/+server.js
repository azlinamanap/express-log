import { challenge } from '$lib/server/hoyolab.js';

export const config = { maxDuration: 30 };

/** GET /api/challenge/{kind}/{uid}?schedule=1|2 -> hoyolab game-record.
 *  schedule_type 1 = current cycle, 2 = previous cycle. */
export function GET({ params, url }) {
	const schedule = url.searchParams.get('schedule') === '2' ? '2' : '1';
	return challenge(params.kind, params.uid, schedule);
}
