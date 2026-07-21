"use strict";

const ASSETS = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
const ELEMENT_AURA = {
  Fire: "rgba(255, 107, 88, 0.34)",
  Ice: "rgba(88, 199, 245, 0.32)",
  Lightning: "rgba(164, 138, 245, 0.34)",
  Wind: "rgba(94, 214, 165, 0.30)",
  Quantum: "rgba(125, 141, 245, 0.36)",
  Imaginary: "rgba(242, 209, 88, 0.28)",
  Physical: "rgba(200, 204, 214, 0.26)",
};
const STAT_ORDER = ["hp", "atk", "def", "spd", "crit_rate", "crit_dmg"];

/* ---------------- traces ----------------
   Cores and memosprite abilities sit in a horizontal row up top. Below,
   the A2/A4/A6 major traces each head a small connected tree of the minor
   stat nodes branching off them (mihomo gives each node's direct parent
   id, so the branch shapes — a straight chain here, two siblings there —
   come from real data, not a guess). Node id suffix tells the kind: 1-99
   core ability, 101-103 major trace, 200-299 minor stat trace, 301+
   memosprite ability. */
const CORE_LABELS = {
  basic_atk: "Basic ATK", skill: "Skill", ultimate: "Ultimate", talent: "Talent",
  technique: "Technique", memosprite_skill: "Memo Skill", memosprite_talent: "Memo Talent",
};

/* Majors (A2/A4/A6) and memosprite abilities have no description anywhere
   in mihomo's character response — not in skill_trees, not in c.skills.
   StarRailRes (the same asset repo the icons already come from) publishes
   the actual game text as a separate data set, keyed by node id, with
   numbers as "#1[i]%"-style placeholders resolved against a params array
   rather than baked in. Fetched once in the background and cached; trace
   tooltips render without descriptions until it lands, then refresh. */
let traceDescData = null;
Promise.all([
  fetch(`${ASSETS}index_new/en/character_skill_trees.json`).then((r) => r.json()),
  fetch(`${ASSETS}index_new/en/character_skills.json`).then((r) => r.json()),
])
  .then(([trees, skills]) => {
    traceDescData = { trees, skills };
    // majors/memosprite tooltips render without descriptions until this
    // ~3MB fetch lands; refresh whatever's already on screen once it does
    if (data?.characters?.[currentChar]) $("c-traces").innerHTML = renderTraceTree(data.characters[currentChar]);
  })
  .catch(() => {});

const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* "#1[i]%" -> param 1, integer, with a trailing percent; "#2[f1]" -> param
   2 to 1 decimal place. Percent params are stored as fractions (0.35), so
   the literal "%" immediately after the token is what triggers ×100.
   Substituted values get wrapped for highlighting — only possible because
   resolution happens on our side, so exactly which substring is "the
   stat" vs. surrounding prose is known rather than guessed; mihomo's own
   already-resolved text (used as a fallback when a skill/trace isn't in
   the StarRailRes data) has no such marker and stays plain. Escape the
   surrounding text first: it's real game text (may
   contain stray &/</>) but the placeholder tokens are plain ASCII and
   survive escaping untouched, so this order is still correct. */
function resolveTemplate(desc, params) {
  if (!desc) return "";
  return escHtml(desc).replace(/#(\d+)\[(i|f\d)\](%?)/g, (full, idxStr, fmt, pct) => {
    const v = params?.[Number(idxStr) - 1];
    if (v == null) return full;
    const n = pct ? v * 100 : v;
    const decimals = fmt === "i" ? 0 : Number(fmt.slice(1)) || 0;
    return `<b class="tt-num">${n.toFixed(decimals)}${pct}</b>`;
  });
}

/* A major's own trace-tree entry has its description directly. A
   memosprite trace (Memo Skill/Memo Talent) instead just unlocks one or
   more real abilities (character_skills.json, referenced by
   level_up_skills) — e.g. Memo Skill on Evernight grants both her attack
   and her memosprite's finisher — so its tooltip lists each by name.
   Always uses each ability's base (first) params row: majors only ever
   have the one level anyway, and there's no clean way to map a trace's
   own level onto its unlocked abilities' separate level scale. */
function traceDescFor(n) {
  if (!traceDescData) return "";
  const entry = traceDescData.trees[String(n.id)];
  if (!entry) return "";
  if (entry.desc) return resolveTemplate(entry.desc, entry.params?.[0]);
  const linked = (entry.level_up_skills || [])
    .map((s) => traceDescData.skills[String(s.id)])
    .filter((s) => s?.desc);
  return linked
    .map((s) => `<b class="tt-ability">${escHtml(s.name)}:</b> ${resolveTemplate(s.desc, s.params?.[0])}`)
    .join("\n\n");
}

function traceKind(n) {
  const suffix = Number(String(n.id).slice(-3));
  return suffix <= 99 || suffix >= 300 ? "core" : suffix <= 199 ? "major" : "minor";
}

function traceTitle(n, kind) {
  const base = n.icon.slice(n.icon.lastIndexOf("/") + 1).replace(".png", "");
  if (kind === "major") return "Bonus Ability " + base.slice(-1) + " (A" + base.slice(-1) * 2 + ")";
  return CORE_LABELS[base.replace(/^\d+_/, "")] || "Ability";
}

/* minor nodes use generic stat icons (icon/property/IconXxx.png), not the
   per-character skill icons CORE_LABELS covers — the character's own
   attribute/property/addition lists already carry a human name for every
   one of those icons, so borrow from there instead of guessing from the
   filename. */
function minorTitle(c, n) {
  for (const pool of [c.properties, c.attributes, c.additions]) {
    const hit = (pool || []).find((p) => p.icon === n.icon);
    if (hit) return hit.name.replace(/^Base /, "");
  }
  return "Trace";
}

const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function traceNodeHtml(n, kind, title, size, x, y, desc) {
  const lv = n.max_level > 1 ? `<span class="tn-lv">${n.level}</span>` : "";
  const pos = x == null ? "" : `position:absolute; left:${x}px; top:${y}px; width:${size}px; height:${size}px;`;
  // custom hover tooltip (see #trace-tip / the mouseover delegate below)
  // reads these back out, rather than a native, unstyleable title
  const name = `${title}${n.max_level > 1 ? ` · Lv ${n.level}/${n.max_level}` : ""}`;
  return `<div class="tn ${kind}${n.level > 0 ? "" : " off"}" style="${pos}"
      data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc || "")}">
      <img src="${ASSETS + n.icon}" alt="">${lv}
    </div>`;
}

/* lays out one branch as a small tree: leaves get the next free column,
   a parent centers itself over its children's columns — a minimal version
   of the standard "assign x by post-order, y by depth" tree layout. The
   whole branch is then re-centered as a block under its trace node in
   renderTraceTree, so this local centering just keeps each branch's own
   shape symmetric before that happens. */
function layoutTraceBranch(root, childrenOf) {
  let nextCol = 0;
  function place(node, depth) {
    const kids = childrenOf.get(String(node.id)) || [];
    if (!kids.length) return { node, x: nextCol++, y: depth, kids: [] };
    const placedKids = kids.map((k) => place(k, depth + 1));
    const x = (placedKids[0].x + placedKids[placedKids.length - 1].x) / 2;
    return { node, x, y: depth, kids: placedKids };
  }
  return place(root, 0);
}
function flattenTraceBranch(t, out = []) {
  out.push(t);
  t.kids.forEach((k) => flattenTraceBranch(k, out));
  return out;
}

