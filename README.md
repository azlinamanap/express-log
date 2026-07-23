# The Express Log

**A web app for viewing Honkai: Star Rail player profiles.** Type in a player's ID and it pulls up a shareable page showing their characters, gear, and battle achievements — built to replicate the game's own profile view as closely as possible, while surfacing the full detail the game itself never shows on one screen.

![Built with SvelteKit](https://img.shields.io/badge/built%20with-SvelteKit-ff3e00) ![Deploys on Vercel](https://img.shields.io/badge/deploys-Vercel-000000) ![Data: Mihomo API](https://img.shields.io/badge/data-Mihomo%20API-8a63d2) ![Assets: StarRailRes](https://img.shields.io/badge/assets-StarRailRes-4a90d9)

> Not affiliated with HoYoverse. All game data and art belong to HoYoverse / miHoYo.

<!-- Replace with a real screenshot or GIF of a loaded profile, e.g. docs/screenshot.png -->
![The Express Log — player profile view](docs/screenshot.png)

## Highlights

- **SvelteKit end-to-end.** A Svelte 5 front end with the API relay running as SvelteKit server routes — one language, one deploy, hostable free on Vercel with secrets kept server-side.
- **Two live game APIs, reconciled.** Merges a community profile API with HoYoLAB's official — and undocumented — game-record API, including reverse-engineering its request signing.
- **Game-faithful UI.** A deliberate goal was to replicate the in-game profile view as closely as possible — interactive character build sheets, skill-tree diagrams, and endgame leaderboards styled to sit comfortably next to the game itself.
- **Resilient by design.** The relay retries the upstream APIs' intermittent queue timeouts, and responses are cached at the CDN edge to stay within rate limits.

## What it does

*Honkai: Star Rail* is a popular role-playing game where players spend a lot of time building and fine-tuning their roster of characters. But the game only shows a limited snapshot of someone's account, and there's no good way to browse a full profile or compare notes with friends.

**The Express Log solves that.** Enter any player's 9-digit ID (their "UID") and the app instantly builds a clean profile page with three sections:

- **Characters** — every character the player has chosen to display, each with a detailed breakdown of their level, stats, skills, gear, and upgrades. Click one to expand the full build, including an interactive skill-tree diagram.
- **Battle Records** — how the player performed in the game's toughest end-game challenges (seven distinct modes), including scores and the teams they used.
- **Collection** — an overview of the account's totals and milestones.

It also shows a profile card with the player's avatar, level, signature, and recent activity. Throughout, the guiding goal was to replicate the in-game profile view as faithfully as possible — matching its layout, typography, and visual language so the result feels like a natural extension of the game rather than a third-party dashboard.

## Architecture

The front end is a client-rendered **SvelteKit** app. It's backed by **SvelteKit server routes** that relay data from external sources to the browser — necessary because those APIs can't be called directly from a web page (they don't send the CORS headers browsers require) and because the battle-records API needs a server-held secret that can't live in client code.

```
                              ┌─▶ api.mihomo.me            profile · characters · activity
browser ──▶ SvelteKit ────────┤
        ◀── server routes ────┤─▶ bbs-api-os.hoyolab.com   authenticated battle records
                              └─▶ (character art & metadata fetched straight from GitHub)
```

- **Profile, character, and activity data** come from the **[Mihomo API](https://api.mihomo.me)**, a community service for Star Rail account data.
- **Detailed end-game battle records** come from **HoYoLAB**'s official game-record API, which requires a logged-in session and a signed request (see [Engineering notes](#engineering-notes)).
- **Character art, icons, and game metadata** (skill descriptions, eidolons, light-cone effects) are loaded by the browser directly from the **[StarRailRes](https://github.com/Mar-7th/StarRailRes)** asset library on GitHub — no proxy needed, since GitHub serves permissive CORS headers.
- **Upstream responses are cached for 5 minutes at the CDN edge** via `Cache-Control: s-maxage=300`, which Vercel honors — the serverless-native replacement for an in-process cache.

**Tech stack:** SvelteKit (Svelte 5) front end, client-rendered; SvelteKit server routes (Node) for the relay; deployed to Vercel via `@sveltejs/adapter-vercel`. The relay uses only the Node standard library (`node:crypto` for the HoYoLAB signature).

### The API relay

The app exposes four server routes, each proxying to the appropriate upstream and attaching a `Cache-Control` header:

| Route | Upstream | Purpose |
| --- | --- | --- |
| `GET /api/{uid}?lang=xx` | Mihomo `sr_info_parsed` | Parsed profile + character builds |
| `GET /api/raw/{uid}` | Mihomo `sr_info` | Raw profile (avatar frame & cosmetics) |
| `GET /api/activity/{uid}?lang=xx` | Mihomo `sr_activity` | Recent in-game activity |
| `GET /api/challenge/{kind}/{uid}` | HoYoLAB game-record | Endgame battle records (7 modes) |

## Engineering notes

The parts of this project that were genuinely interesting to build:

- **Reverse-engineering HoYoLAB's request signing.** The official game-record API rejects unsigned requests. Each call needs a freshly computed `DS` header — an `md5(salt + timestamp + random-string)` token — plus a specific set of `x-rpc-*` headers, an authenticated session cookie, and the correct game-server region derived from the first digit of the UID. The server assembles all of this on the fly.
- **Mapping seven endgame modes to undocumented endpoint names.** The battle-record modes players know by name (Memory of Chaos, Pure Fiction, Simulated Universe…) map to internal HoYoLAB endpoints with unrelated names (`challenge`, `challenge_story`, `rogue`, `grid_fight`…). These were recovered by inspecting the game client's own traffic rather than guessing.
- **Rendering the game's own templated text.** Skill and trace descriptions in the data are templates with `#1[i]`-style placeholders and per-level parameter arrays. A small interpolation engine resolves them at the correct level and re-applies the game's value highlighting, so tooltips read exactly as they do in-game.
- **Laying out skill trees.** Each character's traces are rendered as a branching diagram computed from parent/child relationships in the metadata — positioned, connected, and made hover-interactive in plain DOM/CSS.
- **Surviving flaky upstreams.** The Mihomo activity endpoint frequently returns a `500 "Queue timeout"`; the relay detects that specific failure and retries before giving up (trimmed to fit the serverless time budget), while genuine errors pass straight through.
- **A perceived-performance loading flow.** Before revealing a profile, the client preloads the character art it's about to show and drives a real progress bar, so the reveal is clean rather than popping in piecemeal.
- **Shareable, navigable URLs.** SvelteKit dynamic routes give every profile a real URL (`/{uid}`), so deep links and the browser back button work natively.
- **Rendering intricate HTML from Svelte.** The pixel-precise trace-tree layout and other CSS-coupled markup are generated by pure functions and injected with `{@html}`, while SvelteKit owns routing, reactive state, and lifecycle — keeping the exact visual output while modernising the shell.

## Running it locally

Requires Node 20+.

```bash
npm install
npm run dev
# → open http://localhost:5173
```

Enter a UID to get started (e.g. `800333171`), or deep-link straight to `/800333171`.

The Characters and Collection views work immediately. The detailed **Battle Records** view additionally needs a logged-in HoYoLAB session — create a `.env` file in the project root with two cookie values from a [hoyolab.com](https://www.hoyolab.com) session:

```env
LTUID_V2=your_ltuid_v2
LTOKEN_V2=your_ltoken_v2
```

This file is git-ignored, and using a throwaway HoYoLAB account is recommended so your main account is never exposed.

### Deploying

Push to a Vercel project (it auto-detects SvelteKit and builds with `@sveltejs/adapter-vercel`). Set `LTUID_V2` and `LTOKEN_V2` as environment variables in the Vercel dashboard so Battle Records work in production.

## Good to know

- **Designed for desktop.** The layout is built for a wide screen; phones show the full desktop view scaled to fit.
- **Only "displayed" characters appear.** Players choose which characters to show on their public profile — the app can only see those, a limit of the underlying data rather than the app itself.

## Project layout

```
src/routes/            +layout · landing (+page) · profile ([uid]/+page)
src/routes/api/        server routes relaying to Mihomo / HoYoLAB
src/lib/server/        relay + HoYoLAB request signing (server-only)
src/lib/               render logic, battle-records rendering, stores, loader
src/lib/components/    ProfileCard, Roster, CharacterDetail, BattleStats, …
src/app.css            all styling
.env                   HoYoLAB session cookies (git-ignored; you create this)
```

## License

A personal project — no reuse license is granted. The code is shared for reference only. Game data and art belong to HoYoverse / miHoYo.
