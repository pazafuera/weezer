-- Site stats read path (Nov 7, 2026): the one door into
-- app_events. Owner-run, like every migration here. Until this
-- runs, the client's get_event_stats call errors (function not
-- found) and the Site stats page shows its honest not-switched-on
-- state — the page is safe to ship before or after this paste.
--
-- Why an RPC at all: app_events (20261107_app_events.sql) is
-- deliberately write-only from the app — no select grant, no
-- select policy for any client role. This function is the ONLY
-- read path, and it is owner-gated server-side: SECURITY DEFINER
-- so it can read the table past RLS, but the first thing it does
-- is compare auth.uid() to the owner's id. Anyone else gets
-- null — not an error, not an empty payload, just null — so the
-- function reveals nothing about whether it exists or what it
-- counted. The owner id is the site owner's account (username
-- 3chordme), verified Nov 7, 2026.
--
-- Payload shape (all counts are plain row counts; there is no
-- estimation or sampling anywhere in here):
--   by_event: every one of the six event names, always present,
--     each { today, last_7_days, all_time } — zeros included, so
--     the client never guesses whether a missing key means zero.
--       today       = rows since current_date (UTC — the
--                     database's day boundary; stated here so
--                     nobody reads it as Pacific time).
--       last_7_days = rows since current_date - 6 days, i.e.
--                     today plus the six days before it: a
--                     7-calendar-day window ending today.
--   shares_by_card: all-time counts per non-null card on
--     share_initiated rows, only cards with count > 0, ordered by
--     count descending (ties by card name, stable).
--   generated_at: now(), so the page can say how fresh it is.
--
-- Execute grants (Oct 30 rule — state them explicitly): revoked
-- from PUBLIC (Postgres' default), granted to authenticated
-- only. Anon gets nothing: the owner is always signed in on the
-- stats page, and signed-out callers have no business here.

create or replace function public.get_event_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The gate. auth.uid() is null for anon callers; IS DISTINCT
  -- FROM keeps that a plain "no" rather than a null comparison.
  if auth.uid() is distinct from '02882daa-369f-4b03-aa45-b89bbf569f7f'::uuid then
    return null;
  end if;

  return jsonb_build_object(
    'by_event', (
      select jsonb_object_agg(e.event, jsonb_build_object(
        'today', coalesce(c.today, 0),
        'last_7_days', coalesce(c.last_7_days, 0),
        'all_time', coalesce(c.all_time, 0)
      ))
      from (values
        ('session_start'),
        ('sort_started'),
        ('sort_completed'),
        ('share_initiated'),
        ('game_started'),
        ('game_completed')
      ) as e(event)
      left join (
        select
          event,
          count(*) filter (where created_at >= current_date) as today,
          count(*) filter (
            where created_at >= current_date - interval '6 days'
          ) as last_7_days,
          count(*) as all_time
        from public.app_events
        group by event
      ) as c on c.event = e.event
    ),
    'shares_by_card', coalesce((
      select jsonb_agg(
        jsonb_build_object('card', s.card, 'count', s.n)
        order by s.n desc, s.card
      )
      from (
        select card, count(*) as n
        from public.app_events
        where event = 'share_initiated' and card is not null
        group by card
      ) as s
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke execute on function public.get_event_stats() from public;
grant execute on function public.get_event_stats() to authenticated;

-- Make PostgREST pick the new function up immediately.
notify pgrst, 'reload schema';
