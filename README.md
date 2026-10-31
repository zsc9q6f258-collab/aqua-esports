# Aqua Esports

Website for Aqua Esports, a competitive Tom Clancy's Rainbow Six Siege team.

Plain HTML, CSS and JavaScript — no build step.

## Run it locally

```bash
python3 -m http.server 8417
```

Then open http://localhost:8417.

## Editing

- **Matches**: `data/matches.json` (see below)
- **Content** (roster, staff, substitutes, text): `index.html`
- **Styles**: `styles.css`
- **Player photos**: `assets/players/` — replace a file with the same name to update a photo

## Updating matches

The schedule, results and the "Next match" card all come from `data/matches.json`.
Edit that one file — on GitHub you can click it, then the pencil icon, then **Commit changes**.
The live site picks it up within a few minutes, and open pages refresh it on their own.

Each match is one entry in the `matches` list:

```json
{
  "matches": [
    {
      "date": "2026-11-08T19:00:00-05:00",
      "opponent": "Team Name",
      "event": "T3 League · Week 1",
      "format": "BO1"
    },
    {
      "date": "2026-11-01T19:00:00-05:00",
      "opponent": "Other Team",
      "event": "T3 League · Week 0",
      "map": "Clubhouse",
      "score": "7-4"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `date` | yes | Start time with its time-zone offset (`-05:00` is US Eastern standard time). Visitors see it in their own time zone. |
| `opponent` | yes | Shown as "vs Team Name". |
| `event` | no | League, cup or "Scrim". |
| `format` | no | `BO1`, `BO3`, etc. |
| `map` | no | Shown on results. |
| `score` | no | Aqua's score first, e.g. `7-4`. Adding a score moves the match to Recent results and marks it W or L automatically. |
| `result` | no | Override the automatic `W` / `L` / `D`. |

How it behaves:

- The earliest unfinished match becomes **Next match** at the top of the page.
- From its start time until a score is added (or 3 hours pass) a match shows as **Live**.
- A match with no score 3 hours after it starts moves to Recent results as **Pending**.
- Recent results shows the newest 5. Older entries can stay in the file.
- Separate entries with commas, and no comma after the last one. If the file has a typo, the page shows "Couldn't load matches" — paste it into https://jsonlint.com to find the problem.
