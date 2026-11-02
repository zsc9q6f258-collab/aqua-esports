// Aqua Esports Discord bot — Supabase Edge Function.
//
// Discord sends each slash command here as an HTTP POST (the app's
// "Interactions Endpoint URL"). The function checks Discord's signature,
// updates the same tables the website reads, and replies.
//
// Visiting <function URL>/register (with the DISCORD_BOT_TOKEN secret set)
// creates or updates the slash commands in the Aqua Esports server.
//
// Deploy with JWT verification OFF — Discord can't send a Supabase JWT.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const APP_ID = "1566655450789716148";
const PUBLIC_KEY = "9e01516b73650bd0a0c4a1a27b410fd6d6d121def462e14ec0c485d1e06b5d3f";
const GUILD_ID = "1551149847237623898";          // Aqua Esports server; commands from anywhere else are refused
const DEFAULT_TZ = "America/New_York";
const MANAGE_GUILD = "32";                       // who sees the commands by default (change per role in Server Settings → Integrations)

// Supabase provides these to every function; newer projects use SUPABASE_SECRET_KEYS
function serverKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? Object.values(keys)[0];
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, serverKey() as string, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------
const STRING = 3, INTEGER = 4, SUB = 1;

const TIMEZONES = [
  ["Eastern (ET)", "America/New_York"],
  ["Central (CT)", "America/Chicago"],
  ["Mountain (MT)", "America/Denver"],
  ["Pacific (PT)", "America/Los_Angeles"],
  ["UK (GMT/BST)", "Europe/London"],
  ["Central Europe (CET)", "Europe/Paris"],
  ["UTC", "UTC"],
].map(([name, value]) => ({ name, value }));

// Discord limits each description to 100 characters
const opt = {
  opponent: (required = true, description = "The other team's name, e.g. Team Liquid") =>
    ({ type: STRING, name: "opponent", description, required, max_length: 60 }),
  date: (required = true, description = "Match date as YYYY-MM-DD, e.g. 2026-11-08") =>
    ({ type: STRING, name: "date", description, required }),
  time: (required = true, description = "Start time in 24-hour format, e.g. 19:00 for 7 PM") =>
    ({ type: STRING, name: "time", description, required }),
  timezone: { type: STRING, name: "timezone", description: "Time zone of the date and time you typed (Eastern if left empty)", choices: TIMEZONES },
  event: { type: STRING, name: "event", description: "League or event name, e.g. T3 League · Week 1, or Scrim", max_length: 60 },
  format: { type: STRING, name: "format", description: "Series length, e.g. BO1 or BO3", max_length: 10 },
  map: { type: STRING, name: "map", description: "Map played, e.g. Clubhouse", max_length: 40 },
  match: { type: STRING, name: "match", description: "Which match: start typing the opponent's name, then pick it from the list", required: true, autocomplete: true },
  result: { type: STRING, name: "result", description: "Which result: start typing the opponent's name, then pick it from the list", required: true, autocomplete: true },
  aqua: { type: INTEGER, name: "aqua", description: "Rounds Aqua won", required: true, min_value: 0 },
  opp: { type: INTEGER, name: "opp", description: "Rounds the opponent won", required: true, min_value: 0 },
};

