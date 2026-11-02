-- =============================================================================
-- SQL 2: Recent results
--
-- Highlight ONE block, edit the values, then click Run.
-- The site shows the newest 5 results. W / L / D comes from the scores.
-- =============================================================================


-- ----- Add a result ----------------------------------------------------------
insert into public.recent_results (played_at, opponent, event, map, aqua_score, opponent_score)
values ('2026-11-01 19:00 America/New_York', 'Team Name', 'T3 League · Week 0', 'Clubhouse', 7, 4);


-- ----- Add a BO3 / BO5 result (series score, e.g. 2–1) -----------------------
-- Needs 05_series_scores.sql. The round score columns can be left out.
insert into public.recent_results (played_at, opponent, event, format, aqua_maps, opponent_maps)
values ('2026-11-01 19:00 America/New_York', 'Team Name', 'T3 League · Week 0', 'BO3', 2, 1);


-- ----- See all results (use the id to remove or fix one) ---------------------
select id, played_at, opponent, event, map, aqua_score, opponent_score
from public.recent_results
order by played_at desc;


-- ----- Remove a result -------------------------------------------------------
-- Replace 0 with the id from the list above.
delete from public.recent_results where id = 0;


-- ----- Fix a score -----------------------------------------------------------
update public.recent_results
set aqua_score = 7, opponent_score = 5
where id = 0;
