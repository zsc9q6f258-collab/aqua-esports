# Aqua Esports

Website for Aqua Esports, a competitive Tom Clancy's Rainbow Six Siege team.

Plain HTML, CSS and JavaScript — no build step.

## Run it locally

```bash
python3 -m http.server 8417
```

Then open http://localhost:8417.

## Editing

- **Matches**: Supabase, using the SQL files in `supabase/` (see below)
- **Content** (roster, staff, substitutes, text): `index.html`
- **Styles**: `styles.css`
- **Player photos**: `assets/players/` — replace a file with the same name to update a photo

## Updating matches

The "Next match" card, Upcoming list and Recent results all come from the
**Aqua** project on Supabase. Open it, go to **SQL Editor**, paste in one of
the files from `supabase/`, highlight one block, edit the values and click
**Run** (Run only runs the highlighted text). Open pages update within seconds.

| File | What it does |
|---|---|
| `supabase/00_setup.sql` | One-time setup: creates the tables. Safe to run again. |
| `supabase/01_match_card.sql` | **SQL 1**: set the Next match card to *No upcoming match*, *Upcoming match* or *Live match*. |
| `supabase/02_recent_results.sql` | **SQL 2**: add, remove or fix a result. |
| `supabase/03_upcoming_matches.sql` | **SQL 3**: add, cancel, un-cancel, reschedule or remove an upcoming match. |
| `supabase/04_auto_live.sql` | One-time setup: switches the card from Upcoming to Live by itself at the start time. |

Tip: save each file as a snippet in the SQL Editor so it's one click away.

How it behaves:

- Times are written with a time zone, e.g. `'2026-11-08 19:00 America/New_York'`. Visitors see them in their own time zone.
- When an Upcoming card's start time arrives, it switches to **Live** by itself (checked every minute). Clearing it afterwards, or moving to the next match, is still done by hand (`/card next` or `/card none`).
- Upcoming list entries show **Live** from their start time until they drop off 3 hours later.
- Upcoming matches stay listed until 3 hours after their start time. Cancelled ones stay listed, marked "Cancelled", until then.
- Recent results shows the newest 5. W / L / D comes from the scores (Aqua's first).
- The website uses Supabase's publishable key, which is meant to be public. The tables only allow reading with it, so nobody can change data from the website; changes are made from the Supabase dashboard.

## Discord bot

The **Aqua Web manager** Discord app updates the same tables with slash commands.
It runs as the `discord-bot` Supabase Edge Function
(`supabase/functions/discord-bot/index.ts`), so there is no server to keep running.

| Command | What it does |
|---|---|
| `/card none` · `/card next` · `/card upcoming` · `/card live` · `/card show` | Next match card |
| `/match add` · `list` · `cancel` · `uncancel` · `reschedule` · `remove` | Upcoming matches |
| `/result add` · `list` · `edit` · `remove` | Recent results |

- Only members with **Manage Server** see the commands. To let another role use them:
  Server Settings → Integrations → Aqua Web manager.
- Replies are only visible to whoever ran the command.
- Commands from any server other than Aqua Esports are refused.
- After changing the commands in the code, redeploy the function and open
  `https://jzhoabqjxklsmnhycwcb.supabase.co/functions/v1/discord-bot/register` once.
