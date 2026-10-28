-- ============================================================================
-- FANHOOD FOLLOWS YOUR ACCOUNT — DO NOT RUN WITHOUT MARK'S EXPLICIT APPROVAL.
--
-- The depth game (How Rare a Weezer Fan Are You?) keeps a player's
-- established fanhood in device localStorage today ('weezer-lore-best').
-- iOS home-screen web apps and Safari keep separate storage, so a
-- fanhood earned in one is invisible in the other (confirmed on Mark's
-- phone, Oct 27, 2026: played in the web app, Sweater Thread in Safari
-- showed nothing). This table mirrors the record onto the player's
-- account so it follows them across browsers and devices.
--
-- The client (app/lib/fanhoodSync.ts) reconciles local vs account by
-- "deeper best wins" and degrades silently to local-only behavior
-- until this migration is applied — shipping the client first is safe.
--
-- One row per user, owner-only access, mirroring the profiles /
-- weezer_rankings lockdown conventions (a user can read and write
-- only their own row; nobody can read anyone else's fanhood).
--
-- Explicit Data API grants are included below: from Oct 30, 2026,
-- NEW tables in the public schema no longer receive automatic Data
-- API grants, and without them PostgREST returns "permission denied"
-- (recorded in AGENTS.md for both Supabase projects).
-- ============================================================================

create table public.fanhood (
  user_id uuid primary key,
  best_depth integer not null,
  deepest jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fanhood enable row level security;

create policy "Fanhood: read own row"
  on public.fanhood for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Fanhood: insert own row"
  on public.fanhood for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Fanhood: update own row"
  on public.fanhood for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.fanhood to authenticated;
grant select, insert, update, delete on table public.fanhood to service_role;
