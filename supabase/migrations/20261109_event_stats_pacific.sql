-- Site stats day boundaries move to Pacific time (Nov 9, 2026):
-- the owner reads "Today" from the US Pacific coast, and the
-- UTC boundary rolled the day over at 4 PM his time — the
-- counter appeared to fall off a cliff every afternoon.
-- Same function, same gate, same payload; only the two window
-- boundaries change:
--   today       = rows since Pacific midnight
--                 (America/Los_Angeles, DST-aware by name)
--   last_7_days = rows since Pacific midnight six days ago
--                 (today plus the six days before it)

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
          count(*) filter (where created_at >= v_today_start) as today,
          count(*) filter (
            where created_at >= v_week_start
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
