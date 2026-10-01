# The Express Log

**A web app for viewing Honkai: Star Rail player profiles.** Enter a UID and get a shareable page of the player's characters, gear, and endgame records, styled to match the in-game profile view while showing more detail than the game fits on one screen.

**Live:** [expresslog.vercel.app](https://expresslog.vercel.app)

![Built with SvelteKit](https://img.shields.io/badge/built%20with-SvelteKit-ff3e00) ![Deploys on Vercel](https://img.shields.io/badge/deploys-Vercel-000000) ![Data: Mihomo + Enka](https://img.shields.io/badge/data-Mihomo%20%2B%20Enka-8a63d2) ![Assets: StarRailRes](https://img.shields.io/badge/assets-StarRailRes-4a90d9)

> Not affiliated with HoYoverse. All game data and art belong to HoYoverse / miHoYo.

<!-- Add a screenshot or GIF of a loaded profile, e.g. docs/screenshot.png -->

## Features

- **Characters**: full builds for each showcased character (stats, light cone, relics, eidolons) with an interactive skill-tree diagram.
- **Battle Records**: scores and teams across all seven endgame modes.
- **Collection**: account totals and milestones, plus a profile card with avatar, level, signature, and recent activity.
- **Shareable URLs**: every profile lives at `/{uid}`, so deep links and the back button just work.
- **Extras**: an animated loading screen that preloads character art before the reveal, and optional background music.

## How it works

A client-rendered SvelteKit app. SvelteKit server routes relay data to the browser, because the upstream APIs don't send CORS headers and the battle-records API needs a server-held secret.

```
                              ┌─▶ api.mihomo.me            profile · characters · activity
browser ──▶ SvelteKit ────────┤     ↳ enka.network         fallback when Mihomo is down
        ◀── server routes ────┤─▶ bbs-api-os.hoyolab.com   authenticated battle records
                              └─▶ (character art & metadata fetched straight from GitHub)
```

| Route | Upstream | Purpose |
| --- | --- | --- |
| `GET /api/{uid}?lang=xx` | Mihomo `sr_info_parsed` (Enka fallback) | Parsed profile + character builds |
| `GET /api/raw/{uid}` | Mihomo `sr_info` (Enka fallback) | Raw profile (avatar frame & cosmetics) |
| `GET /api/activity/{uid}?lang=xx` | Mihomo `sr_activity` | Recent in-game activity |
| `GET /api/challenge/{kind}/{uid}` | HoYoLAB game record | Endgame battle records (7 modes) |

Responses are cached at Vercel's edge for 5 minutes (`s-maxage=300`).

### Engineering notes

- **Enka fallback.** When Mihomo fails, the server fetches Enka's raw data and rebuilds Mihomo's parsed format from the StarRailRes index files, so the front end can't tell which source answered.
- **HoYoLAB request signing.** Each battle-record request needs a freshly computed `DS` header (`md5(salt + timestamp + random)`), `x-rpc-*` headers, a session cookie, and the server region derived from the UID.
- **Undocumented endpoints.** The seven endgame modes map to internal endpoint names (`challenge`, `challenge_story`, `rogue`, `grid_fight`…), found by inspecting the game client's own traffic.
- **Templated game text.** Skill descriptions use `#1[i]`-style placeholders with per-level parameters. A small interpolation engine fills them in and restores the game's value highlighting.
- **Flaky upstreams.** Mihomo's `500 "Queue timeout"` is retried, with timeouts kept short enough to leave room for the Enka fallback within the serverless time limit.

## Running locally

Requires Node 20+.

```bash
npm install
npm run dev   # → http://localhost:5173
```

Try UID `800579959`, or go straight to `/800579959`.

Characters and Collection work out of the box. **Battle Records** need a HoYoLAB session: create a `.env` in the project root (it's git-ignored) with cookies from [hoyolab.com](https://www.hoyolab.com). Use a throwaway account.

```env
LTUID_V2=your_ltuid_v2
LTOKEN_V2=your_ltoken_v2
```

For background music, put an audio file at `static/music.mp3`.

**Deploying:** push to Vercel (SvelteKit is auto-detected) and set `LTUID_V2` / `LTOKEN_V2` as environment variables.

## Good to know

- **Built for desktop.** On phones the desktop layout is scaled to fit.
- **Only showcased characters appear.** The API can only see the characters a player has chosen to display on their profile.

## Project layout

```
src/routes/            landing page, profile page ([uid]), API routes (api/)
src/lib/server/        Mihomo relay, Enka fallback, HoYoLAB signing (server-only)
src/lib/components/    ProfileCard, Roster, CharacterDetail, BattleStats, LoadingScreen, …
src/lib/               rendering, battle records, stores, asset loader
src/app.css            all styling
```

## License

Personal project, shared for reference only. No reuse license is granted.
