import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { jsonResponse } from './http.js';

/** HoYoLAB battle-record relay (authenticated via a dummy account's
 *  session). Ported from server.py: computes a fresh DS signature per
 *  request, maps the UID's first digit to a game server, and forwards the
 *  x-rpc headers the official web client sends. Credentials come from
 *  env vars (LTUID_V2 / LTOKEN_V2) — set locally in .env, in the Vercel
 *  dashboard for production. */
const HOYOLAB_API = 'https://bbs-api-os.hoyolab.com/game_record/hkrpg/api';
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt'; // public overseas web-client salt
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const REGIONS = {
	'6': 'prod_official_usa',
	'7': 'prod_official_euro',
	'8': 'prod_official_asia',
	'9': 'prod_official_cht'
};

// battle-record mode -> hoyolab endpoint (recovered from the game client's
// own traffic, not guessed). Treasures Lightward + Cosmic Strife.
export const CHALLENGE_KINDS = {
	aa: 'challenge_peak', // Anomaly Arbitration
	moc: 'challenge', // Memory of Chaos
	pf: 'challenge_story', // Pure Fiction
	as: 'challenge_boss', // Apocalyptic Shadow
	cw: 'grid_fight', // Currency Wars (internal name: Grid Fight)
	su: 'rogue', // Simulated Universe
	du: 'rogue_tourn' // Divergent Universe
};

function hoyolabCookie() {
	if (env.LTUID_V2 && env.LTOKEN_V2) {
		return `ltuid_v2=${env.LTUID_V2}; ltoken_v2=${env.LTOKEN_V2}`;
	}
	return null;
}

function dsHeader() {
	const t = Math.floor(Date.now() / 1000);
	const r = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
	const check = crypto.createHash('md5').update(`salt=${DS_SALT}&t=${t}&r=${r}`).digest('hex');
	return `${t},${r},${check}`;
}

export async function challenge(kind, uid, schedule) {
	const endpoint = CHALLENGE_KINDS[kind];
	if (!endpoint) {
		return jsonResponse(400, JSON.stringify({ detail: `unknown challenge kind '${kind}'` }), false);
	}
	const cookie = hoyolabCookie();
	if (!cookie) {
		return jsonResponse(503, JSON.stringify({ detail: 'hoyolab env has no cookies yet' }), false);
	}
	const region = REGIONS[uid[0]];
	if (!region) {
		return jsonResponse(400, JSON.stringify({ detail: `unsupported region for UID ${uid}` }), false);
	}

	const url = `${HOYOLAB_API}/${endpoint}?server=${region}&role_id=${uid}&schedule_type=${schedule}&need_all=true`;
	try {
		const r = await fetch(url, {
			headers: {
				Cookie: cookie,
				DS: dsHeader(),
				'x-rpc-app_version': '1.5.0',
				'x-rpc-client_type': '5',
				'x-rpc-language': 'en-us',
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
			},
			signal: AbortSignal.timeout(15000)
		});
		return jsonResponse(r.status, await r.text());
	} catch (e) {
		return jsonResponse(502, JSON.stringify({ detail: `hoyolab unreachable: ${e}` }), false);
	}
}
