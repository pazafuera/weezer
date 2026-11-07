-- First-party launch analytics (Nov 7, 2026): the event table
-- behind app/lib/analytics.ts. Owner-run, like every migration
-- here. Safe to run before OR after the analytics code ships:
-- until this table exists, the client's first insert errors and
-- its tracker disables itself for the session (no console spam,
-- no user-facing effect); once it exists, events flow.
--
-- Privacy shape, by design: an event name, an optional share
-- card type, a nullable user id, a timestamp. No free-text, no
-- user agent, no IP storage beyond what Postgres keeps in its
-- own logs. The event/card vocabularies are constrained to the
-- client's exact sets so a buggy (or hostile) writer cannot
-- invent columns of junk.
--
-- Access shape: clients may INSERT and nothing else — there is
-- deliberately no select policy and no select grant for anon /
-- authenticated, so the table is write-only from the app. The
-- owner reads aggregates in this dashboard (service role) or
-- via SQL. The insert policy also pins user_id: anonymous rows
-- must carry null; a signed-in writer may stamp only its own id
-- (auth.uid()), so one user cannot forge another's events.

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in (
    'session_start', 'sort_started', 'sort_completed',
    'share_initiated', 'game_started', 'game_completed'
  )),
  card text check (card is null or card in (
    'top_10_songs', 'top_10_albums', 'tier_list_albums',
    'tier_list_songs', 'era_dna', 'tribe', 'fanhood', 'thread'
  )),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists app_events_event_created_idx
  on public.app_events (event, created_at);

alter table public.app_events enable row level security;

-- Insert-only for the app's roles (Oct 30 rule: new public
-- tables get NO automatic Data API grants — state them here).
grant insert on public.app_events to anon, authenticated;
grant select, insert, update, delete on public.app_events to service_role;

drop policy if exists "app_events_insert_own" on public.app_events;
create policy "app_events_insert_own" on public.app_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Make PostgREST pick the new table up immediately.
notify pgrst, 'reload schema';