function renderTraceTree(c) {
  const nodes = (c.skill_trees || []).slice();
  const byId = new Map(nodes.map((n) => [String(n.id), n]));
  const childrenOf = new Map();
  nodes.forEach((n) => {
    if (n.parent && byId.has(String(n.parent))) {
      const arr = childrenOf.get(String(n.parent)) || [];
      arr.push(n);
      childrenOf.set(String(n.parent), arr);
    }
  });

  // core traces (Basic ATK/Skill/Ultimate/Talent/Technique) match a real
  // entry in c.skills by icon. Prefer resolving it ourselves from the same
  // StarRailRes data majors use — character_skills.json's params are
  // indexed by level and s.level here is mihomo's real current level, so
  // params[s.level - 1] reproduces mihomo's own numbers exactly, but
  // through resolveTemplate this time, which means highlighting. Falls
  // back to mihomo's plain (escaped, unhighlighted) desc for any skill
  // that lookup misses. Some skills share an icon with a near-duplicate
  // "Maze"-prefixed exploration variant that often has no desc in either
  // source — keep the first one per icon that resolves to something.
  const skillDescByIcon = new Map();
  for (const s of c.skills || []) {
    if (!s.icon || skillDescByIcon.has(s.icon)) continue;
    const srr = traceDescData?.skills?.[String(s.id)];
    const resolved = srr?.desc
      ? resolveTemplate(srr.desc, srr.params?.[Math.min(s.level, srr.params.length) - 1])
      : s.desc ? escHtml(s.desc) : null;
    if (resolved) skillDescByIcon.set(s.icon, resolved);
  }

  const cores = nodes.filter((n) => traceKind(n) === "core").sort((a, b) => a.anchor.localeCompare(b.anchor));
  // a branch root is any major/minor node whose own parent is null or
  // doesn't resolve to another node in this tree — usually that's the
  // majors (A2/A4/A6), but at least one character has a minor stat node
  // as the parent of two majors instead of the other way around, so
  // majors can't just be assumed to always be roots. Deriving roots from
  // each node's own parent field (rather than "every major, plus any
  // minor no major claims") also means a node never ends up double
  // counted as both a root and someone else's descendant.
  const branchRoots = nodes
    .filter((n) => traceKind(n) !== "core" && (!n.parent || !byId.has(String(n.parent))))
    .sort((a, b) => a.anchor.localeCompare(b.anchor));

  const coreRow = `<div class="trace-row">${cores
    .map((n) => traceNodeHtml(n, "core", traceTitle(n, "core"), null, null, null,
      skillDescByIcon.get(n.icon) || traceDescFor(n)))
    .join("")}</div>`;

  if (!branchRoots.length) return coreRow;

  const COL = 37, ROW = 56, MAJOR_SIZE = 42, MINOR_SIZE = 29;
  // trace-row's 46px core icons sit CORE_PITCH px apart center-to-center
  // (46px icon + 20px gap) — a branch's own midpoint is solved to land
  // exactly on its target core node's true pixel center, not just the
  // same nominal "column" (which .trace-row and .trace-tree don't
  // otherwise share a pixel-for-pixel definition of, since their node
  // sizes differ)
  const CORE_ICON = 46, CORE_PITCH = 66;
  const targetCxFor = (slot) => slot * CORE_PITCH + CORE_ICON / 2;
  // a major always gets its own core-aligned slot (by anchor order among
  // ALL majors) regardless of whether it's a top-level root or, as on Dan
  // Heng · Permansor Terrae, one of several majors sharing a single minor
  // parent — that shared parent doesn't head one wide branch in that case,
  // it renders as a small connector between its majors' own slots instead
  const majorSlot = new Map(
    nodes.filter((n) => traceKind(n) === "major")
      .sort((a, b) => a.anchor.localeCompare(b.anchor))
      .map((m, i) => [String(m.id), i])
  );
  const placeBranch = (root, slot) => {
    const flat = flattenTraceBranch(layoutTraceBranch(root, childrenOf));
    const xs = flat.map((f) => f.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const anchor = targetCxFor(slot) / COL - 0.5 - mid; // solves centerOf(mid) === targetCx
    flat.forEach((f) => { f.x += anchor; });
    return flat;
  };

  let maxRow = 0, maxCol = 0;
  const placed = [];
  let nextPlainSlot = majorSlot.size;
  for (const root of branchRoots) {
    const majorKids = (childrenOf.get(String(root.id)) || []).filter((k) => traceKind(k) === "major");
    if (traceKind(root) !== "major" && majorKids.length >= 2) {
      // connector: its major children each get their own slot and full
      // sub-layout, shifted down a row to leave this node room above them
      const subFlats = majorKids.map((mk) => placeBranch(mk, majorSlot.get(String(mk.id))));
      subFlats.forEach((flat) => flat.forEach((f) => { f.y += 1; }));
      const rootXs = subFlats.map((flat) => flat[0].x);
      placed.push({
        node: root, y: 0,
        x: (Math.min(...rootXs) + Math.max(...rootXs)) / 2,
        kids: subFlats.map((flat) => flat[0]),
      });
      subFlats.forEach((flat) => placed.push(...flat));
    } else {
      const slot = traceKind(root) === "major" ? majorSlot.get(String(root.id)) : nextPlainSlot++;
      placed.push(...placeBranch(root, slot));
    }
  }
  placed.forEach((f) => {
    maxRow = Math.max(maxRow, f.y);
    maxCol = Math.max(maxCol, f.x);
  });

  const centerOf = (f) => ({
    cx: f.x * COL + COL / 2,
    top: f.y * ROW,
    size: traceKind(f.node) === "major" ? MAJOR_SIZE : MINOR_SIZE,
  });
  const nodesHtml = placed
    .map((f) => {
      const kind = traceKind(f.node);
      const { cx, top, size } = centerOf(f);
      const title = kind === "major" ? traceTitle(f.node, kind) : minorTitle(c, f.node);
      const desc = kind === "major" ? traceDescFor(f.node) : undefined;
      return traceNodeHtml(f.node, kind, title, size, cx - size / 2, top, desc);
    })
    .join("");
  const linesHtml = placed
    .flatMap((f) => {
      const p = centerOf(f);
      return f.kids.map((k) => {
        const kc = centerOf(k);
        return `<line x1="${p.cx}" y1="${p.top + p.size}" x2="${kc.cx}" y2="${kc.top}" />`;
      });
    })
    .join("");
  // at least as wide as the core row itself (cores.length core-pitches),
  // or wider still if a branch's own children spill past that
  const treeW = Math.max((maxCol + 1) * COL, cores.length * CORE_PITCH);
  const treeH = (maxRow + 1) * ROW;

  return `${coreRow}<div class="trace-tree" style="width:${treeW}px; height:${treeH}px;">
      <svg class="trace-lines" width="${treeW}" height="${treeH}">${linesHtml}</svg>
      ${nodesHtml}
    </div>`;
}

const $ = (id) => document.getElementById(id);
let data = null;
let currentChar = 0;
let assistIds = new Set(); // character ids in support (assist) slots, from the raw endpoint

/* ---------------- fetch & render ---------------- */

/* Intro vs. loaded layout: on the intro page the search sits centered in the
   hero; once a profile loads it moves to the header's top-right. Moving the one
   form (rather than duplicating it) keeps a single input and submit handler. */
function setShowcaseMode(on) {
  document.querySelector(".app").classList.toggle("has-showcase", on);
  (on ? document.querySelector("header") : $("hero-slot")).appendChild($("form"));
}

/* Tear down any showcase already on screen so a new search starts from a clean
   page — the previous UID's card, roster, and records don't linger behind the
   loading overlay or flash through if the new fetch fails. */
function clearShowcase() {
  setShowcaseMode(false);
  data = null;
  $("player").classList.remove("show");
  $("activity").classList.remove("show");
  ["endgame", "tl", "cs", "tl-stats"].forEach((id) => $(id).classList.remove("show"));
  $("detail").classList.remove("show");
  $("view-tabs").classList.remove("show");
  $("tl-empty").classList.remove("show");
}

async function load(uid) {
  const btn = $("go");
  btn.disabled = true; btn.textContent = "Loading…";
  clearShowcase();
  startLoad(uid);
  try {
    const res = await fetch(`/api/${uid}?lang=en`);
    const text = await res.text();
    bumpLoad(45);
    if (!res.ok) {
      let detail = "";
      try { detail = JSON.parse(text).detail || ""; } catch {}
      if (res.status === 500 && /queue/i.test(detail)) {
        throw new Error("The Mihomo API is busy (queue timeout) — wait a few seconds and try again.");
      }
      throw new Error(detail || `API error ${res.status} — check that the UID exists.`);
    }
    // player signatures may contain raw control characters; strip before parsing
    data = JSON.parse(text.replace(/[\u0000-\u001f]/g, " "));
    if (!data.characters?.length) {
      throw new Error("This profile has no characters on display — enable showcase in-game (Profile → Support/Display).");
    }
    history.replaceState(null, "", "#" + uid);
    localStorage.setItem("starlog.uid", uid);
    bumpLoad(65);
    // raw profile (assist/display slot split, on failure everything lands in
    // one group), activity, and treasures all load together rather than the
    // showcase revealing itself after just the first — so the page appears
    // once, fully populated, instead of panels popping in one by one
    await Promise.allSettled([loadRawProfile(uid), loadActivity(uid), loadTreasures(uid)]);
    bumpLoad(60);
    renderPlayer(data.player);
    renderRoster(data.characters);
    // preload every character's detail-card art so switching cards is instant
    // rather than images loading on first open; the reveal waits on this
    await preloadImages(data.characters, 60, 98);
    // no default selection — the detail card stays hidden until a
    // character is actually clicked, resetting any state left over from
    // a previously loaded UID
    $("detail").classList.remove("show");
    await finishLoad();
    notice(null);
    setShowcaseMode(true);
    $("view-tabs").classList.add("show");
    applyView();
  } catch (e) {
    stopLoad();
    clearShowcase();
    notice(e.message);
  } finally {
    btn.disabled = false; btn.textContent = "View";
  }
}

/* Top-level split mirroring the in-game profile: "battle" holds Treasures
   Lightward, "chars" holds the profile card, roster, and character detail. */
let view = "chars";
let prevView = null;
// tab order left→right, so the sign of the index delta tells the pane which
// way to slide in: rightward move → enter from the right, and vice versa
const VIEW_ORDER = ["battle", "chars", "coll"];
function applyView() {
  document.querySelectorAll("#view-tabs button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.view === view))
  );
  const dir = prevView && prevView !== view
    ? VIEW_ORDER.indexOf(view) - VIEW_ORDER.indexOf(prevView)
    : 0;
  document.querySelector(".pane").style
    .setProperty("--enter-x", (dir > 0 ? 28 : dir < 0 ? -28 : 0) + "px");
  prevView = view;
  $("roster").classList.toggle("view-hidden", view !== "chars");
  $("detail").classList.toggle("view-hidden", view !== "chars");
  $("endgame").classList.toggle("view-hidden", view !== "battle");
  $("tl-stats").classList.toggle("view-hidden", view !== "battle");
  $("collection").classList.toggle("view-hidden", view !== "coll");
  $("tl-empty").classList.toggle(
    "show",
    view === "battle" && !$("endgame").classList.contains("show")
  );
}
/* Switching top tabs resets the drilled-in selection in both showcases, so a
   tab always reopens on its list (roster / mode tiles) with nothing selected
   rather than the card left open from a previous visit. */
function clearSelections() {
  // Character Showcase: close the detail sheet, deselect every roster card
  $("detail").classList.remove("show");
  document.querySelectorAll(".char-card[aria-pressed='true']")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
  // Battle Records: hide the stats card, deselect the mode tiles/hero
  $("tl-stats").classList.remove("show");
  tlKind = null;
  document.querySelectorAll(".tl-tile[aria-pressed='true'], .tl-hero-card[aria-pressed='true']")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
}
document.querySelectorAll("#view-tabs button").forEach((b) => {
  b.onclick = () => { view = b.dataset.view; clearSelections(); applyView(); };
});

function notice(html) {
  const n = $("notice");
  n.classList.toggle("show", html !== null);
  if (html !== null) n.innerHTML = html;
}

/* Game-loading-style percentage bar. Real fetch progress isn't observable, so
   the bar creeps toward a target that load() bumps up at each stage — it eases
   in and stalls just shy of the target, so it always feels alive without ever
   racing ahead of the work. finishLoad() runs it out to 100%. */
let loadTimer = null, loadPct = 0, loadTarget = 0;

function paintLoad() {
  const f = $("loadfill"), p = $("loadpct");
  if (f) f.style.width = loadPct + "%";
  if (p) p.textContent = Math.round(loadPct) + "%";
}

function startLoad(uid) {
  clearInterval(loadTimer);
  loadPct = 0; loadTarget = 20;
  notice(null);
  $("loadlabel").innerHTML = `Fetching showcase for UID <b>${uid}</b>…`;
  $("loading").classList.add("show");
  paintLoad();
  loadTimer = setInterval(() => {
    // ease toward the current target, never quite reaching it until bumped
    loadPct = Math.min(loadTarget - 0.5, loadPct + Math.max(0.3, (loadTarget - loadPct) * 0.06));
    paintLoad();
  }, 45);
}

function bumpLoad(target) { loadTarget = target; }

/* Every image a character detail card shows (portrait, relics, traces,
   eidolons, light cone, stat icons) is set on .src only when the card is
   opened, so without this they pop in on first view. Walk the character data
   for every ".png" path and warm the browser cache before the showcase is
   revealed, advancing the bar across the given range as images settle. */
function collectImageUrls(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectImageUrls(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((v) => collectImageUrls(v, out));
  else if (typeof node === "string" && /\.png$/i.test(node))
    out.add(/^https?:/.test(node) ? node : ASSETS + node);
}

function preloadImages(chars, from, to) {
  const urls = new Set();
  collectImageUrls(chars, urls);
  const list = [...urls];
  if (!list.length) { loadTarget = to; return Promise.resolve(); }
  let done = 0;
  return Promise.all(list.map((u) => new Promise((res) => {
    const img = new Image();
    // resolve on load OR error (a missing asset shouldn't stall the reveal),
    // with a timeout so one stuck request can't hold the whole set hostage
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      done++;
      loadTarget = from + (to - from) * (done / list.length);
      res();
    };
    img.onload = finish; img.onerror = finish;
    setTimeout(finish, 15000);
    img.src = u;
  })));
}

function stopLoad() {
  clearInterval(loadTimer); loadTimer = null;
  $("loading").classList.remove("show");
}

/* Drive the bar to 100% and hold it there briefly so the fill visibly
   completes before the overlay is hidden. */
function finishLoad() {
  clearInterval(loadTimer);
  return new Promise((resolve) => {
    loadTimer = setInterval(() => {
      loadPct = Math.min(100, loadPct + 7);
      paintLoad();
      if (loadPct >= 100) {
        clearInterval(loadTimer); loadTimer = null;
        setTimeout(() => { $("loading").classList.remove("show"); resolve(); }, 260);
      }
    }, 22);
  });
}

function renderPlayer(p) {
  $("p-avatar").src = ASSETS + p.avatar.icon;
  $("p-name").textContent = p.nickname;
  $("p-lv").textContent = p.level;
  $("p-uid").textContent = `UID ${p.uid}`;
  $("p-bday").textContent = "";
  $("p-meta").textContent =
    `Trailblaze Lv ${p.level} · Equilibrium ${p.world_level} · ${p.friend_count} friends`;
  $("sig-sec").style.display = p.signature ? "" : "none";
  $("p-sig").textContent = p.signature || "";
  const s = p.space_info || {};
  // sr_info_parsed cycles these three fields: avatar_count holds light cones,
  // light_cone_count holds music, music_count holds characters (verified
  // against Enka's recordInfo and the account owner).
  const sign = (n) => `${ASSETS}icon/sign/${n}.png`;
  const tall = [
    ["Characters", s.music_count, "AvatarIcon"],
    ["Light Cones", s.avatar_count, "ShopLightConIcon"],
    ["Achievements", s.achievement_count, "AchievementIcon"],
  ];
  const wide = [
    ["Phonograph", s.light_cone_count, "JukeboxIcon"],
    ["Bookshelf", s.book_count, "BookIcon"],
  ];
  // omit a row's wrapper entirely when it has nothing to show — with
  // #col-cards giving each row flex:1 to fill the pane's height, an empty
  // wrapper would otherwise still claim its share as blank space
  const tallCards = tall.filter(([, v]) => v != null);
  const wideCards = wide.filter(([, v]) => v != null);
  $("col-cards").innerHTML =
    (tallCards.length
      ? `<div class="col-tall">${tallCards
          .map(([k, v, ic]) => `<div class="col-card tall"><img src="${sign(ic)}" alt=""><div class="cname">${k}</div><div class="cnum">${v}</div></div>`)
          .join("")}</div>`
      : "") +
    (wideCards.length
      ? `<div class="col-wide">${wideCards
          .map(([k, v, ic]) => `<div class="col-card wide"><img src="${sign(ic)}" alt=""><span><span class="cname">${k}</span><div class="cnum">${v}</div></span></div>`)
          .join("")}</div>`
      : "");
  $("player").classList.add("show");
}

/* The raw endpoint carries what the parsed one lacks: the assist/display
   slot split, head frame, personal card, and birthday. Best-effort. */
async function loadRawProfile(uid) {
  assistIds = new Set();
  applyCosmetics(null);
  try {
    const res = await fetch(`/api/raw/${uid}`);
    if (!res.ok) return;
    const text = await res.text();
    const raw = JSON.parse(text.replace(/[\u0000-\u001f]/g, " "));
    (raw.detailInfo?.assistAvatarList || []).forEach((a) => assistIds.add(String(a.avatarId)));
    applyCosmetics(raw.detailInfo);
  } catch {}
}

/* Head frame + personal card come only from the raw endpoint; StarRailRes
   has them as 128px item icons — the ring overlays crisply, the card art is
   blurred into an ambient backdrop so the low resolution never shows. */
function applyCosmetics(di) {
  // birthday arrives as month*100+day (903 = 9/3); 0/absent means unset
  const bd = Number(di?.birthday) || 0;
  $("p-bday").textContent = bd ? `Birthday ${Math.floor(bd / 100)}/${bd % 100}` : "";

  const frameId = di?.headFrameInfo?.itemId;
  $("avatar-wrap").classList.toggle("framed", !!frameId);
  if (frameId) {
    const img = $("p-frame");
    img.crossOrigin = "anonymous";
    img.onload = () => placeFrame(img);
    img.src = `${ASSETS}icon/item/${frameId}.png`;
  }

  const cardId = di?.personalCardId;
  const bg = $("p-card");
  bg.style.display = cardId ? "block" : "none";
  if (cardId) {
    bg.style.backgroundImage =
      `linear-gradient(rgba(21, 26, 44, 0.45), rgba(21, 26, 44, 0.7)), url(${ASSETS}icon/item/${cardId}.png)`;
  }
}

/* The avatar box is 96px; frames are scaled so their ring lands on a fixed
   32px-radius avatar circle (matching the 34px clip in CSS, which adds a 2px
   tuck under the band). FRAME_PX is the fallback size when a ring can't be
   measured. */
const WRAP = 96, RING_TARGET = 32, FRAME_PX = 99;

/* Locate a head frame's ring in its own icon so the avatar can be clipped to
   sit just under the band. Rays are cast outward from candidate centers; the
   first opaque pixel on each ray is the ring's inner edge. Decorations (the
   chess piece, gems) intrude on a few rays, so we keep only the rays near the
   median and pick the center whose kept rays vary least — a robust circle fit
   that ignores the intrusions. Returns { cx, cy, r } in icon pixels, or null
   if the icon can't be read (e.g. a cross-origin taint). */
function measureFrameRing(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;
  let data;
  try {
    const cv = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const cx = cv.getContext("2d");
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

/* Scale the frame so its measured ring lands on the fixed avatar circle, and
   position it so the ring is concentric with that circle. Scaling per frame
   (rather than clipping the avatar per frame) keeps the avatar one size across
   a whole series whose rings differ. Falls back to a plain centered frame at
   FRAME_PX when the ring can't be measured. */
function placeFrame(img) {
  const w = img.naturalWidth || 128, h = img.naturalHeight || 128;
  const ring = measureFrameRing(img);
  // k maps icon px -> display px so the ring's radius becomes RING_TARGET
  const k = ring ? RING_TARGET / ring.r : FRAME_PX / w;
  // the ring center (or icon center, as a fallback) sits at the wrap center
  const cx = ring ? ring.cx : w / 2, cy = ring ? ring.cy : h / 2;
  img.style.width = w * k + "px";
  img.style.height = h * k + "px";
  img.style.left = WRAP / 2 - cx * k + "px";
  img.style.top = WRAP / 2 - cy * k + "px";
}

/* Treasures Lightward via HoYoLAB (dummy-account session held server-side).
   Best-effort: no cookies, private target profile, or any error just hides
   the panel/tab. Fast-cleared floors carry no team data — that's upstream. */
const cleanFloorName = (s) => s.replace(/\)(\S)/, ") $1");
/* Floor names arrive with "Starward Mode" glued on ("…(XII)Starward Mode");
   split it off so the tier renders as a badge instead of mangled text. */
function splitStarward(name, tierce) {
  const sw = tierce || /Starward Mode\s*$/.test(name);
  return { name: cleanFloorName(name.replace(/\s*Starward Mode\s*$/, "")), sw };
}
let tlData = { aa: {}, moc: {}, pf: {}, as: {} };  // tlData[kind][cycle]; cycle "1"=current, "2"=previous
let tlCycle = "1";
let tlKind = null;
let csData = {};  // Cosmic Strife: csData[kind] = raw hoyolab payload

async function loadTreasures(uid) {
  ["endgame", "tl", "cs", "tl-stats"].forEach((id) => $(id).classList.remove("show"));
  tlData = { aa: {}, moc: {}, pf: {}, as: {} };
  csData = {};
  tlCycle = "1";
  tlKind = null;
  const kinds = ["aa", "moc", "pf", "as"];
  // base Simulated Universe worlds aren't part of this panel in-game — only
  // Currency Wars (internal name: Grid Fight), Divergent Universe, and the
  // three Expansion Module stories are.
  const csKinds = ["cw", "du"];
  await Promise.allSettled([
    ...kinds.flatMap((k) =>
      // Anomaly Arbitration (challenge_peak) has no schedule_type variants
      (k === "aa" ? ["1"] : ["1", "2"]).map(async (c) => {
        const res = await fetch(`/api/challenge/${k}/${uid}?schedule=${c}`);
        if (!res.ok) return;
        const { retcode, data } = await res.json();
        // stored whenever the query itself succeeded, even with zero
        // attempts — an untouched mode still gets its own tile/hero
        // (rendered as "No Data") instead of vanishing from the row
        if (retcode === 0 && data) tlData[k][c] = data;
      })
    ),
    ...csKinds.map(async (k) => {
      const res = await fetch(`/api/challenge/${k}/${uid}`);
      if (!res.ok) return;
      const { retcode, data } = await res.json();
      if (retcode === 0 && data) csData[k] = data;
    }),
  ]);
  const queried = kinds.filter((k) => tlData[k]["1"] || tlData[k]["2"]);
  const hasCS = buildCSOverview();
  if (!queried.length && !hasCS) { applyView(); return; }
  // no default selection — the tiles/hero render, but the Battle Stats
  // card stays hidden (see renderTL) until one is actually clicked
  if (queried.length) buildTLOverview();
  $("tl").classList.toggle("show", queried.length > 0);
  $("cs").classList.toggle("show", hasCS);
  $("endgame").classList.add("show");
  applyView();
  renderActivity(); // fills the theme names sr_activity leaves blank
}

/* Cosmic Strife, mirroring the in-game panel: a hero row per seasonal mode,
   then a medal tile per Expansion Module story. Currency Wars turned out to
   be internally named "Grid Fight" (found by sniffing hoyolab's own web app
   bundle, not by guessing endpoint names — /hkrpg/api/grid_fight). */
const CS_GLYPHS = { cw: "GridFightIcon", du: "DailyQuestRogueTournIcon" };

// mihomo/hoyolab expose a rank badge per mode (division for Currency Wars,
// season title for Divergent Universe) but no season branding name (e.g.
// "Zero-Sum Game") — the card leads with the mode name instead and treats
// the badge as a "Current Rank" chip, mirroring the in-game card's layout
// without inventing text we don't actually have.
function csHeroCard(kind, icon, title, rankLabel, rankIcon, rankText) {
  return `<div class="cs-hero-row">
      <div class="chr-icon-clip"><span class="chr-icon ${kind}"><img src="${icon}" alt=""></span></div>
      <div class="chr-main">
        <div class="chr-name">${title}</div>
        <div class="chr-rank">
          <span class="chr-rank-label">${rankLabel}</span>
          <span class="chr-rank-chip"><span class="chr-rank-icon" style="-webkit-mask-image:url('${rankIcon}');mask-image:url('${rankIcon}')"></span>${rankText}</span>
        </div>
      </div>
    </div>`;
}

function buildCSOverview() {
  const heroes = [];
  const cw = csData.cw?.grid_fight_brief;
  if (cw?.has_played) {
    heroes.push(csHeroCard(
      "cw", cw.division.icon, "Currency Wars", "Current Rank",
      `${ASSETS}icon/sign/${CS_GLYPHS.cw}.png`, cw.division.name_with_num
    ));
  }
  const du = csData.du?.basic;
  if (du?.normal_record_brief?.common_info_v2?.exist_data || Number(du?.season_level) > 0) {
    // falls back to the generic glyph only if a season is active but this
    // record brief has no icon yet
    const icon = du.normal_record_brief?.icon || `${ASSETS}icon/sign/${CS_GLYPHS.du}.png`;
    heroes.push(csHeroCard(
      "du", icon, "Divergent Universe", "Current Rank",
      `${ASSETS}icon/sign/${CS_GLYPHS.du}.png`, du.normal_record_brief?.title || "—"
    ));
  }
  $("cs-heroes").innerHTML = heroes.join("");

  $("cs-tiles").innerHTML = "";

  return heroes.length > 0;
}

const MODE_GLYPHS = { moc: "AbyssIcon01", pf: "ChallengeStory", as: "ChallengeBoss" };
const MODE_NAMES = { moc: "Memory of Chaos", pf: "Pure Fiction", as: "Apocalyptic Shadow" };
// a queried mode (see loadTreasures) can still have zero actual clears —
// this tells "never played" apart from "played, just nothing to show yet"
function hasAttempt(k) {
  if (k === "aa") return !!tlData.aa["1"]?.challenge_peak_records?.some((r) => r.has_challenge_record);
  return !!(tlData[k]["1"]?.has_data || tlData[k]["2"]?.has_data);
}
const ROMAN = { I: 1, V: 5, X: 10 };
/* "Academy Ghost Story (XII)" -> 12, "…: Difficulty 4" -> 4 */
function floorNumber(name) {
  const m = name.match(/\(([IVX]+)\)/);
  if (m) {
    let n = 0;
    for (let i = 0; i < m[1].length; i++) {
      const v = ROMAN[m[1][i]];
      n += v < (ROMAN[m[1][i + 1]] || 0) ? -v : v;
    }
    return n;
  }
  const d = name.match(/(\d+)\s*$/);
  return d ? Number(d[1]) : "";
}

/* The in-game overview: an Anomaly Arbitration hero banner, then one medal
   tile per Treasures Lightward mode. These are the mode selector — clicking
   one fills the detail area below. */
function buildTLOverview() {
  const aa = tlData.aa["1"];
  if (aa) {
    // the current-cycle record exists whether or not it's been attempted —
    // fall back to it (not {}) so the theme name/icon still show up on an
    // unattempted "No Data" card instead of the generic label
    const rec = aa.challenge_peak_records?.find((r) => r.has_challenge_record) || aa.challenge_peak_records?.[0] || {};
    const attempted = hasAttempt("aa");
    const g = rec.group || {};
    const brief = aa.challenge_peak_best_record_brief || {};
    // boss fight is worth 3 stars; pips mirror the in-game hero row
    const pips = [0, 1, 2]
      .map((i) => `<span class="pip${i < (Number(rec.boss_stars) || 0) ? " lit" : ""}">✦</span>`)
      .join("");
    $("tl-hero").innerHTML = `<button class="tl-hero-card${attempted ? "" : " no-data"}" data-kind="aa" role="tab" aria-pressed="false">
        <div class="th-main">
          <div>
            <div class="th-name">${g.name_mi18n || "Anomaly Arbitration"}</div>
            ${attempted ? `<div class="th-pips">${pips}</div>` : `<div class="th-nodata">No Data</div>`}
          </div>
          ${attempted ? (rec.boss_record?.has_challenge_record
            ? `<div class="th-num"><b>${rec.boss_record.round_num ?? 0}</b><span>Cycles</span></div>`
            : `<div class="th-num th-num-none">Not Attempted</div>`) : ""}
        </div>
        <div class="th-go">Go View ▸</div>
        ${(() => {
          const rankIcon = brief.challenge_peak_rank_icon || g.theme_pic_path;
          return rankIcon ? `<div class="th-icon-clip"><span class="th-icon"><img src="${rankIcon}" alt=""></span></div>` : "";
        })()}
      </button>`;
  } else {
    $("tl-hero").innerHTML = "";
  }

  $("tl-tiles").innerHTML = ["moc", "pf", "as"]
    .filter((k) => tlData[k]["1"] || tlData[k]["2"])
    .map((k) => {
      if (!hasAttempt(k)) {
        return `<button class="tl-tile no-data" data-kind="${k}" role="tab" aria-pressed="false">
            <span class="tt-name">${MODE_NAMES[k]}</span>
            <span class="tt-medal ${k}"><img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt=""></span>
            <span class="tt-bar tt-nodata">No Data</span>
          </button>`;
      }
      const d = tlData[k]["1"] || tlData[k]["2"];
      const top =
        d.all_floor_detail.find((f) => f.maze_id === d.max_floor_id) ||
        d.all_floor_detail[0] || {};
      const floor = splitStarward(top.name || d.max_floor || "", top.is_tierce);
      return `<button class="tl-tile" data-kind="${k}" role="tab" aria-pressed="false">
          <span class="tt-name">${(d.groups || [])[0]?.name_mi18n || ""}</span>
          <span class="tt-medal ${k}"><img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt=""></span>
          <span class="tt-bar">
            <img src="${ASSETS}icon/sign/${MODE_GLYPHS[k]}.png" alt="">
            ${floorNumber(floor.name)}
            <span class="stars">${"★".repeat((Number(top.star_num) || 0) - (Number(top.extra_star_num) || 0))}</span>
            ${floor.sw ? '<span class="sw xstar">✦</span>' : ""}
          </span>
        </button>`;
    })
    .join("");
}

/* A queried-but-unattempted mode/cycle: keep the cycle tabs live (a mode
   can be attempted on one cycle and not the other) but leave the rest of
   the panel empty with an explanatory notice instead of rendering
   floor/boss data that was never returned. */
function renderTLEmpty(kind) {
  $("tl-cycles").innerHTML = ["1", "2"]
    .map((c) => {
      const g = (tlData[kind][c]?.groups || [])[Number(c) - 1];
      const label = g?.name_mi18n || (c === "1" ? "Current" : "Previous");
      return `<button data-cycle="${c}" aria-pressed="${c === tlCycle}"${tlData[kind][c] ? "" : " disabled"}>${label}</button>`;
    })
    .join("");
  $("tl-sum").innerHTML = "";
  $("tl-bosses").innerHTML = "";
  $("tl-rows").innerHTML = `<div class="notice show">No data recorded for ${MODE_NAMES[kind]} yet.</div>`;
}

function renderTL(kind) {
  const freshKind = kind !== tlKind;
  tlKind = kind;
  document.querySelectorAll("#endgame [data-kind]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.kind === kind))
  );
  // hidden until a mode is actually picked — see loadTreasures
  $("tl-stats").classList.add("show");
  if (kind === "aa") return renderAA(tlData.aa["1"]);
  // prefer a cycle that's actually been played; only reconsider the cycle
  // when the kind itself just changed, so manually picking a "No Data"
  // cycle (e.g. to confirm it really has nothing) isn't immediately undone
  if (freshKind || !tlData[kind][tlCycle]) {
    tlCycle = tlData[kind]["1"]?.has_data ? "1" : tlData[kind]["2"]?.has_data ? "2" : tlData[kind]["1"] ? "1" : "2";
  }
  const data = tlData[kind][tlCycle];
  if (!data?.has_data) return renderTLEmpty(kind);
  // groups[] lists schedules newest-first, so the requested cycle is at index
  // cycle-1; its begin/end are the cycle dates (top-level ones can be stale)
  const groups = data.groups || [];
  $("tl-cycles").innerHTML = ["1", "2"]
    .map((c) => {
      const g = groups[Number(c) - 1];
      const label = g?.name_mi18n || (c === "1" ? "Current" : "Previous");
      return `<button data-cycle="${c}" aria-pressed="${c === tlCycle}"${tlData[kind][c] ? "" : " disabled"}${g?.status ? ` title="${g.status}"` : ""}>${label}</button>`;
    })
    .join("");
  const grp = groups[Number(tlCycle) - 1] || {};
  const b = grp.begin_time || data.begin_time, e = grp.end_time || data.end_time;
  $("tl-sum").innerHTML =
    // star_num already includes the Starward bonus star(s) — split it back
    // out so the ✦ isn't counted twice
    `<span>Stars <b>★ ${Number(data.star_num) - (Number(data.extra_star_num) || 0)}${Number(data.extra_star_num) ? " " + '<span class="xstar">✦</span>'.repeat(Number(data.extra_star_num)) : ""}</b></span>` +
    `<span>Attempts <b>${data.battle_num}</b></span>` +
    (b && e ? `<span>Cycle <b>${b.month}/${b.day} – ${e.month}/${e.day}</b></span>` : "");

  const strip = [];
  for (const [label, boss] of [["Node 1", grp.upper_boss], ["Node 2", grp.lower_boss], ["Starward", grp.tierce_boss]]) {
    if (!boss) continue;
    strip.push(`<div class="boss${label === "Starward" ? " tierce" : ""}">
        <img src="${boss.icon}" alt="">
        <span><span class="bl">${label === "Starward" ? "✦ Starward" : label}</span><span class="bn">${boss.name_mi18n}</span></span>
      </div>`);
  }
  $("tl-bosses").innerHTML = strip.join("");
  // show only the deepest cleared stage; the full list stays in tlData if
  // an "all stages" view is ever wanted again
  const topFloor =
    data.all_floor_detail.find((f) => f.maze_id === data.max_floor_id) ||
    data.all_floor_detail[0];
  $("tl-rows").innerHTML = [topFloor]
    .filter(Boolean)
    .map((f) => {
      const nodes = ["node_1", "node_2", "node_3"]
        .map((k, i) => ({ n: f[k], i }))
        .filter(({ n }) => n?.avatars?.length);
      const score = nodes.reduce((s, { n }) => s + (Number(n.score) || 0), 0);
      const clear =
        kind === "moc"
          ? f.is_fast ? "fast clear" : f.round_num ? f.round_num + " cycles" : ""
          : score ? "total score " + score.toLocaleString() : f.is_fast ? "fast clear" : "";
      const floor = splitStarward(f.name, f.is_tierce);
      const cards = nodes
        .map(({ n, i }) => {
          // in Starward mode the third team is the one that fights the tierce boss
          const sw = f.is_tierce && i === 2;
          const roster = n.avatars
            .map((a) => `<span class="tc-av"><img src="${a.icon}" alt=""><span>Lv ${a.level}</span></span>`)
            .join("");
          const bf = n.buff;
          const tip = bf ? `${bf.name_mi18n}: ${bf.desc_mi18n || ""}`.replace(/"/g, "&quot;") : "";
          const meta = [];
          if (Number(n.score)) meta.push("score " + Number(n.score).toLocaleString());
          const t = n.challenge_time;
          if (t) meta.push(`${t.month}/${t.day}`);
          return `<div class="team-card${sw ? " tierce" : ""}">
            <div class="tc-head">
              <span class="tc-label">${sw ? "✦ Starward · Team 3" : "Team " + (i + 1)}</span>
              ${meta.length ? `<span class="tc-meta">${meta.join(" · ")}</span>` : ""}
            </div>
            <div class="tc-roster">${roster}</div>
            ${bf ? `<div class="tc-buff" title="${tip}"><img src="${bf.icon}" alt="">${bf.name_mi18n}</div>` : ""}
          </div>`;
        })
        .join("");
      return `<div class="act-row moc-row tl-top">
        <span class="floor">${floor.name}${floor.sw ? '<span class="sw-chip">✦ Starward</span>' : ""}</span>
        <span class="stars-sm">${"★".repeat((Number(f.star_num) || 0) - (Number(f.extra_star_num) || 0))}${'<span class="xstar">✦</span>'.repeat(Number(f.extra_star_num) || 0)}</span>
        <span class="when">${clear}</span>
      </div>
      <div class="team-cards">${cards}</div>`;
    })
    .join("");
}

/* Anomaly Arbitration (challenge_peak) has its own shape: one themed record
   with three "Knight" mob stages plus a boss, and a mob/boss star split
   instead of per-floor stars. */
function renderAA(data) {
  // the record (theme, monsters, boss) exists whether or not it's been
  // attempted — fall back to the entry itself, not {}, so an unattempted
  // theme still shows what it is instead of a blank "Current" placeholder
  const records = data.challenge_peak_records || [];
  const rec = records.find((r) => r.has_challenge_record) || records[0] || {};
  const attempted = !!rec.has_challenge_record;
  const g = rec.group || {};
  const brief = data.challenge_peak_best_record_brief || {};
  $("tl-cycles").innerHTML =
    `<button data-cycle="1" aria-pressed="true"${g.status ? ` title="${g.status}"` : ""}>${g.name_mi18n || "Current"}</button>`;

  const b = g.begin_time, e = g.end_time;
  const rank = (brief.challenge_peak_rank_icon_type || "").replace("ChallengePeakRankIconType", "");
  $("tl-sum").innerHTML =
    `<span>Stages <b>★ ${rec.mob_stars ?? 0}</b></span>` +
    `<span>Boss <b>★ ${rec.boss_stars ?? 0}</b></span>` +
    `<span>Attempts <b>${rec.battle_num ?? 0}</b></span>` +
    (b && e ? `<span>Cycle <b>${b.month}/${b.day} – ${e.month}/${e.day}</b></span>` : "") +
    (rank ? `<span>Rank <b class="rank"><img class="aa-rank" src="${brief.challenge_peak_rank_icon}" alt="">${rank}</b></span>` : "");

  const mobs = rec.mob_infos || [];
  const strip = mobs.map((m) => `<div class="boss">
      <img src="${m.monster_icon}" alt="">
      <span><span class="bl">${m.name}</span><span class="bn">${m.monster_name}</span></span>
    </div>`);
  const bi = rec.boss_info;
  if (bi) {
    strip.push(`<div class="boss tierce">
      <img src="${bi.icon}" alt=""${bi.hard_mode_name_mi18n ? ` title="Hard mode: ${bi.hard_mode_name_mi18n}"` : ""}>
      <span><span class="bl">Boss</span><span class="bn">${bi.name_mi18n}</span></span>
    </div>`);
  }
  $("tl-bosses").innerHTML = strip.join("");

  const roster = (avs) => (avs || [])
    .map((a) => `<span class="tc-av"><img src="${a.icon}" alt=""><span>Lv ${a.level}</span></span>`)
    .join("");
  // 3 stars always render — earned ones lit, the rest dimmed — rather than
  // just fewer characters, so a 2/3 clear still shows what's missing
  const starPips = (n) =>
    Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? "" : "dim"}">★</span>`).join("");
  const stageCards = mobs
    .map((m) => ({ m, r: (rec.mob_records || []).find((x) => x.maze_id === m.maze_id) }))
    .filter(({ r }) => r?.has_challenge_record && r.avatars?.length)
    .map(({ m, r }) => `<div class="team-card">
      <div class="tc-head">
        <span class="tc-label">${m.name}</span>
        <span class="stars-sm">${starPips(Number(r.star_num) || 0)}</span>
        ${r.challenge_time ? `<span class="tc-meta">${r.challenge_time.month}/${r.challenge_time.day}</span>` : ""}
      </div>
      <div class="tc-roster">${roster(r.avatars)}</div>
    </div>`);
  const br = rec.boss_record;
  if (br?.has_challenge_record && br.avatars?.length) {
    stageCards.push(`<div class="team-card tierce">
      <div class="tc-head">
        <span class="tc-label">✦ Boss</span>
        <span class="stars-sm">${starPips(Number(br.star_num) || 0)}</span>
        ${br.challenge_time ? `<span class="tc-meta">${br.challenge_time.month}/${br.challenge_time.day}</span>` : ""}
      </div>
      <div class="tc-roster">${roster(br.avatars)}</div>
    </div>`);
  }
  $("tl-rows").innerHTML = attempted
    ? `<div class="team-cards">${stageCards.join("")}</div>`
    : `<div class="notice show">No data recorded for Anomaly Arbitration yet.</div>`;
}

$("tl-hero").onclick = $("tl-tiles").onclick = (ev) => {
  const b = ev.target.closest("[data-kind]");
  if (b) renderTL(b.dataset.kind);
};
/* cursor-tracking tilt on the light cone card (listeners live on the
   persistent container because the img is rebuilt per character) */
$("c-lc-art").addEventListener("mousemove", (ev) => {
  const img = ev.target.closest(".lc-icon");
  if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = img.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width - 0.5;
  const py = (ev.clientY - r.top) / r.height - 0.5;
  img.style.transform =
    `perspective(600px) rotateY(${(px * 16).toFixed(2)}deg) rotateX(${(-py * 16).toFixed(2)}deg) scale(1.04)`;
});
$("c-lc-art").addEventListener("mouseleave", () => {
  const img = $("c-lc-art").querySelector(".lc-icon");
  if (img) img.style.transform = "";
});

$("p-uid").onclick = async () => {
  const uid = data?.player?.uid;
  if (!uid) return;
  try {
    await navigator.clipboard.writeText(String(uid));
    $("p-uid").textContent = "Copied!";
    setTimeout(() => { $("p-uid").textContent = `UID ${uid}`; }, 1200);
  } catch {}
};
$("tl-cycles").onclick = (ev) => {
  const b = ev.target.closest("button[data-cycle]");
  if (!b || b.disabled) return;
  tlCycle = b.dataset.cycle;
  if (tlKind) renderTL(tlKind);
};

/* The activity feed is best-effort: its endpoint queue-times-out more often
   than the showcase one, so a failure hides the panel instead of erroring. */
let activityInfo = null;

async function loadActivity(uid) {
  $("activity").classList.remove("show");
  activityInfo = null;
  try {
    const res = await fetch(`/api/activity/${uid}?lang=en`);
    if (!res.ok) return;
    const text = await res.text();
    const { info } = JSON.parse(text.replace(/[\u0000-\u001f]/g, " "));
    if (!info?.length) return;
    activityInfo = info;
    renderActivity();
  } catch {}
}

/* sr_activity leaves the theme name blank for the Treasures Lightward modes
   ("Completed Forgotten Hall: ") while filling it for others — patch it from
   the HoYoLAB records by matching the entry's age against each cycle's
   actual clear timestamps. Re-run when either data source arrives. */
const ACT_MODES = { "Forgotten Hall": "moc", "Memory of Chaos": "moc", "Pure Fiction": "pf", "Apocalyptic Shadow": "as" };

function themeForClear(kind, daysAgo) {
  const now = Date.now();
  const toMs = (ct) => ct?.year && new Date(ct.year, ct.month - 1, ct.day, ct.hour || 0, ct.minute || 0).getTime();
  let best = null;
  const inWindow = [];
  for (const c of ["1", "2"]) {
    const d = tlData[kind]?.[c];
    const g = (d?.groups || [])[Number(c) - 1] || {};
    if (!d || !g.name_mi18n) continue;
    // best case: the cycle's latest recorded node clear lands on the entry's age
    let t = 0;
    for (const f of d.all_floor_detail || [])
      for (const k of ["node_1", "node_2", "node_3"]) t = Math.max(t, toMs(f[k]?.challenge_time) || 0);
    if (t) {
      // "N day(s) ago" is rounded, so allow a day and a half of slack
      const diff = Math.abs((now - t) / 86400000 - daysAgo);
      if (diff <= 1.5 && (!best || diff < best.diff)) best = { name: g.name_mi18n, diff };
    }
    // fallback candidate: the event date falls inside this cycle's schedule
    // (the "Completed" event can come from a later re-clear the best-record
    // timestamps don't cover)
    const ev = now - daysAgo * 86400000;
    const b = toMs(g.begin_time), e = toMs(g.end_time);
    if (b && e && ev >= b - 43200000 && ev <= e + 43200000) inWindow.push(g.name_mi18n);
  }
  return best?.name || (inWindow.length === 1 ? inWindow[0] : undefined);
}

/* mihomo's activity feed still names Divergent Universe season icons
   "RogueTourmS<n>" (missing the "n"). StarRailRes kept that typo only for
   the original season 1 asset and corrected the spelling from season 2
   on, so any later season 404s unless corrected here. */
function fixActivityIcon(icon) {
  return icon.replace(/^icon\/sign\/RogueTourmS([2-9]\d*)\.png$/, "icon/sign/RogueTournS$1.png");
}

function renderActivity() {
  if (!activityInfo) return;
  $("activity-rows").innerHTML = activityInfo
    .map((a) => {
      const m = a.text.match(/^(.+? ago|Today|Yesterday):\s*(.*)$/);
      const when = (m ? m[1] : "").replace(/(\d+) day\(s\)/, (_, n) => n + (n === "1" ? " day" : " days"));
      let what = m ? m[2] : a.text;
      const gap = what.match(/^Completed (Forgotten Hall|Memory of Chaos|Pure Fiction|Apocalyptic Shadow):\s*$/);
      if (gap) {
        const theme = themeForClear(ACT_MODES[gap[1]], parseInt(when) || 0);
        what = theme ? `${what.trim()} ${theme}` : what.replace(/:\s*$/, "");
      }
      return `<div class="act-row">
        <img src="${ASSETS + fixActivityIcon(a.content.icon)}" alt="">
        <span>${what}</span>
        <span class="when">${when}</span>
      </div>`;
    })
    .join("");
  $("activity").classList.add("show");
}

// showcase slot counts are fixed in-game (3 support, 5 display) — padding
// out to these with blank cards keeps the grid a consistent size instead
// of reflowing/enlarging when a profile hasn't filled every slot
const MAX_SUPPORT = 3;
const MAX_DISPLAY = 5;

function renderRoster(chars) {
  const support = [], display = [];
  chars.forEach((c, i) => (assistIds.has(String(c.id)) ? support : display).push([c, i]));
  const card = ([c, i]) => `<button class="char-card${c.rarity < 5 ? " r4" : ""}" role="tab"
      aria-pressed="false" data-i="${i}" title="${c.name}">
      <span class="cc-eid"><i class="eid-glyph"></i><b class="eid-num">${c.rank}</b></span>
      <img class="cc-art" src="${ASSETS + c.preview}" alt="" loading="lazy">
      <span class="cc-name">${c.name}</span>
      <span class="cc-lv">Lv. ${c.level}</span>
    </button>`;
  const blankCard = `<div class="char-card blank" aria-hidden="true"><span class="cc-art"></span></div>`;
  const padded = (list, max) => list.map(card).join("") + blankCard.repeat(Math.max(0, max - list.length));
  $("sec-support").style.display = support.length ? "" : "none";
  $("cards-support").innerHTML = padded(support, MAX_SUPPORT);
  $("cards-display").innerHTML = padded(display, MAX_DISPLAY);
  document.querySelectorAll(".char-card[data-i]").forEach((b) => {
    b.onclick = () => selectChar(Number(b.dataset.i));
  });
}

function selectChar(i) {
  const c = data.characters[i];
  document.querySelectorAll(".char-card").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i))
  );

  $("stage").style.setProperty("--aura", ELEMENT_AURA[c.element.name] || ELEMENT_AURA.Quantum);
  $("c-portrait").src = ASSETS + c.portrait;
  $("c-portrait").alt = c.name;
  $("c-element").src = ASSETS + c.element.icon;
  $("c-element").alt = c.element.name;
  $("c-element").title = c.element.name;
  $("c-path").src = ASSETS + c.path.icon;
  $("c-path").alt = c.path.name;
  $("c-path").title = "Path of " + c.path.name;
  $("c-eidolon").textContent = "E" + c.rank;

  currentChar = i;
  $("c-name").textContent = c.name;
  const stars = $("c-stars");
  stars.textContent = "★".repeat(c.rarity);
  stars.classList.toggle("r4", c.rarity < 5);
  $("c-lv").textContent = `Lv ${c.level} / ${20 + c.promotion * 10}`;

  renderLightCone(c.light_cone);

  $("c-stats").innerHTML = mergeStats(c)
    .map((s) => `<div class="stat"><span class="k">${s.icon ? `<img src="${ASSETS + s.icon}" alt="">` : ""}<span>${s.name}</span></span><span class="v">${s.display}</span></div>`)
    .join("");

  $("c-traces").innerHTML = renderTraceTree(c);

  renderEidolons(c);

  // relic.type: 1 Head, 2 Hands, 3 Body, 4 Feet, 5 Planar Sphere, 6 Link
  // Rope — reorder into the requested Head/Body/Rope over Hands/Feet/Orb
  // grid instead of the API's native 1-2-3-4-5-6 slot order
  const RELIC_SLOT_ORDER = [1, 3, 6, 2, 4, 5];
  $("c-relics").innerHTML = (c.relics || [])
    .slice()
    .sort((a, b) => RELIC_SLOT_ORDER.indexOf(a.type) - RELIC_SLOT_ORDER.indexOf(b.type))
    .map((r) => {
      const subs = (r.sub_affix || [])
        .map((a) => {
          // count = rolls; step = bonus increments over the minimum (each
          // roll lands low/mid/high = +0/+1/+2), so step/(2·count) grades
          // how high the rolls landed overall
          const q = a.count ? a.step / (2 * a.count) : 0;
          const tip = `${a.count} roll${a.count > 1 ? "s" : ""} · ${Math.round(q * 100)}% of max`;
          // upgrade rolls beyond the initial one (a relic gets 5 across its subs)
          const extra = a.count - 1;
          return `<span>${a.name}</span><i class="rolls" title="${tip}">${">".repeat(extra)}</i><b>+${a.display}</b>`;
        })
        .join("");
      return `<div class="relic" title="${r.name} · ${r.set_name}">
        <div class="top">
          <img src="${ASSETS + r.icon}" alt="">
          <span class="mk">${r.main_affix.name}</span>
          <span class="mv">${r.main_affix.display}</span>
          <span class="lv r${r.rarity}">+${r.level}</span>
        </div>
        <div class="subs">${subs}</div>
      </div>`;
    })
    .join("");

  $("detail").classList.add("show");
}

