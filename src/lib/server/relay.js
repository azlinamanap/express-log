import { jsonResponse } from './http.js';

/** Relay to the Mihomo API, which sends no CORS headers so the browser
 *  can't call it directly. Mirrors server.py's relay(): the sr_activity
 *  endpoint frequently returns a 500 "Queue timeout", so retry that
 *  specific failure before giving up. Retries are trimmed vs. the Python
 *  version (2 attempts, 2s backoff) to stay within the serverless
 *  wall-clock limit. */
const UPSTREAM = 'https://api.mihomo.me/';
const RETRIES = 2;
const RETRY_DELAY = 2000;
const TIMEOUT = 15000;

export async function relay(endpoint, key) {
	const url = `${UPSTREAM}${endpoint}/${key}`;
	let status = 502;
	let body = JSON.stringify({ detail: 'upstream unreachable' });

	for (let attempt = 0; attempt < RETRIES; attempt++) {
		try {
			const r = await fetch(url, {
				headers: { 'User-Agent': 'Mozilla/5.0 (hsr-starlog dev)' },
				signal: AbortSignal.timeout(TIMEOUT)
			});
			status = r.status;
			body = await r.text();
		} catch (e) {
			status = 502;
			body = JSON.stringify({ detail: `upstream unreachable: ${e}` });
		}
		if (!(status === 500 && /Queue timeout/.test(body))) break;
		await new Promise((res) => setTimeout(res, RETRY_DELAY));
	}

	return jsonResponse(status, body);
}
