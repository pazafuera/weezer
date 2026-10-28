-- ============================================================================
-- FANHOOD RESET: FULL WIPE — MARK-APPROVED (Oct 27, 2026). DO NOT RUN
-- WITHOUT MARK'S EXPLICIT APPROVAL.
--
-- Mark ruled a full wipe of tester-era fanhood: everyone starts at
-- zero. The old single game's fanhood ("legacy") is retired
-- entirely — not just hidden from the leaderboard.
--
-- What this does:
--   1. Deletes every row in public.fanhood. The tester-era totals
--      (three real accounts carried old-game bests of 1,900 /
--      3,941 / 4,297 with zero new-system games) are gone; rows
--      re-create themselves the first time a player finishes one
--      of the five games and syncs.
--   2. Narrows get_fanhood_leaderboard() to players who have
--      finished at least one of the five games (games map
--      non-empty). The legacy fallback — best_depth > 0 reported
--      with games_played = 0 — is removed; total_depth is always
--      the sum of finished game scores.
--
-- The client ships first and is safe either way: it reads account
-- rows for the games column only, normalizes legacy-carrying
-- device records away on load, and derives every upsert's
-- best_depth / deepest from the games record alone — so neither
-- side can re-create a legacy total before or after this runs.
-- ============================================================================

delete from public.fanhood;

create or replace function public.get_fanhood_leaderboard()
returns table (
  username text,
  total_depth integer,
  games_played integer,
  game_scores jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    p.username,
    coalesce(
      (select sum((entry.value ->> 'score')::integer)
         from jsonb_each(coalesce(f.games, '{}'::jsonb)) entry), 0
    ) as total_depth,
    coalesce(
      (select count(*) from jsonb_each(coalesce(f.games, '{}'::jsonb))), 0
    )::integer as games_played,
    coalesce(
      (select jsonb_object_agg(
          entry.key, (entry.value ->> 'score')::integer)
         from jsonb_each(coalesce(f.games, '{}'::jsonb)) entry),
      '{}'::jsonb
    ) as game_scores
  from public.fanhood f
  join public.profiles p on p.id = f.user_id
  where p.username is not null
    and coalesce(
      (select count(*) from jsonb_each(coalesce(f.games, '{}'::jsonb))), 0
    ) > 0;
$$;

-- CREATE OR REPLACE preserves the existing grants; restated so the
-- file is self-contained (the worldwide board is public, the same
-- posture as the community rankings read).
grant execute on function public.get_fanhood_leaderboard() to anon, authenticated;
