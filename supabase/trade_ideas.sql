-- Flux — daily AI trade ideas: table, RLS gating, public count RPC, and daily cron.
-- Applied to project pyzcwddyagodmtjuvwdn. Ideas are written by the `generate-ideas` edge function.

create table if not exists public.trade_ideas (
  id bigint generated always as identity primary key,
  day date not null,
  idx int not null,              -- 1..N; idx=1 is the free teaser
  ticker text not null,
  name text,
  sector text,
  kind text,                     -- 'momentum' | 'rebound'
  direction text default 'long',
  price numeric,
  target numeric,
  conviction int,                -- 0..100
  horizon text,                  -- 'days' | 'weeks' | 'months'
  headline text,
  thesis text,
  catalyst text,
  risk text,
  created_at timestamptz default now()
);
create unique index if not exists trade_ideas_day_idx on public.trade_ideas(day, idx);
create index if not exists trade_ideas_day on public.trade_ideas(day desc);

alter table public.trade_ideas enable row level security;

drop policy if exists trade_ideas_teaser on public.trade_ideas;
drop policy if exists trade_ideas_auth on public.trade_ideas;
-- logged-out visitors: only the first idea of any day (the free teaser)
create policy trade_ideas_teaser on public.trade_ideas for select to anon using (idx = 1);
-- signed-in users: everything
create policy trade_ideas_auth on public.trade_ideas for select to authenticated using (true);

grant select on public.trade_ideas to anon, authenticated;

-- public count of the latest day's ideas (so the UI can show how many are locked)
create or replace function public.ideas_today()
returns table(day date, total bigint)
language sql security definer stable as $$
  select day, count(*)::bigint as total from public.trade_ideas
  where day = (select max(day) from public.trade_ideas)
  group by day
$$;
grant execute on function public.ideas_today() to anon, authenticated;

-- generate fresh ideas once a day at 13:45 UTC (after the US open); idempotent per day
select cron.schedule('flux_generate_ideas', '45 13 * * *', $$
  select net.http_post(
    url:='https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/generate-ideas',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb,
    timeout_milliseconds:=90000
  );
$$);
