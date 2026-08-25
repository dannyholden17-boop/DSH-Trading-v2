-- Applied as migration: email_prefs_and_price_alerts
-- Notification preferences + price alerts, plus the pg_cron schedules that drive
-- the email-daily-brief and email-alerts Edge Functions. See EMAIL_SETUP.md.

create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  daily_brief boolean not null default false,
  price_alerts boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
create policy user_prefs_read   on public.user_prefs for select using (auth.uid() = user_id);
create policy user_prefs_insert on public.user_prefs for insert with check (auth.uid() = user_id);
create policy user_prefs_update on public.user_prefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.price_alerts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  op text not null check (op in ('above','below')),
  price numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  triggered_at timestamptz
);
alter table public.price_alerts enable row level security;
create policy price_alerts_read   on public.price_alerts for select using (auth.uid() = user_id);
create policy price_alerts_insert on public.price_alerts for insert with check (auth.uid() = user_id);
create policy price_alerts_update on public.price_alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy price_alerts_delete on public.price_alerts for delete using (auth.uid() = user_id);
create index if not exists price_alerts_active_idx on public.price_alerts(active) where active;

-- Schedules (already created). They read the service-role key from Vault; add it
-- with: select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
-- flux_daily_brief : '30 12 * * 1-5'      -> POST /functions/v1/email-daily-brief
-- flux_check_alerts: '*/15 13-20 * * 1-5' -> POST /functions/v1/email-alerts
