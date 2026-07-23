// Client-rendered: the showcase depends on client-only behavior (the loading
// choreography, image preloading, avatar-frame canvas measurement, trace
// tooltip positioning), so there's nothing to gain from SSR.
export const ssr = false;

export function load({ params }) {
	return { uid: params.uid };
}
