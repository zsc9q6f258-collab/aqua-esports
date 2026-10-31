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
// Match feed — reads data/matches.json and keeps the schedule current.
// See README.md for the file format.
// ---------------------------------------------------------------------------
const FEED_URL = "data/matches.json";
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;   // a match counts as live for 3h after start
const REFETCH_MS = 5 * 60 * 1000;            // pull new data every 5 minutes
const MAX_RESULTS = 5;

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

let matches = null;
let feedError = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function resultFromScore(score) {
  const [a, b] = String(score).split(/[-–:]/).map((n) => parseInt(n, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  return a > b ? "W" : a < b ? "L" : "D";
}

function normalize(raw) {
  return (raw.matches || [])
    .map((m) => ({ ...m, start: new Date(m.date) }))
    .filter((m) => {
      if (Number.isNaN(m.start.getTime())) { console.warn("Skipping match with a bad date:", m); return false; }
      return true;
    });
}

function emptyRow(text) {
  const li = el("li", "empty");
  li.textContent = text;
  return li;
}

function upcomingRow(m, now) {
  const li = el("li");
  li.append(el("span", "m-date", dayFmt.format(m.start)));
  const main = el("span", "m-main");
  main.append(el("strong", null, `vs ${m.opponent || "TBA"}`));
  main.append(el("small", null, [m.event, m.format].filter(Boolean).join(" · ")));
  li.append(main);
  li.append(now >= m.start
    ? el("span", "m-live", "Live")
    : el("span", "m-time", timeFmt.format(m.start)));
  return li;
}

function resultRow(m) {
  const li = el("li");
  li.append(el("span", "m-date", dayFmt.format(m.start)));
  const main = el("span", "m-main");
  main.append(el("strong", null, `vs ${m.opponent || "TBA"}`));
  main.append(el("small", null, [m.event, m.map].filter(Boolean).join(" · ")));
  li.append(main);
  const right = el("span", "m-result");
  if (m.score) {
    const result = (m.result || resultFromScore(m.score)).toUpperCase();
    right.append(el("b", null, String(m.score).replace("-", "–")));
    if (result) right.append(el("em", `r-${result.toLowerCase()}`, result));
  } else {
    right.append(el("em", "r-pending", "Pending"));
  }
  li.append(right);
  return li;
}

function renderFeed() {
  const upList = document.getElementById("upcoming-list");
  const resList = document.getElementById("results-list");
  const set = (id, text) => { document.getElementById(id).textContent = text; };

  if (!matches) {
    const msg = feedError ? "Couldn't load matches. Try refreshing." : "Loading…";
    upList.replaceChildren(emptyRow(msg));
    resList.replaceChildren(emptyRow(msg));
    set("nm-when", feedError ? "Unavailable" : "Loading…");
    return;
  }

  const now = new Date();
  const done = (m) => m.score != null && m.score !== "";
  const upcoming = matches
    .filter((m) => !done(m) && now - m.start < LIVE_WINDOW_MS)
    .sort((a, b) => a.start - b.start);
  const results = matches
    .filter((m) => done(m) || now - m.start >= LIVE_WINDOW_MS)
    .sort((a, b) => b.start - a.start)
    .slice(0, MAX_RESULTS);

  upList.replaceChildren(...(upcoming.length ? upcoming.map((m) => upcomingRow(m, now)) : [emptyRow("No matches scheduled. Check back soon.")]));
  resList.replaceChildren(...(results.length ? results.map(resultRow) : [emptyRow("No results yet.")]));

  const next = upcoming[0];
  if (next) {
    set("nm-when", now >= next.start ? "Live now" : `${dayFmt.format(next.start)} · ${timeFmt.format(next.start)}`);
    set("nm-opponent", next.opponent || "TBA");
    set("nm-event", next.event || "—");
    set("nm-format", next.format || "—");
  } else {
    set("nm-when", "TBA");
    set("nm-opponent", "TBA");
    set("nm-event", "No match scheduled");
    set("nm-format", "—");
  }
}

async function loadFeed() {
  try {
    const res = await fetch(FEED_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    matches = normalize(await res.json());
    feedError = false;
  } catch (err) {
    console.error("Match feed failed to load:", err);
    if (!matches) feedError = true;   // keep showing the last good data if we had some
  }
  renderFeed();
}

loadFeed();
setInterval(loadFeed, REFETCH_MS);
setInterval(renderFeed, 60 * 1000);   // flips matches to Live / Results as time passes
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadFeed(); });
