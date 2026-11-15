-- Unique visitors (Nov 14, 2026 — the owner's call: "I want
-- unique. I assume most of the traffic reported today is me").
--
-- Two parts:
-- 1. app_events gains a visitor_id column. The client stamps
--    every event with a random id generated once per browser
--    and kept in localStorage (weezer-visitor-id). No cookie,
--    no fingerprinting, no cross-device identity: the same
--    human on phone + iPad is two visitors, and a browser that
--    clears storage becomes a new one. Rows written before
--    this migration carry null and never count as uniques —
--    unique counts are honest from today forward only.
-- 2. get_event_stats() gains a top-level "visitors" block,
--    computed from session_start rows: distinct visitor_id
--    counts for today / last 7 days / all time (Pacific day
--    boundaries, as since Nov 9), plus the same three counts
--    excluding rows stamped with the owner's own user id —
--    his signed-in testing no longer inflates the number he
--    reads. (His signed-OUT visits still count; there's no
--    way to know they're him, and the block doesn't pretend.)
--    Everything else in the payload is unchanged.

alter table public.app_events
  add column if not exists visitor_id uuid;

create index if not exists app_events_visitor_idx
  on public.app_events (visitor_id)
  where visitor_id is not null;

create or replace function public.get_event_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_start timestamptz :=
    (date_trunc('day', now() at time zone 'America/Los_Angeles')
      at time zone 'America/Los_Angeles');
  v_week_start timestamptz := v_today_start - interval '6 days';
  v_owner uuid := '02882daa-369f-4b03-aa45-b89bbf569f7f'::uuid;
begin
  if auth.uid() is distinct from v_owner then
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
          count(*) filter (where created_at >= v_today_start) as today,
          count(*) filter (
            where created_at >= v_week_start
          ) as last_7_days,
          count(*) as all_time
        from public.app_events
        group by event
      ) as c on c.event = e.event
    ),
    'visitors', (
      select jsonb_build_object(
        'today', count(distinct visitor_id) filter (
          where created_at >= v_today_start),
        'last_7_days', count(distinct visitor_id) filter (
          where created_at >= v_week_start),
        'all_time', count(distinct visitor_id),
        'today_excl_owner', count(distinct visitor_id) filter (
          where created_at >= v_today_start
            and user_id is distinct from v_owner),
        'last_7_days_excl_owner', count(distinct visitor_id) filter (
          where created_at >= v_week_start
            and user_id is distinct from v_owner),
        'all_time_excl_owner', count(distinct visitor_id) filter (
          where user_id is distinct from v_owner)
      )
      from public.app_events
      where event = 'session_start' and visitor_id is not null
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

notify pgrst, 'reload schema';
