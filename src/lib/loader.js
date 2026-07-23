import { loading } from './stores.js';

/* Game-loading-style progress bar, ported from app.js. Real fetch progress
   isn't observable, so the bar creeps toward a target that the orchestration
   bumps at each stage — easing in and stalling just shy of the target so it
   always feels alive. finishLoad() runs it out to 100%. Updates the `loading`
   store instead of touching the DOM directly. */
let timer = null;
let pct = 0;
let target = 0;

const paint = () => loading.update((s) => ({ ...s, pct }));

export function startLoad(uid) {
	clearInterval(timer);
	pct = 0;
	target = 20;
	loading.set({ active: true, pct: 0, label: `Fetching showcase for UID <b>${uid}</b>…` });
	timer = setInterval(() => {
		pct = Math.min(target - 0.5, pct + Math.max(0.3, (target - pct) * 0.06));
		paint();
	}, 45);
}

export function bumpLoad(t) {
	target = t;
}

export function stopLoad() {
	clearInterval(timer);
	timer = null;
	loading.update((s) => ({ ...s, active: false }));
}

/* Drive the bar to 100% and hold briefly so the fill visibly completes
   before the overlay is hidden. */
export function finishLoad() {
	clearInterval(timer);
	return new Promise((resolve) => {
		timer = setInterval(() => {
			pct = Math.min(100, pct + 7);
			paint();
			if (pct >= 100) {
				clearInterval(timer);
				timer = null;
				setTimeout(() => {
					loading.update((s) => ({ ...s, active: false }));
					resolve();
				}, 260);
			}
		}, 22);
	});
}

/* Warm the browser cache for every image path before revealing the showcase,
   advancing the bar across [from, to] as images settle. */
export function preloadImages(urls, from, to) {
	if (!urls.length) {
		target = to;
		return Promise.resolve();
	}
	let done = 0;
	return Promise.all(
		urls.map(
			(u) =>
				new Promise((res) => {
					const img = new Image();
					let settled = false;
					const finish = () => {
						if (settled) return;
						settled = true;
						done++;
						target = from + (to - from) * (done / urls.length);
						res();
					};
					img.onload = finish;
					img.onerror = finish;
					setTimeout(finish, 15000);
					img.src = u;
				})
		)
	);
}
