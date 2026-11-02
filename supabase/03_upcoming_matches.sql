-- =============================================================================
-- SQL 3: Upcoming matches
--
-- Highlight ONE block, edit the values, then click Run.
-- A match stays on the Upcoming list until 3 hours after its start time.
-- Cancelled matches stay on the list marked "Cancelled" until then.
-- =============================================================================


-- ----- Add a match -----------------------------------------------------------
insert into public.upcoming_matches (starts_at, opponent, event, format)
values ('2026-11-08 19:00 America/New_York', 'Team Name', 'T3 League · Week 1', 'BO1');


-- ----- See all upcoming matches (use the id for the blocks below) ------------
select id, starts_at, opponent, event, format, cancelled
from public.upcoming_matches
order by starts_at;


-- ----- Cancel a match (stays listed, marked "Cancelled") ---------------------
-- Replace 0 with the id from the list above.
update public.upcoming_matches set cancelled = true where id = 0;


-- ----- Un-cancel a match -----------------------------------------------------
update public.upcoming_matches set cancelled = false where id = 0;


-- ----- Reschedule a match ----------------------------------------------------
update public.upcoming_matches
set starts_at = '2026-11-09 20:00 America/New_York'
where id = 0;


-- ----- Remove a match (gone from the site entirely) --------------------------
delete from public.upcoming_matches where id = 0;