/* Eidolon names/descriptions aren't in the Mihomo payload; StarRailRes
   indexes them by character id + zero-padded rank ("141301" = 1413 E1).
   Fetched once at boot; tooltips fall back to "Eidolon N" until it lands. */
let ranksIndex = null;
fetch(ASSETS + "index_min/en/character_ranks.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    ranksIndex = j;
    if (data) renderEidolons(data.characters[currentChar]);
  })
  .catch(() => {});

function renderEidolons(c) {
  $("c-eidolons").innerHTML = (c.rank_icons || [])
    .map((icon, i) => {
      const locked = i >= c.rank;
      const info = ranksIndex?.[String(c.id) + String(i + 1).padStart(2, "0")];
      const name = `E${i + 1}${info ? " · " + info.name : ""}`;
      const desc = info ? resolveTemplate(info.desc, info.params?.[0]) : "";
      // custom hover tooltip (see #trace-tip / the mouseover delegate) —
      // same shared element traces use, keyed off the same data attrs
      return `<div class="eido${locked ? " locked" : ""}"
          data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc)}">
        <img src="${ASSETS + icon}" alt="Eidolon ${i + 1}">
      </div>`;
    })
    .join("");
}

/* Light cone passive (name + Superimposition-scaled desc) isn't in the
   Mihomo payload either — StarRailRes indexes it by light cone id, with
   one params row per superimposition rank (1-5). Fetched once at boot;
   the tooltip lands once this resolves. */
