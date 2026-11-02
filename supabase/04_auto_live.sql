-- =============================================================================
-- Auto-live: one-time setup. Run this whole file once. Safe to run again.
--
-- Every minute, if the Next match card is "Upcoming" and its start time has
-- arrived, the card switches to "Live" on its own. Matches more than 3 hours
-- past their start time are left alone (the same window the website uses).
--
-- To turn it off:  select cron.unschedule('aqua-auto-live');
-- =============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'aqua-auto-live',
  '* * * * *',
  $$
    update public.match_card
    set state = 'live', updated_at = now()
    where id = 1
      and state = 'upcoming'
      and starts_at <= now()
      and starts_at > now() - interval '3 hours'
  $$
);
