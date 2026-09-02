-- The home page shows the loop running rather than describing it.
--
-- desk_rounds (and its meta) is already public; desk_notes is members-only
-- and stays that way. What was missing was the SHAPE of a round's work --
-- how many filings each agent made and how the executive ruled -- without
-- exposing a word of what any of them wrote. This returns counts only,
-- plus the running totals the day sheet quotes.
create or replace function public.desk_floor()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select id, seq, stage, status, tickers, started_at, finished_at, meta
    from desk_rounds order by seq desc limit 1
  )
  select jsonb_build_object(
    'round', (select to_jsonb(r) - 'id' from r),
    'filings', coalesce((
      select jsonb_agg(x order by x.ord)
      from (select stage, agent, count(*)::int as n, min(id) as ord
            from desk_notes where round_id = (select id from r)
            group by stage, agent) x
    ), '[]'::jsonb),
    'rulings', coalesce((
      select jsonb_object_agg(verdict, n)
      from (select verdict, count(*)::int as n
            from desk_decisions where round_id = (select id from r)
            group by verdict) y
    ), '{}'::jsonb),
    'rounds_today',   (select count(*)::int from desk_rounds
                       where started_at > now() - interval '24 hours'),
    'rounds_total',   (select count(*)::int from desk_rounds),
    'filings_total',  (select count(*)::int from desk_notes),
    'rulings_total',  (select count(*)::int from desk_decisions),
    'names_covered',  (select count(distinct t)::int
                       from desk_rounds, lateral unnest(tickers) t),
    'scanned',        (select (meta->'breadth'->>'scanned')::int from r),
    'server_time',    now()
  );
$$;

revoke all on function public.desk_floor() from public;
grant execute on function public.desk_floor() to anon, authenticated;
