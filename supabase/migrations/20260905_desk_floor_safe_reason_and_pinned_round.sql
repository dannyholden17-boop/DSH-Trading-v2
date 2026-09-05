-- Two changes to desk_floor().
--
-- stall_reason used to be the provider's raw failure text. It is now a safe
-- code plus a sentence written for a reader, so the page can explain a quiet
-- desk without publishing the account's billing state. The raw text is no
-- longer stored at all -- see 20260905_desk_redact_vendor_errors.sql.
--
-- last_good_round pins a snapshot. The analysts page took the floor, then
-- issued a separate "latest round" query for filings, which could return a
-- different round than the one whose names and wire were already on screen.
-- The id, seq and timestamps of the newest round that actually filed are now
-- part of the same response, so one page render uses one round.
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
    select round_id, min(created_at) as at
    from desk_notes where ticker is not null
    group by round_id
  ),
  good as (
    select d.id, d.seq, d.started_at, d.finished_at, f.at as filed_at
    from filed f join desk_rounds d on d.id = f.round_id
    order by d.seq desc limit 1
  ),
  live as (select exists (select 1 from filed where at > now() - interval '6 hours') as ok)
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
    'healthy', (select (select status from r) not in ('failed','error') and (select ok from live)),
    'stall_code', (select case when (select ok from live) then null
                          else nullif((select meta->>'director_code' from r), '') end),
    'stall_reason', (select case
      when (select ok from live) then null
      else case (select meta->>'director_code' from r)
        when 'provider_credit'     then 'The analysis provider is unavailable, so no filing can be produced.'
        when 'provider_rate_limit' then 'The analysis provider is rate limiting the desk, so filings are paused.'
        when 'provider_auth'       then 'The desk cannot authenticate with the analysis provider.'
        when 'provider_timeout'    then 'The analysis provider is timing out, so rounds are not completing.'
        when 'provider_error'      then 'The analysis stage is failing, so no filing can be produced.'
        else 'The desk is not filing. The cause is being looked at.'
      end
    end),
    'last_good_round', (select to_jsonb(good) from good),
    'last_filed_at', (select max(at) from filed),
    'rounds_today', (select count(*)::int from filed where at > now() - interval '24 hours'),
    'rounds_total', (select count(*)::int from filed),
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