const COMMANDS = [
  {
    name: "card", description: "Website: change the big Next match box at the top of the page",
    default_member_permissions: MANAGE_GUILD, contexts: [0],
    options: [
      { type: SUB, name: "none", description: "Clear the box so it says “No match scheduled”" },
      { type: SUB, name: "next", description: "Fill the box with the soonest match from the Upcoming list" },
      { type: SUB, name: "upcoming", description: "Fill the box with a match you type in (doesn't add it to the Upcoming list)",
        options: [opt.opponent(), opt.date(), opt.time(), opt.timezone, opt.event, opt.format] },
      { type: SUB, name: "live", description: "Show “LIVE NOW” in the box for the match that's in it",
        options: [opt.opponent(false, "Only if it's a different team: the new opponent's name"), opt.event, opt.format] },
      { type: SUB, name: "show", description: "See what the box shows right now (changes nothing)" },
    ],
  },
  {
    name: "match", description: "Website: manage the Upcoming matches list",
    default_member_permissions: MANAGE_GUILD, contexts: [0],
    options: [
      { type: SUB, name: "add", description: "Add a match to the Upcoming list",
        options: [opt.opponent(), opt.date(), opt.time(), opt.timezone, opt.event, opt.format] },
      { type: SUB, name: "list", description: "See every match on the Upcoming list (changes nothing)" },
      { type: SUB, name: "cancel", description: "Mark a match as Cancelled. It stays on the list, crossed out", options: [opt.match] },
      { type: SUB, name: "uncancel", description: "Undo a cancel. The match shows as on again", options: [opt.match] },
      { type: SUB, name: "reschedule", description: "Move a match to a new date and time",
        options: [opt.match, opt.date(true, "New date as YYYY-MM-DD"), opt.time(true, "New start time, 24-hour, e.g. 19:00"), opt.timezone] },
      { type: SUB, name: "remove", description: "Delete a match from the Upcoming list completely", options: [opt.match] },
    ],
  },
  {
    name: "result", description: "Website: manage the Recent results list",
    default_member_permissions: MANAGE_GUILD, contexts: [0],
    options: [
      { type: SUB, name: "add", description: "Add a finished match and its score. W or L is worked out for you",
        options: [opt.opponent(), opt.aqua, opt.opp, opt.map, opt.event,
          opt.date(false, "Date played as YYYY-MM-DD (leave empty for today)"),
          opt.time(false, "Start time, 24-hour (leave empty if you're not sure)"), opt.timezone] },
      { type: SUB, name: "list", description: "See the latest results (changes nothing)" },
      { type: SUB, name: "edit", description: "Fix the score of a result that's already on the website", options: [opt.result, opt.aqua, opt.opp] },
      { type: SUB, name: "remove", description: "Delete a result from the website", options: [opt.result] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
class UserError extends Error {}

function hex(s: string) {
  return new Uint8Array(s.match(/../g)!.map((b) => parseInt(b, 16)));
}

async function verify(req: Request, body: string) {
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return false;
  const key = await crypto.subtle.importKey("raw", hex(PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, hex(sig), new TextEncoder().encode(ts + body));
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Replies are only visible to the person who ran the command
const reply = (content: string) => json({ type: 4, data: { content, flags: 64 } });

function options(data: any): { sub: string; o: Record<string, any>; focused?: string } {
  const sub = data.options?.[0];
  const o: Record<string, any> = {};
  let focused;
  for (const x of sub?.options ?? []) {
    o[x.name] = x.value;
    if (x.focused) focused = x.name;
  }
  return { sub: sub?.name, o, focused };
}

// Postgres turns "2026-11-08 19:00 America/New_York" into the right instant
function when(date: string, time: string, tz = DEFAULT_TZ) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UserError("Date must look like 2026-11-08.");
  if (!/^\d{1,2}:\d{2}$/.test(time)) throw new UserError("Time must be 24-hour, like 19:00.");
  return `${date} ${time} ${tz}`;
}

// Discord shows <t:…> in each reader's own time zone
const stamp = (iso: string) => `<t:${Math.floor(new Date(iso).getTime() / 1000)}:f>`;
const vs = (m: any) => `**vs ${m.opponent}**`;
const extra = (...parts: (string | null | undefined)[]) => {
  const s = parts.filter(Boolean).join(" · ");
  return s ? ` · ${s}` : "";
};
const outcome = (a: number, b: number) => (a > b ? "W" : a < b ? "L" : "D");

async function run<T>(q: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await q;
  if (error) {
    if (error.code === "22007" || error.code === "22008") throw new UserError("That date or time isn't valid.");
    throw error;
  }
  return data;
}

// The match / result pickers send the row id as text
function pickedId(value: string, what: string) {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new UserError(`Pick a ${what} from the list that appears as you type.`);
  return id;
}

async function one(q: PromiseLike<{ data: any; error: any }>, missing: string) {
  const rows = await run(q);
  if (!rows?.length) throw new UserError(missing);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function card(sub: string, o: Record<string, any>) {
  const update = (fields: Record<string, unknown>) =>
    run(db.from("match_card").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", 1).select().single());

  switch (sub) {
    case "none":
      await update({ state: "none", opponent: null, event: null, format: null, starts_at: null });
      return "Card set to **No upcoming match**.";
    case "next": {
      const m = await one(
        db.from("upcoming_matches").select().eq("cancelled", false).gt("starts_at", new Date().toISOString()).order("starts_at").limit(1),
        "There's no upcoming match on the list. Add one with `/match add`.",
      );
      await update({ state: "upcoming", opponent: m.opponent, event: m.event, format: m.format, starts_at: m.starts_at });
      return `Card set to **Upcoming**: ${vs(m)} · ${stamp(m.starts_at)}${extra(m.event, m.format)}`;
    }
    case "upcoming": {
      const c = await update({
        state: "upcoming", opponent: o.opponent, event: o.event ?? null, format: o.format ?? null,
        starts_at: when(o.date, o.time, o.timezone),
      });
      return `Card set to **Upcoming**: ${vs(c)} · ${stamp(c.starts_at)}${extra(c.event, c.format)}`;
    }
    case "live": {
      const fields: Record<string, unknown> = { state: "live" };
      if (o.opponent) Object.assign(fields, { opponent: o.opponent, event: o.event ?? null, format: o.format ?? null, starts_at: new Date().toISOString() });
      else {
        if (o.event) fields.event = o.event;
        if (o.format) fields.format = o.format;
      }
      const c = await update(fields);
      return `Card set to **Live**${c.opponent ? `: ${vs(c)}` : ""}${extra(c.event, c.format)}`;
    }
    case "show": {
      const c = await run(db.from("match_card").select().eq("id", 1).single());
      if (c.state === "none") return "Card shows **No upcoming match**.";
      const time = c.state === "upcoming" && c.starts_at ? ` · ${stamp(c.starts_at)}` : "";
      return `Card shows **${c.state === "live" ? "Live" : "Upcoming"}**: ${vs(c)}${time}${extra(c.event, c.format)}`;
    }
  }
}

async function match(sub: string, o: Record<string, any>) {
  const change = (fields: Record<string, unknown>) =>
    one(db.from("upcoming_matches").update(fields).eq("id", pickedId(o.match, "match")).select(), "Couldn't find that match.");

  switch (sub) {
    case "add": {
      const m = await one(db.from("upcoming_matches").insert({
        opponent: o.opponent, starts_at: when(o.date, o.time, o.timezone), event: o.event ?? null, format: o.format ?? null,
      }).select(), "Couldn't add the match.");
      return `Added ${vs(m)} · ${stamp(m.starts_at)}${extra(m.event, m.format)}`;
    }
    case "list": {
      const rows = await run(db.from("upcoming_matches").select().order("starts_at"));
      if (!rows.length) return "No upcoming matches.";
      return rows.map((m: any) => `${stamp(m.starts_at)} ${vs(m)}${extra(m.event, m.format)}${m.cancelled ? " · ~~cancelled~~" : ""}`).join("\n");
    }
    case "cancel":
      return `Cancelled ${vs(await change({ cancelled: true }))}. It stays listed as Cancelled.`;
    case "uncancel":
      return `${vs(await change({ cancelled: false }))} is back on.`;
    case "reschedule": {
      const m = await change({ starts_at: when(o.date, o.time, o.timezone) });
      return `Moved ${vs(m)} to ${stamp(m.starts_at)}.`;
    }
    case "remove": {
      const m = await one(db.from("upcoming_matches").delete().eq("id", pickedId(o.match, "match")).select(), "Couldn't find that match.");
      return `Removed ${vs(m)}.`;
    }
  }
}

async function result(sub: string, o: Record<string, any>) {
  switch (sub) {
    case "add": {
      const played = o.date ? when(o.date, o.time ?? "12:00", o.timezone) : new Date().toISOString();
      const r = await one(db.from("recent_results").insert({
        opponent: o.opponent, aqua_score: o.aqua, opponent_score: o.opp, map: o.map ?? null, event: o.event ?? null, played_at: played,
      }).select(), "Couldn't add the result.");
      return `Added ${outcome(r.aqua_score, r.opponent_score)} ${r.aqua_score}–${r.opponent_score} ${vs(r)}${extra(r.map, r.event)}`;
    }
    case "list": {
      const rows = await run(db.from("recent_results").select().order("played_at", { ascending: false }).limit(15));
      if (!rows.length) return "No results yet.";
      return rows.map((r: any) => `${stamp(r.played_at)} ${vs(r)} ${r.aqua_score}–${r.opponent_score} ${outcome(r.aqua_score, r.opponent_score)}${extra(r.map)}`).join("\n");
    }
    case "edit": {
      const r = await one(db.from("recent_results").update({ aqua_score: o.aqua, opponent_score: o.opp }).eq("id", pickedId(o.result, "result")).select(), "Couldn't find that result.");
      return `Updated ${vs(r)} to ${r.aqua_score}–${r.opponent_score} (${outcome(r.aqua_score, r.opponent_score)}).`;
    }
    case "remove": {
      const r = await one(db.from("recent_results").delete().eq("id", pickedId(o.result, "result")).select(), "Couldn't find that result.");
      return `Removed ${vs(r)} ${r.aqua_score}–${r.opponent_score}.`;
    }
  }
}

// Fills the match / result pickers as you type
async function autocomplete(name: string, focused: string | undefined, typed: string) {
  const label = (d: string, rest: string) => {
    const day = new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: DEFAULT_TZ });
    return `${day} · ${rest}`.slice(0, 100);
  };
  let rows: { name: string; value: string }[] = [];
  if (focused === "match") {
    const data = await run(db.from("upcoming_matches").select().ilike("opponent", `%${typed}%`).order("starts_at").limit(25));
    rows = data.map((m: any) => ({ name: label(m.starts_at, `vs ${m.opponent}${m.cancelled ? " (cancelled)" : ""}`), value: String(m.id) }));
  } else if (focused === "result") {
    const data = await run(db.from("recent_results").select().ilike("opponent", `%${typed}%`).order("played_at", { ascending: false }).limit(25));
    rows = data.map((r: any) => ({ name: label(r.played_at, `vs ${r.opponent} ${r.aqua_score}–${r.opponent_score}`), value: String(r.id) }));
  }
  return json({ type: 8, data: { choices: rows } });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function register() {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) return new Response("Set the DISCORD_BOT_TOKEN secret first.", { status: 500 });
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDS),
  });
  const text = await res.text();
  if (!res.ok) return new Response(`Discord said ${res.status}: ${text}`, { status: 502 });
  return new Response(`Registered: ${JSON.parse(text).map((c: any) => "/" + c.name).join(", ")}`);
}

Deno.serve(async (req) => {
  if (new URL(req.url).pathname.endsWith("/register")) return register();
  if (req.method !== "POST") return new Response("Aqua Esports Discord bot", { status: 200 });

  const body = await req.text();
  if (!(await verify(req, body))) return new Response("Bad signature", { status: 401 });

  const i = JSON.parse(body);
  if (i.type === 1) return json({ type: 1 });   // Discord's endpoint check

  if (i.guild_id !== GUILD_ID) return reply("This bot only works in the Aqua Esports server.");

  const { sub, o, focused } = options(i.data);
  try {
    if (i.type === 4) return await autocomplete(i.data.name, focused, String(o[focused ?? ""] ?? ""));
    if (i.type !== 2) return reply("Unsupported interaction.");
    const handler = { card, match, result }[i.data.name as "card" | "match" | "result"];
    if (!handler) return reply("Unknown command.");
    return reply((await handler(sub, o)) ?? "Done.");
  } catch (err) {
    if (err instanceof UserError) return reply(err.message);
    console.error(err);
    return reply("Something went wrong. Check the function logs in Supabase.");
  }
});
