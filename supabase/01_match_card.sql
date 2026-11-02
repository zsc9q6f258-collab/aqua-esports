-- =============================================================================
-- SQL 1: Next match card
--
-- Highlight ONE block, edit the values in quotes, then click Run.
-- (Run only runs the highlighted text.) The site updates within seconds.
--
-- Times: write them with a time zone, e.g. '2026-11-08 19:00 America/New_York'.
-- Visitors see the time converted to their own time zone.
--
-- An Upcoming card switches to Live by itself at its start time
-- (see 04_auto_live.sql), so block C is only needed to go live early.
-- =============================================================================


-- ----- A) No upcoming match --------------------------------------------------
-- Card shows "TBA" / "No match scheduled".
update public.match_card
set state = 'none', opponent = null, event = null, format = null, starts_at = null, updated_at = now()
where id = 1;


-- ----- B) Upcoming match (type it in) ----------------------------------------
update public.match_card
set state      = 'upcoming',
    opponent   = 'Team Name',
    event      = 'T3 League · Week 1',
    format     = 'BO1',
    starts_at  = '2026-11-08 19:00 America/New_York',
    updated_at = now()
where id = 1;


-- ----- B2) Upcoming match (copy the next one from the Upcoming list) ---------
-- Uses the soonest match in upcoming_matches that isn't cancelled.
update public.match_card c
set state = 'upcoming', opponent = m.opponent, event = m.event, format = m.format,
    starts_at = m.starts_at, updated_at = now()
from (
  select * from public.upcoming_matches
  where not cancelled and starts_at > now()
  order by starts_at
  limit 1
) m
where c.id = 1;


-- ----- C) Live match ---------------------------------------------------------
-- Keeps the opponent, event and format already on the card.
update public.match_card
set state = 'live', updated_at = now()
where id = 1;


-- ----- C2) Live match (set a different opponent at the same time) ------------
update public.match_card
set state      = 'live',
    opponent   = 'Team Name',
    event      = 'T3 League · Week 1',
    format     = 'BO1',
    starts_at  = now(),
    updated_at = now()
where id = 1;


-- ----- Check what the card shows right now -----------------------------------
select state, opponent, event, format, starts_at from public.match_card;
