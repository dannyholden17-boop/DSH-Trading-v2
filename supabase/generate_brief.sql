-- ============================================================
-- Flux AI — 24/7 server-side briefs & valuation models
-- Creates a `briefs` table and a `generate_brief()` function that ranks the
-- whole universe by Kronos predicted return (real forecast if fresh, else the
-- damped-drift proxy) into under/overvalued lists + a market tone, and stores
-- a row. A pg_cron job runs it every 15 minutes so the desk is "always
-- thinking" even with nobody on the site. The /ai page reads the latest row.
--
-- Paste into the Supabase SQL editor and Run:
--   https://supabase.com/dashboard/project/pyzcwddyagodmtjuvwdn/sql/new
-- Safe to re-run (idempotent).
-- ============================================================

-- ---- table: public read, service/definer write ----
create table if not exists public.briefs (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  tone       text,
  headline   text,
  under      jsonb default '[]'::jsonb,
  over       jsonb default '[]'::jsonb,
  text       text
);
alter table public.briefs enable row level security;
drop policy if exists briefs_read_all on public.briefs;
create policy briefs_read_all on public.briefs for select using (true);
grant select on public.briefs to anon, authenticated;
-- no insert/update policy => only the security-definer function writes.

-- ---- generator: rank by Kronos predicted return, store a brief ----
create or replace function public.generate_brief()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  und jsonb := '[]'::jsonb;
  ovr jsonb := '[]'::jsonb;
  n_und int := 0; n_ovr int := 0;
  tone text; head text; body text;
  top_t text; top_er numeric; top_last numeric;
  bot_t text; bot_er numeric; bot_last numeric;
begin
  -- undervalued: highest predicted returns first
  for r in
    select pri.ticker, pri.last, public.kronos_pred_return(pri.ticker) as er
    from public.prices pri
    where pri.last is not null
    order by public.kronos_pred_return(pri.ticker) desc
  loop
    exit when n_und >= 6;
    if r.er > 0.015 then
      und := und || jsonb_build_object('ticker', r.ticker, 'price', r.last,
              'fair', round(r.last * (1 + r.er), 2), 'edge', round(r.er, 4));
      n_und := n_und + 1;
      if top_t is null then top_t := r.ticker; top_er := r.er; top_last := r.last; end if;
    end if;
  end loop;

  -- overvalued: lowest predicted returns first
  for r in
    select pri.ticker, pri.last, public.kronos_pred_return(pri.ticker) as er
    from public.prices pri
    where pri.last is not null
    order by public.kronos_pred_return(pri.ticker) asc
  loop
    exit when n_ovr >= 6;
    if r.er < -0.015 then
      ovr := ovr || jsonb_build_object('ticker', r.ticker, 'price', r.last,
              'fair', round(r.last * (1 + r.er), 2), 'edge', round(r.er, 4));
      n_ovr := n_ovr + 1;
      if bot_t is null then bot_t := r.ticker; bot_er := r.er; bot_last := r.last; end if;
    end if;
  end loop;

  tone := case when n_und > n_ovr + 1 then 'risk-on'
               when n_ovr > n_und + 1 then 'risk-off'
               else 'balanced' end;

  body := 'Market read: ' || tone || '. The model sees ' || n_und ||
          ' names with upside and ' || n_ovr || ' stretched.';
  if top_t is not null then
    body := body || ' Most undervalued: ' || top_t || ' — model fair value $' ||
            round(top_last * (1 + top_er), 2) || ' vs $' || top_last || ' (' ||
            to_char(top_er * 100, 'FM999990.0') || '% edge).';
  end if;
  if bot_t is not null then
    body := body || ' Most overvalued: ' || bot_t || ' — model sees ' ||
            to_char(bot_er * 100, 'FM999990.0') || '% downside.';
  end if;
  body := body || ' Simulated model estimate, not advice.';
  head := 'Desk brief · ' || tone;

  insert into public.briefs(tone, headline, under, over, text)
    values (tone, head, und, ovr, body);

  -- keep only the most recent ~200 rows
  delete from public.briefs where id < (select max(id) - 200 from public.briefs);
end $$;
revoke all on function public.generate_brief() from public, anon, authenticated;

-- ---- schedule: every 15 minutes, and generate one now ----
select cron.unschedule('flux_generate_brief')
  where exists (select 1 from cron.job where jobname = 'flux_generate_brief');
select cron.schedule('flux_generate_brief', '*/15 * * * *', $$ select public.generate_brief(); $$);
select public.generate_brief();
