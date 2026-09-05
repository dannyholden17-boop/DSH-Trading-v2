-- desk_floor(): count rounds that filed, not rounds that started.
--
-- A round is written to desk_rounds the moment the tick fires, and finishes
-- with status 'done' whether or not the analyst stage ever ran. When the
-- Anthropic key is out of credit the director returns a 400, the round files
-- nothing, and it is still recorded as done. The RPC then reported:
--
--   rounds_total 107   healthy true   rounds_failed_today 0
--
-- against a record where only 32 rounds had ever produced a filing and none
-- in the previous two days. The home page rendered that as "Running - the
-- last round completed end to end", directly under copy promising the page
-- would not pretend otherwise.
--
-- Every consumer labels these numbers "rounds filed" or "rounds in 24h", so
-- rounds_total and rounds_today now mean rounds that filed something. The raw
-- attempt counts stay available as rounds_attempted_*, and health is derived
-- from whether the desk is still producing rather than from a status column
-- that cannot see the failure.
create or replace function public.desk_floor()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with r as (
    select id, seq, stage, status, tickers, started_at, finished_at, error, meta
    from desk_rounds order by seq desc limit 1
  ),
  filed as (
    -- a round counts only if it put at least one ticker-bearing note on record
    select distinct round_id, min(created_at) as at
    from desk_notes where ticker is not null
    group by round_id
  )
  select jsonb_build_object(
    'round', (select to_jsonb(r) - 'id' from r),
    'filings', coalesce((
      select jsonb_agg(x order by x.ord)
      from (select stage, agent, count(*)::int as n, min(id) as ord
            from desk_notes where round_id = (select id from r) and ticker is not null
            group by stage, agent) x
    ), '[]'::jsonb),
    'rulings', coalesce((
      select jsonb_object_agg(verdict, n)
      from (select verdict, count(*)::int as n
            from desk_decisions where round_id = (select id from r)
            group by verdict) y
    ), '{}'::jsonb),

    -- healthy means the desk is still filing, not merely still ticking
    'healthy', (
      select (select status from r) not in ('failed','error')
         and exists (select 1 from filed where at > now() - interval '6 hours')
    ),
    'stall_reason', (
      select case
        when exists (select 1 from filed where at > now() - interval '6 hours') then null
        else nullif(left(coalesce((select meta->>'director_err' from r), ''), 300), '')
      end
    ),
    'last_filed_at', (select max(at) from filed),

    -- what every caller labels "rounds": ones that filed
    'rounds_today', (select count(*)::int from filed where at > now() - interval '24 hours'),
    'rounds_total', (select count(*)::int from filed),

    -- and the raw attempts, for anything that needs to show the gap
    'rounds_attempted_today', (select count(*)::int from desk_rounds
                               where started_at > now() - interval '24 hours'),
    'rounds_attempted_total', (select count(*)::int from desk_rounds),
    'rounds_failed_today', (
      select count(*)::int from desk_rounds d
      where d.started_at > now() - interval '24 hours'
        and (d.status in ('failed','error') or not exists (select 1 from filed f where f.round_id = d.id))
    ),

    'filings_total',  (select count(*)::int from desk_notes),
    'rulings_total',  (select count(*)::int from desk_decisions),
    'predictions_total', (select count(*)::int from desk_predictions),
    'names_covered',  (select count(distinct t)::int
                       from desk_rounds, lateral unnest(tickers) t),
    'scanned',        (select (meta->'breadth'->>'scanned')::int from r),
    'server_time',    now()
  );
$function$;

-- ---------------------------------------------------------------------------
-- Superseded below by 20260905_desk_floor_safe_reason_and_pinned_round.sql,
-- which keeps these counts and adds the safe stall reason and the pinned
-- last_good_round. Kept here for the history of why the counts changed.
-- ---------------------------------------------------------------------------
