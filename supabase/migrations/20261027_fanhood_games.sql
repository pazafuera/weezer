-- ============================================================================
-- FANHOOD: FIVE GAMES + LEADERBOARD — DO NOT RUN WITHOUT MARK'S EXPLICIT
-- APPROVAL.
--
-- The five-game rebuild of How Rare a Weezer Fan Are You? turns the
-- established fanhood into the SUM of five one-and-done game scores
-- (app/lib/fanhood.ts). The per-game results live in a new `games`
-- jsonb column on the existing public.fanhood row:
--
--   games = { "game1": { "score": 2310,
--                        "deepest": { "answer": "…", "promptLabel": "…",
--                                     "depth": 950 } | null,
--                        "finishedAt": "2026-…Z",
--                        "log": [ { "promptId": "P4",
--                                   "answer": "…" | null,
--                                   "depth": 25 }, … ] },
--             … }
--
-- The pre-existing best_depth / deepest columns stay and keep
-- mirroring the DISPLAYED fanhood (the games total once any game is
-- finished, else the preserved legacy best), so older readers see
-- the same fanhood the surfaces show.
--
-- RLS: NO new policies are needed. The column rides on the existing
-- row, and the three owner-only policies from 20261027_fanhood.sql
-- ("read/insert/update own row", auth.uid() = user_id) already
-- govern it — a user can read and write only their own row. The
-- existing table grants to authenticated / service_role cover the
-- new column (grants are table-level), so no Oct-30-rule grant is
-- needed for the column itself; the leaderboard function below
-- carries its own execute grant.
--
-- The client (app/lib/fanhoodSync.ts) degrades silently until this
-- migration is applied: reads fall back to the legacy columns,
-- writes fall back to writing the legacy columns only, and the
-- leaderboard RPC 404s into the board's honest empty state.
-- Shipping the client first is safe.
--
-- LEADERBOARD: get_fanhood_leaderboard() follows the
-- get_community_rankings() conventions — a SECURITY DEFINER read
-- that returns only public standings (username + scores), never
-- user ids, never anyone's per-prompt log or deepest-answer text.
-- A player appears once they have finished at least one game — a
-- new-system game (games map non-empty), or an old-game best
-- (best_depth > 0, reported with games_played = 0 and their legacy
-- best as the total). The friends board is this same result
-- filtered client-side against the existing friendships data, and
-- a future COUNTY board is a filter over the same standings (it
-- needs a self-declared county on profiles, which nothing collects
-- yet) — geography never needs a rebuild of this function.
-- ============================================================================

alter table public.fanhood
  add column if not exists games jsonb not null default '{}'::jsonb;

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
    case
      when coalesce(
        (select count(*) from jsonb_each(coalesce(f.games, '{}'::jsonb))), 0
      ) > 0
      then coalesce(
        (select sum((entry.value ->> 'score')::integer)
           from jsonb_each(coalesce(f.games, '{}'::jsonb)) entry), 0)
      else f.best_depth
    end as total_depth,
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
    and (
      coalesce(
        (select count(*) from jsonb_each(coalesce(f.games, '{}'::jsonb))), 0
      ) > 0
      or f.best_depth > 0
    );
$$;

-- The worldwide board is public (signed-out visitors see it), the
-- same posture as the community rankings read.
grant execute on function public.get_fanhood_leaderboard() to anon, authenticated;
