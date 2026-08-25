# Email: daily brief + price alerts

Everything is built and scheduled. Emails **send once you finish two setup steps**
(a Resend key + verifying your domain, and putting the service-role key in Vault
so the schedulers can authorize). Until then the jobs run and safely no-op.

## What's already live
- **Preferences** (`user_prefs` table): "Email me the daily brief" and
  "Price-alert notifications" toggles on the account page save server-side.
- **Starring** (`watchlist` table): the account page has a star box; starred
  stocks power the daily brief.
- **Price alerts** (`price_alerts` table): set "TICKER rises above / drops below $X"
  on the account page.
- **Edge functions**: `email-daily-brief` and `email-alerts` (both require the
  service-role bearer, so they can't be triggered by the public).
- **Schedules** (pg_cron, already created):
  - `flux_daily_brief` — weekdays 12:30 UTC (~8:30am ET)
  - `flux_check_alerts` — every 15 min, 13:00–20:00 UTC, weekdays

## Step 1 — Resend
1. Create an account at https://resend.com.
2. Add the domain **dsh-trading.com** and add the DNS records Resend shows
   (SPF + DKIM). Wait for it to verify — this is what keeps mail out of spam.
3. Create an API key.

## Step 2 — Supabase secrets
Dashboard → Project → **Edge Functions → Secrets** (or the CLI):
```bash
supabase secrets set RESEND_API_KEY=re_xxx           --project-ref pyzcwddyagodmtjuvwdn
supabase secrets set FLUX_EMAIL_FROM="Flux <noreply@dsh-trading.com>" --project-ref pyzcwddyagodmtjuvwdn
# optional (defaults to https://dsh-trading.com):
# supabase secrets set FLUX_SITE_URL=https://dsh-trading.com --project-ref pyzcwddyagodmtjuvwdn
```

## Step 3 — let the schedulers authorize (Vault)
The cron jobs call the functions with your **service-role** key, read from Vault.
Get the key from Dashboard → Settings → **API → `service_role`**, then run once
(SQL editor):
```sql
select vault.create_secret('PASTE_SERVICE_ROLE_KEY_HERE', 'service_role_key');
```
That's it — the two scheduled jobs will start sending on their next run.

## Test it now (optional)
After Step 3, fire the daily brief immediately:
```sql
select net.http_post(
  url := 'https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/email-daily-brief',
  headers := jsonb_build_object(
    'content-type','application/json',
    'authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key')
  ),
  body := '{}'::jsonb, timeout_milliseconds := 90000
);
-- then read the response:
select status_code, content from net._http_response order by id desc limit 1;
```
`resend_configured:false` in the response means Step 2 isn't done yet;
`sent:N` means emails went out.

## Managing the schedule
```sql
select jobname, schedule, active from cron.job where jobname like 'flux_%';
select cron.unschedule('flux_daily_brief');   -- stop the brief
select cron.unschedule('flux_check_alerts');  -- stop alert checks
```
Adjust the times in `cron.schedule(...)` if you want different hours (they're in
UTC; US market open is 13:30 UTC during EDT, 14:30 during EST).
