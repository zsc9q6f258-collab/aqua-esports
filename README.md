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

Tip: save each file as a snippet in the SQL Editor so it's one click away.

How it behaves:

- Times are written with a time zone, e.g. `'2026-11-08 19:00 America/New_York'`. Visitors see them in their own time zone.
- The Next match card is set by hand with SQL 1. It doesn't change on its own when a match starts.
- Upcoming matches stay listed until 3 hours after their start time. Cancelled ones stay listed, marked "Cancelled", until then.
- Recent results shows the newest 5. W / L / D comes from the scores (Aqua's first).
- The website uses Supabase's publishable key, which is meant to be public. The tables only allow reading with it, so nobody can change data from the website; changes are made from the Supabase dashboard.
