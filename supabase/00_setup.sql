-- =============================================================================
-- Aqua Esports: one-time setup
-- Run this whole file once in Supabase -> SQL Editor. It is safe to run again.
--
-- Creates three tables the website reads:
--   match_card        the "Next match" card at the top of the site (one row)
--   upcoming_matches  the Upcoming list
--   recent_results    the Recent results list
--
-- The website can only READ these tables. Changes are made from the
-- SQL Editor using the other files in this folder.
-- =============================================================================

-- ----- Next match card (always exactly one row, id = 1) ----------------------
create table if not exists public.match_card (
  id         int primary key default 1 check (id = 1),
  state      text not null default 'none' check (state in ('none', 'upcoming', 'live')),
  opponent   text,
  event      text,
  format     text,
  starts_at  timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.match_card (id) values (1) on conflict (id) do nothing;

-- ----- Upcoming matches ------------------------------------------------------
create table if not exists public.upcoming_matches (
  id         bigint generated always as identity primary key,
  starts_at  timestamptz not null,
  opponent   text not null,
  event      text,
  format     text,
  cancelled  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----- Recent results --------------------------------------------------------
create table if not exists public.recent_results (
  id             bigint generated always as identity primary key,
  played_at      timestamptz not null,
  opponent       text not null,
  event          text,
  map            text,
  aqua_score     int not null check (aqua_score >= 0),
  opponent_score int not null check (opponent_score >= 0),
  created_at     timestamptz not null default now()
);

-- ----- Read-only access for the website --------------------------------------
alter table public.match_card       enable row level security;
alter table public.upcoming_matches enable row level security;
alter table public.recent_results   enable row level security;

revoke all on public.match_card, public.upcoming_matches, public.recent_results from anon, authenticated;
grant select on public.match_card, public.upcoming_matches, public.recent_results to anon, authenticated;

drop policy if exists "Public can read" on public.match_card;
drop policy if exists "Public can read" on public.upcoming_matches;
drop policy if exists "Public can read" on public.recent_results;
create policy "Public can read" on public.match_card       for select to anon, authenticated using (true);
create policy "Public can read" on public.upcoming_matches for select to anon, authenticated using (true);
create policy "Public can read" on public.recent_results   for select to anon, authenticated using (true);

-- ----- Push changes to open pages instantly (Realtime) -----------------------
do $$
declare t text;
begin
  foreach t in array array['match_card', 'upcoming_matches', 'recent_results'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
