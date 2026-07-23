/* Avatar head-frame ring measurement, ported from app.js. Locates a frame's
   ring in its own icon (rays cast outward, robust circle fit ignoring
   decorations) so the avatar can be scaled to sit just under the band.
   Runs client-side against a loaded <img>. */

const WRAP = 96, RING_TARGET = 32, FRAME_PX = 99;

function measureFrameRing(img) {
	const W = img.naturalWidth, H = img.naturalHeight;
	if (!W || !H) return null;
	let data;
	try {
		const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
		const cx = cv.getContext('2d');
		cx.drawImage(img, 0, 0);
		data = cx.getImageData(0, 0, W, H).data;
	} catch {
		return null;
	}
	const opaque = (x, y) => data[(y * W + x) * 4 + 3] > 100;
	const rMax = Math.min(W, H) * 0.48;
	const firstHits = (cx, cy) => {
		const ds = [];
		for (let k = 0; k < 90; k++) {
			const t = (k * 4 * Math.PI) / 180, dx = Math.cos(t), dy = Math.sin(t);
			for (let r = 8; r < rMax; r++) {
				const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
				if (x >= 0 && x < W && y >= 0 && y < H && opaque(x, y)) { ds.push(r); break; }
			}
		}
		return ds;
	};
	const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
	const cx0 = W >> 1, cy0 = H >> 1;
	let best = null;
	for (let cy = cy0 - 10; cy <= cy0 + 10; cy += 2) {
		for (let cx = cx0 - 8; cx <= cx0 + 8; cx += 2) {
			const ds = firstHits(cx, cy);
			if (ds.length < 45) continue;
			const m = median(ds);
			const near = ds.filter((d) => Math.abs(d - m) <= 6);
			if (near.length < 30) continue;
			const mean = near.reduce((s, d) => s + d, 0) / near.length;
			const varr = near.reduce((s, d) => s + (d - mean) ** 2, 0) / near.length;
			if (!best || varr < best.varr) best = { varr, cx, cy, r: median(near) };
		}
	}
	return best && { cx: best.cx, cy: best.cy, r: best.r };
}

/* Scale + position the frame so its measured ring lands on the fixed avatar
   circle. Falls back to a plain centered frame when the ring can't be read. */
export function placeFrame(img) {
	const w = img.naturalWidth || 128, h = img.naturalHeight || 128;
	const ring = measureFrameRing(img);
	const k = ring ? RING_TARGET / ring.r : FRAME_PX / w;
	const cx = ring ? ring.cx : w / 2, cy = ring ? ring.cy : h / 2;
	img.style.width = w * k + 'px';
	img.style.height = h * k + 'px';
	img.style.left = WRAP / 2 - cx * k + 'px';
	img.style.top = WRAP / 2 - cy * k + 'px';
}
