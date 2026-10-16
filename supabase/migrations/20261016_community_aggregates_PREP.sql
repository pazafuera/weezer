-- ============================================================================
-- PREP ONLY — DO NOT RUN ON PRODUCTION WITHOUT MARK'S EXPLICIT APPROVAL.
--
-- Community aggregates (Pre-Launch Fix Guide, statistical honesty #4).
-- Goal: stop shipping every fan's raw rankings to every browser. Clients
-- will read ONLY these aggregate tables through get_community_stats().
--
-- Methodology parity with app/lib/fanStatsMethodology.ts (v1.0):
--   * A submission qualifies only with >= 10 explicit ratings whose
--     bucket value is one of banger/slaps/mid/skip/trash. Missing songs
--     are never counted, never treated as Trash.
--   * Caveat: the client also requires the song id to exist in
--     FULL_SONG_POOL. The server has no song-catalog table yet, so this
--     draft validates bucket values only. Add a catalog check before
--     relying on server numbers over client numbers.
--   * Percentages stay a CLIENT display decision (MIN_DISPLAY_SAMPLE=50);
--     the server always returns honest counts.
-- ============================================================================

create table if not exists public.community_song_stats (
  song_id text primary key,
  ratings integer not null default 0,
  score_sum integer not null default 0,
  banger integer not null default 0,
  slaps integer not null default 0,
  mid integer not null default 0,
  skip integer not null default 0,
  trash integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_album_stats (
  album_id text primary key,
  ratings integer not null default 0,
  score_sum integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_pair_stats (
  song_a text not null,
  song_b text not null,
  co_loved integer not null default 0,
  primary key (song_a, song_b)
);

create table if not exists public.community_meta (
  key text primary key,
  value text not null
);

-- Aggregates are readable only through the RPC below: no direct access.
alter table public.community_song_stats enable row level security;
alter table public.community_album_stats enable row level security;
alter table public.community_pair_stats enable row level security;
alter table public.community_meta enable row level security;

-- Recompute all aggregates from weezer_rankings. Service-role / cron only.
create or replace function public.refresh_community_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  qualified_count integer;
begin
  -- Qualified submissions: >= 10 entries with a valid bucket value.
  create temp table _qualified on commit drop as
  select user_id, triage_map
  from public.weezer_rankings
  where triage_map is not null
    and (
      select count(*)
      from jsonb_each_text(triage_map) e
      where e.value in ('banger', 'slaps', 'mid', 'skip', 'trash')
    ) >= 10;

  select count(*) into qualified_count from _qualified;

  delete from public.community_song_stats;
  insert into public.community_song_stats
    (song_id, ratings, score_sum, banger, slaps, mid, skip, trash, updated_at)
  select
    e.key,
    count(*),
    sum(case e.value
          when 'banger' then 5 when 'slaps' then 4 when 'mid' then 3
          when 'skip' then 2 when 'trash' then 1 else 0 end),
    count(*) filter (where e.value = 'banger'),
    count(*) filter (where e.value = 'slaps'),
    count(*) filter (where e.value = 'mid'),
    count(*) filter (where e.value = 'skip'),
    count(*) filter (where e.value = 'trash'),
    now()
  from _qualified q
  cross join lateral jsonb_each_text(q.triage_map) e
  where e.value in ('banger', 'slaps', 'mid', 'skip', 'trash')
  group by e.key;

  -- Album stats need the song -> album map, which lives in the client
  -- (app/data/constants.ts). Until a server song catalog exists, album
  -- aggregates stay client-side; community_album_stats is created now
  -- so the shape is stable when the catalog lands.

  delete from public.community_pair_stats;
  insert into public.community_pair_stats (song_a, song_b, co_loved)
  select a.key, b.key, count(*)
  from _qualified q
  cross join lateral jsonb_each_text(q.triage_map) a
  cross join lateral jsonb_each_text(q.triage_map) b
  where a.value in ('banger', 'slaps')
    and b.value in ('banger', 'slaps')
    and a.key < b.key
  group by a.key, b.key;

  insert into public.community_meta (key, value) values
    ('qualified_submissions', qualified_count::text),
    ('methodology_version', '1.0'),
    ('refreshed_at', now()::text)
  on conflict (key) do update set value = excluded.value;
end;
$$;

revoke execute on function public.refresh_community_stats() from public, anon, authenticated;

-- The only client door: one JSON payload of aggregates + honest counts.
create or replace function public.get_community_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'qualifiedSubmissions',
      coalesce((select value::int from public.community_meta
                where key = 'qualified_submissions'), 0),
    'methodologyVersion',
      coalesce((select value from public.community_meta
                where key = 'methodology_version'), '1.0'),
    'refreshedAt',
      (select value from public.community_meta where key = 'refreshed_at'),
    'songs',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'songId', song_id,
          'ratings', ratings,
          'sum', score_sum,
          'buckets', jsonb_build_object(
            'banger', banger, 'slaps', slaps, 'mid', mid,
            'skip', skip, 'trash', trash)
        ))
        from public.community_song_stats
      ), '[]'::jsonb),
    'pairs',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'a', song_a, 'b', song_b, 'coLoved', co_loved))
        from public.community_pair_stats
      ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_community_stats() to anon, authenticated;

-- Refresh cadence (pick ONE when this is approved to run):
--   * pg_cron hourly:  select cron.schedule('refresh-community-stats',
--                        '0 * * * *', $$select public.refresh_community_stats()$$);
--   * or call refresh_community_stats() from a trusted server job.
-- Until then the tables stay empty and the client keeps its current path.
