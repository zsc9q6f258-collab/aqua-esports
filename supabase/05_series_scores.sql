-- =============================================================================
-- Series scores: one-time setup. Run this whole file once. Safe to run again.
--
-- Lets a result store the series (map) score of a BO3/BO5, e.g. 2–1,
-- as well as or instead of the round score.
-- =============================================================================

alter table public.recent_results
  add column if not exists format        text,
  add column if not exists aqua_maps     int check (aqua_maps >= 0),
  add column if not exists opponent_maps int check (opponent_maps >= 0);

alter table public.recent_results
  alter column aqua_score     drop not null,
  alter column opponent_score drop not null;

-- Every result needs at least one complete score
alter table public.recent_results drop constraint if exists recent_results_has_score;
alter table public.recent_results add constraint recent_results_has_score check (
  (aqua_score is not null and opponent_score is not null)
  or (aqua_maps is not null and opponent_maps is not null)
);