let lcRanksIndex = null;
fetch(ASSETS + "index_min/en/light_cone_ranks.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    lcRanksIndex = j;
    if (data) renderLightCone(data.characters[currentChar].light_cone);
  })
  .catch(() => {});

function renderLightCone(lc) {
  if (!lc) {
    $("c-lc-art").innerHTML = `<div class="none">No light cone equipped</div>`;
    return;
  }
  const info = lcRanksIndex?.[String(lc.id)];
  const name = `${lc.name} · S${lc.rank}`;
  // the passive's own name sits as a heading above its description,
  // rather than crowding the tooltip's name line
  const desc = info
    ? `<b class="tt-ability">${escHtml(info.skill)}</b>\n${resolveTemplate(info.desc, info.params?.[lc.rank - 1])}`
    : "";
  // same shared hover tooltip as traces/eidolons (see #trace-tip)
  $("c-lc-art").innerHTML =
    `<img class="lc-icon" src="${ASSETS + (lc.preview || lc.icon)}" alt="" loading="lazy"
        data-tip-name="${escAttr(name)}" data-tip-desc="${escAttr(desc)}">
      <div>
        <div class="lc-name">${lc.name}</div>
        <span class="stars${lc.rarity < 5 ? " r4" : ""}">${"★".repeat(lc.rarity)}</span>
        <div class="lc-meta">Lv ${lc.level} · S${lc.rank}</div>
      </div>`;
}

