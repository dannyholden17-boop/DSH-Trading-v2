-- Flux — the persistent research desk.
--
-- A continuously running research loop with a real chain of command:
--
--     3 analysts  ──►  Director of Research  ──►  two traders  ──►  Executive
--   fundamentals            synthesises            Kronos + DSA      green light
--   catalyst                the notes into         turn the call     (approve /
--   tape                    one package            into a trade       reduce / reject)
--
-- Each round is a state machine advanced one stage per tick by the `desk` Edge
-- Function, so no single invocation is long-running and a crash mid-stage is
-- recoverable. pg_cron ticks every minute; the engine paces new rounds itself
-- (faster during market hours, slower overnight) so "persistent" doesn't mean
-- "burning money".

-- ---------------------------------------------------------------- rounds ----
create table if not exists public.desk_rounds (
  id          bigint generated always as identity primary key,
  seq         bigint not null,
  stage       text   not null default 'open',      -- open|analysts|director|traders|executive|done
  status      text   not null default 'running',   -- running|done|error
  tickers     text[] not null default '{}',
  started_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  finished_at timestamptz,
  error       text,
  meta        jsonb  not null default '{}'::jsonb
);
create index if not exists desk_rounds_seq  on public.desk_rounds(seq desc);
create index if not exists desk_rounds_open on public.desk_rounds(status) where status = 'running';

-- ----------------------------------------------------------------- notes ----
-- Everything each agent produced, kept so members can read the desk's work and
-- so a later round can look back at what was said.
create table if not exists public.desk_notes (
  id         bigint generated always as identity primary key,
  round_id   bigint not null references public.desk_rounds(id) on delete cascade,
  stage      text not null,          -- analyst|director|trader
  agent      text not null,          -- fundamentals|catalyst|tape|director|kronos|dsa
  ticker     text,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists desk_notes_round on public.desk_notes(round_id);
create index if not exists desk_notes_tk    on public.desk_notes(ticker, created_at desc);

-- ------------------------------------------------------------- decisions ----
-- The executive's ruling. Only rows here are "green lit".
create table if not exists public.desk_decisions (
  id             bigint generated always as identity primary key,
  round_id       bigint not null references public.desk_rounds(id) on delete cascade,
  ticker         text not null,
  name           text,
  verdict        text not null,            -- approved|reduced|rejected
  side           text,                     -- long|short|avoid|flat
  price          numeric,
  entry          numeric,
  stop           numeric,
  target         numeric,
  size_pct       numeric,
  conviction     int,
  horizon        text,
  headline       text,
  reason         text,
  risk_flags     text,
  director_score int,
  teaser         boolean not null default false,   -- the one row logged-out visitors see
  kronos         jsonb,
  dsa            jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists desk_dec_round on public.desk_decisions(round_id);
create index if not exists desk_dec_time  on public.desk_decisions(created_at desc);
create index if not exists desk_dec_tk    on public.desk_decisions(ticker, created_at desc);

-- ------------------------------------------------------------------ RLS -----
alter table public.desk_rounds    enable row level security;
alter table public.desk_notes     enable row level security;
alter table public.desk_decisions enable row level security;

-- anyone may watch the desk running (this is the shop window)
drop policy if exists desk_rounds_read on public.desk_rounds;
create policy desk_rounds_read on public.desk_rounds for select using (true);

-- the analysts' actual work is for signed-in members
drop policy if exists desk_notes_auth on public.desk_notes;
create policy desk_notes_auth on public.desk_notes for select to authenticated using (true);

-- logged out: one teaser call per round. signed in: everything.
drop policy if exists desk_dec_teaser on public.desk_decisions;
drop policy if exists desk_dec_auth   on public.desk_decisions;
create policy desk_dec_teaser on public.desk_decisions for select to anon using (teaser);
create policy desk_dec_auth   on public.desk_decisions for select to authenticated using (true);

grant select on public.desk_rounds    to anon, authenticated;
grant select on public.desk_notes     to authenticated;
grant select on public.desk_decisions to anon, authenticated;

-- ------------------------------------------------------------ live status ---
-- One cheap call the site polls for the header: what the desk is doing now.
create or replace function public.desk_status()
returns table(
  seq bigint, stage text, status text, tickers text[],
  started_at timestamptz, finished_at timestamptz,
  approved bigint, rejected bigint, rounds_today bigint
)
language sql security definer stable as $$
  with r as (
    select * from public.desk_rounds order by seq desc limit 1
  )
  select r.seq, r.stage, r.status, r.tickers, r.started_at, r.finished_at,
    (select count(*) from public.desk_decisions d where d.round_id = r.id and d.verdict <> 'rejected'),
    (select count(*) from public.desk_decisions d where d.round_id = r.id and d.verdict = 'rejected'),
    (select count(*) from public.desk_rounds x where x.started_at > now() - interval '24 hours')
  from r
$$;
grant execute on function public.desk_status() to anon, authenticated;

-- ------------------------------------------------------------------ cron ----
-- Tick every minute. The function itself decides whether to advance the open
-- round or open a new one, so the loop never stops but stays paced.
select cron.unschedule('flux_desk_tick')
  where exists (select 1 from cron.job where jobname = 'flux_desk_tick');
select cron.schedule('flux_desk_tick', '* * * * *', $$
  select net.http_post(
    url:='https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/desk',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{"tick":true}'::jsonb,
    timeout_milliseconds:=120000
  );
$$);

-- Housekeeping: keep a week of rounds. Notes and decisions cascade.
select cron.unschedule('flux_desk_prune')
  where exists (select 1 from cron.job where jobname = 'flux_desk_prune');
select cron.schedule('flux_desk_prune', '17 4 * * *', $$
  delete from public.desk_rounds where started_at < now() - interval '7 days';
$$);
