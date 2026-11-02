// Mobile menu
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("primary-nav");

function setMenu(open) {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  nav.classList.toggle("open", open);
}

toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); toggle.focus(); } });

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Match feed — reads the Supabase tables and updates as soon as they change.
// Edit the data with the SQL files in supabase/ (see README.md).
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://jzhoabqjxklsmnhycwcb.supabase.co";
const SUPABASE_KEY = "sb_publishable_eNLKMAli0vBA9xlovsL5iw_6nzIpvX9";   // public, read-only key
const SHOW_AFTER_START_MS = 3 * 60 * 60 * 1000;   // upcoming matches stay listed 3h after start
const REFETCH_MS = 5 * 60 * 1000;                 // fallback in case the live connection drops
const MAX_RESULTS = 5;

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

let feed = null;   // { card, upcoming, results }
let feedError = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function emptyRow(text) {
  return el("li", "empty", text);
}

function when(date) {
  return `${dayFmt.format(date)} · ${timeFmt.format(date)}`;
}

function upcomingRow(m) {
  const start = new Date(m.starts_at);
  const li = el("li", m.cancelled ? "is-cancelled" : null);
  li.append(el("span", "m-date", dayFmt.format(start)));
  const main = el("span", "m-main");
  main.append(el("strong", null, `vs ${m.opponent}`));
  main.append(el("small", null, [m.event, m.format].filter(Boolean).join(" · ")));
  li.append(main);
  li.append(m.cancelled
    ? el("span", "m-cancelled", "Cancelled")
    : el("span", "m-time", timeFmt.format(start)));
  return li;
}

function resultRow(r) {
  const li = el("li");
  li.append(el("span", "m-date", dayFmt.format(new Date(r.played_at))));
  const main = el("span", "m-main");
  main.append(el("strong", null, `vs ${r.opponent}`));
  main.append(el("small", null, [r.event, r.map].filter(Boolean).join(" · ")));
  li.append(main);
  const a = r.aqua_score, b = r.opponent_score;
  const result = a > b ? "W" : a < b ? "L" : "D";
  const right = el("span", "m-result");
  right.append(el("b", null, `${a}–${b}`));
  right.append(el("em", `r-${result.toLowerCase()}`, result));
  li.append(right);
  return li;
}

function renderCard(card) {
  const set = (id, text) => { document.getElementById(id).textContent = text; };
  const whenEl = document.getElementById("nm-when");
  const state = card ? card.state : "none";
  whenEl.classList.toggle("m-live", state === "live");

  if (state === "live") {
    set("nm-when", "Live now");
  } else if (state === "upcoming") {
    set("nm-when", card.starts_at ? when(new Date(card.starts_at)) : "TBA");
  } else {
    set("nm-when", "TBA");
  }

  if (state === "none") {
    set("nm-opponent", "TBA");
    set("nm-event", "No match scheduled");
    set("nm-format", "—");
  } else {
    set("nm-opponent", card.opponent || "TBA");
    set("nm-event", card.event || "—");
    set("nm-format", card.format || "—");
  }
}

function renderFeed() {
  const upList = document.getElementById("upcoming-list");
  const resList = document.getElementById("results-list");

  if (!feed) {
    const msg = feedError ? "Couldn't load matches. Try refreshing." : "Loading…";
    upList.replaceChildren(emptyRow(msg));
    resList.replaceChildren(emptyRow(msg));
    document.getElementById("nm-when").textContent = feedError ? "Unavailable" : "Loading…";
    return;
  }

  const now = Date.now();
  const upcoming = feed.upcoming.filter((m) => now - new Date(m.starts_at) < SHOW_AFTER_START_MS);

  upList.replaceChildren(...(upcoming.length ? upcoming.map(upcomingRow) : [emptyRow("No matches scheduled. Check back soon.")]));
  resList.replaceChildren(...(feed.results.length ? feed.results.map(resultRow) : [emptyRow("No results yet.")]));
  renderCard(feed.card);
}

async function loadFeed() {
  try {
    if (!db) throw new Error("Supabase library didn't load");
    const [card, upcoming, results] = await Promise.all([
      db.from("match_card").select("*").eq("id", 1).maybeSingle(),
      db.from("upcoming_matches").select("*").order("starts_at"),
      db.from("recent_results").select("*").order("played_at", { ascending: false }).limit(MAX_RESULTS),
    ]);
    const failed = [card, upcoming, results].find((r) => r.error);
    if (failed) throw failed.error;
    feed = { card: card.data, upcoming: upcoming.data, results: results.data };
    feedError = false;
  } catch (err) {
    console.error("Match feed failed to load:", err);
    if (!feed) feedError = true;   // keep showing the last good data if we had some
  }
  renderFeed();
}

// Refetch whenever any of the tables change
let reloadTimer;
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(loadFeed, 300);
}

if (db) {
  const channel = db.channel("match-feed");
  for (const table of ["match_card", "upcoming_matches", "recent_results"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload);
  }
  channel.subscribe();
}

loadFeed();
setInterval(loadFeed, REFETCH_MS);
setInterval(renderFeed, 60 * 1000);   // drops matches off the Upcoming list as time passes
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadFeed(); });