/* Final stats = base attributes + additions, merged by field. */
function mergeStats(c) {
  const map = new Map();
  for (const a of c.attributes) map.set(a.field, { ...a });
  for (const a of c.additions) {
    const cur = map.get(a.field);
    if (cur) cur.value += a.value;
    else map.set(a.field, { ...a });
  }
  const fmt = (s) => ({
    ...s,
    name: s.name.replace(/^Base /, ""),
    display: s.percent ? (s.value * 100).toFixed(1) + "%" : String(Math.floor(s.value)),
  });
  const ordered = STAT_ORDER.map((f) => map.get(f)).filter(Boolean).map(fmt);
  const rest = [...map.entries()]
    .filter(([f]) => !STAT_ORDER.includes(f))
    .map(([, s]) => fmt(s))
    .filter((s) => s.value > 0.0001);
  return [...ordered, ...rest];
}

/* ---------------- trace tooltip ----------------
   One shared element for every .tn (there can be 20+ per character) —
   repositioned and refilled on hover rather than giving each node its
   own tooltip. Delegated on document since .tn nodes get replaced
   wholesale every time a character is selected. */
const traceTip = $("trace-tip");
let traceTipTarget = null;

function positionTraceTip(target) {
  const r = target.getBoundingClientRect();
  const tip = traceTip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tip.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));
  // prefer above the node; flip below if that would run off the top
  let top = r.top - tip.height - 8;
  if (top < 8) top = r.bottom + 8;
  traceTip.style.left = `${left}px`;
  traceTip.style.top = `${top}px`;
}

