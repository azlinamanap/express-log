// The ticket heading is picked at random per visit. It's a server load so
// the choice is serialized into the page and reused on hydration (a
// universal +page.js load would re-roll in the browser and flip the heading
// after first paint); client-side visits fetch a fresh pick.
const HEADINGS = ['Where to, Trailblazer?', 'Who’s riding the Express?'];

export function load() {
	return { heading: HEADINGS[Math.floor(Math.random() * HEADINGS.length)] };
}
