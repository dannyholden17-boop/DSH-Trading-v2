-- ============================================================
-- Kronos strategy — Supabase migration
-- Creates the `forecasts` table (fed by push_forecasts.py) and rewires the
-- autopilot fund to trade the Kronos way: forecast-driven rotation —
-- hold names the model predicts up (> +2%), exit when the forecast reverses,
-- rank by predicted return. Uses real Kronos forecasts when present, else a
-- damped recent-drift proxy so it keeps trading with no GPU.
-- (Applied to project pyzcwddyagodmtjuvwdn.)
-- ============================================================

-- ---- forecasts table (real Kronos output; public read, service-role write) ----
create table if not exists public.forecasts (
  ticker text primary key,
  last numeric,
  pred_close numeric,
  pred_return numeric,
  confidence numeric,
  horizon int,
  model text,
  path jsonb,
  updated_at timestamptz default now()
);
alter table public.forecasts enable row level security;
drop policy if exists forecasts_read_all on public.forecasts;
create policy forecasts_read_all on public.forecasts for select using (true);
-- no insert/update policy => only the service_role (bridge) can write.

-- ---- predicted return for a ticker: real Kronos if fresh, else drift proxy ----
create or replace function public.kronos_pred_return(p_ticker text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare pr numeric; last_p numeric; prev_p numeric; f_ret numeric; f_age interval;
begin
  select pred_return, (now() - updated_at) into f_ret, f_age from public.forecasts where ticker = p_ticker;
  if f_ret is not null and f_age < interval '2 hours' then
    return f_ret;                                   -- real Kronos forecast
  end if;
  select last, prev_close into last_p, prev_p from public.prices where ticker = p_ticker;
  if last_p is null or prev_p is null or prev_p = 0 then return 0; end if;
  return ((last_p - prev_p) / prev_p) * 0.5;        -- damped drift proxy
end $$;
revoke all on function public.kronos_pred_return(text) from public, anon, authenticated;

-- ---- autopilot: Kronos forecast-driven rotation ----
create or replace function public.autopilot_run()
returns void language plpgsql security definer set search_path = public as $$
declare f public.autopilot_fund%rowtype; p record; pick record; eq numeric; budget numeric;
  qty numeric; n_pos int; pr numeric; thresh numeric := 0.02; max_pos int := 5;
begin
  select * into f from public.autopilot_fund where id = 1 for update;

  -- 1) EXIT holdings whose Kronos forecast is no longer a BUY (flip on reversal)
  for p in select ap.ticker, ap.qty, pr2.last from public.autopilot_positions ap
           join public.prices pr2 on pr2.ticker = ap.ticker loop
    pr := public.kronos_pred_return(p.ticker);
    if pr <= thresh then
      update public.autopilot_fund set cash = cash + p.qty * p.last, updated_at = now() where id = 1;
      delete from public.autopilot_positions where ticker = p.ticker;
      insert into public.autopilot_orders(side, ticker, qty, price, reason)
        values ('sell', p.ticker, p.qty, p.last, 'kronos: forecast ' || round(pr*100,2) || '% (exit)');
    end if;
  end loop;

  -- 2) ENTER strongest BUY-signalled names up to the position cap
  select count(*) into n_pos from public.autopilot_positions;
  for pick in
    select pri.ticker, pri.last, public.kronos_pred_return(pri.ticker) as pr
    from public.prices pri
    where pri.ticker not in (select ticker from public.autopilot_positions)
    order by public.kronos_pred_return(pri.ticker) desc
    limit max_pos
  loop
    exit when n_pos >= max_pos;
    select cash into budget from public.autopilot_fund where id = 1;
    if pick.pr > thresh and budget > 300 then
      eq := public.autopilot_equity_now();
      budget := least(budget, eq / max_pos);
      qty := floor(budget / pick.last);
      if qty >= 1 then
        update public.autopilot_fund set cash = cash - qty * pick.last, updated_at = now() where id = 1;
        insert into public.autopilot_positions(ticker, qty, avg) values (pick.ticker, qty, pick.last);
        insert into public.autopilot_orders(side, ticker, qty, price, reason)
          values ('buy', pick.ticker, qty, pick.last, 'kronos: forecast +' || round(pick.pr*100,2) || '% (rank ' || (n_pos+1) || ')');
        n_pos := n_pos + 1;
      end if;
    end if;
  end loop;

  -- 3) snapshot equity
  insert into public.autopilot_equity(ts, equity, cash)
    values (now(), round(public.autopilot_equity_now(),2), (select cash from public.autopilot_fund where id = 1))
    on conflict (ts) do nothing;
end $$;
revoke all on function public.autopilot_run() from public, anon, authenticated;