// the tooltip sits a few px off the node (never overlapping it, so the
// node itself stays fully visible), so moving the cursor from one to the
// other briefly crosses neither element — a plain "did we leave the
// node" check would hide the tooltip right as the mouse heads toward it,
// which is exactly what made a scrollable tooltip unreachable. A short
// grace period, cancelled if the cursor lands on either the node or the
// tooltip before it fires, covers that gap.
let hideTipTimer = null;

function showTraceTip(tn) {
  clearTimeout(hideTipTimer);
  if (tn === traceTipTarget) return;
  traceTipTarget = tn;
  $("trace-tip-name").textContent = tn.dataset.tipName;
  // safe: every desc that reaches here was already run through escHtml
  // before any intentional <b> markup (highlighted numbers, ability
  // names) got added — see resolveTemplate and the skillDescByIcon build
  $("trace-tip-desc").innerHTML = tn.dataset.tipDesc;
  traceTip.classList.add("show");
  positionTraceTip(tn);
}
function scheduleHideTraceTip() {
  clearTimeout(hideTipTimer);
  hideTipTimer = setTimeout(() => {
    traceTipTarget = null;
    traceTip.classList.remove("show");
  }, 150);
}

document.addEventListener("mouseover", (e) => {
  const tn = e.target.closest("[data-tip-name]");
  if (tn) { showTraceTip(tn); return; }
  if (traceTip.contains(e.target)) clearTimeout(hideTipTimer);
});
document.addEventListener("mouseout", (e) => {
  if (!traceTipTarget) return;
  if (e.target.closest("[data-tip-name]") === traceTipTarget || traceTip.contains(e.target)) {
    scheduleHideTraceTip();
  }
});
// the node's own position can shift under the cursor (e.g. a character
// switch redraws the tree) — hide rather than leave a stale tooltip stuck.
// Capture-phase on window sees scroll events from ANY descendant, not
// just the page itself — scroll (unlike most events) doesn't bubble, but
// capture-phase dispatch still walks down to it — so this must check the
// target is really the document, or scrolling the tooltip's own
// description even once immediately hides the tooltip that's showing it.
window.addEventListener("scroll", (e) => {
  if (e.target !== document && e.target !== window) return;
  if (traceTipTarget) {
    clearTimeout(hideTipTimer);
    traceTipTarget = null;
    traceTip.classList.remove("show");
  }
}, true);
// Always drive .tt-desc's scroll from the *prospective* position (current
// + this event's delta) rather than only intervening once already sitting
// at an edge: a single tick can cross straight past the edge within one
// event — the browser consumes what room is left and hands the remainder
// to the page before any "am I at the edge yet" check would even run
// again — so only the prospective check catches that crossing tick too.
function wheelScrollTraceTip(e) {
  const desc = $("trace-tip-desc");
  const max = desc.scrollHeight - desc.clientHeight;
  if (max <= 0) return false; // nothing to scroll — let the page behave normally
  e.preventDefault();
  desc.scrollTop = Math.max(0, Math.min(max, desc.scrollTop + e.deltaY));
  return true;
}
// covers the tooltip itself — a wheel tick over the name header, or the
// padding/border around either, is still a tick over the tooltip, and
// .trace-tip has no overflow of its own to consume it otherwise
traceTip.addEventListener("wheel", wheelScrollTraceTip, { passive: false });
// ...and covers the trace icon the tooltip is describing, so scrolling
// doesn't require first nudging the mouse those last few px onto the
// tooltip itself — natural given the tooltip only shows because this
// icon is hovered. Delegated (icons get replaced wholesale on every
// character switch) and only while that icon still owns the tooltip.
document.addEventListener("wheel", (e) => {
  if (traceTipTarget && e.target.closest("[data-tip-name]") === traceTipTarget) wheelScrollTraceTip(e);
}, { passive: false });

/* ---------------- boot ---------------- */

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const uid = $("uid").value.trim();
  if (uid) load(uid);
});

// a bare URL opens on the intro screen; a UID hash (#800333171) deep-links
// straight to that profile so links can be shared and bookmarked
const fromHash = location.hash.replace("#", "");
if (/^\d{9,10}$/.test(fromHash)) {
  $("uid").value = fromHash;
  load(fromHash);
}

