/** JSON Response helper shared by the relay + hoyolab modules.
 *  Successful upstream responses get a CDN cache header (Vercel honors
 *  `s-maxage` at its edge) — the serverless replacement for server.py's
 *  in-memory 5-minute cache, which can't persist on ephemeral functions. */
export function jsonResponse(status, body, cache = true) {
	const headers = { 'Content-Type': 'application/json' };
	if (status === 200 && cache) {
		headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=60';
	}
	return new Response(body, { status, headers });
}
