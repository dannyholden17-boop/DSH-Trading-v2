# Stripe subscriptions — setup (~15 min)

The code is all built (Edge Functions in `supabase/functions/`, the pricing buttons, and
the client billing helpers in `flux-supa.js`). To turn it on you need a Stripe account and
a few keys. Follow these once.

Project ref: `pyzcwddyagodmtjuvwdn`

---

## 1. Create the subscriptions table
Supabase → SQL editor (https://supabase.com/dashboard/project/pyzcwddyagodmtjuvwdn/sql/new),
paste and Run:

```sql
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text, status text,
  stripe_customer_id text, stripe_subscription_id text,
  current_period_end timestamptz, updated_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subs_read_own on public.subscriptions;
create policy subs_read_own on public.subscriptions for select using (auth.uid() = user_id);
-- inserts/updates happen only from the Edge Functions via the service role.
```

## 2. Stripe: products, prices, keys
1. Create a Stripe account → https://dashboard.stripe.com
2. **Products** → add two recurring products:
   - **Trader** — $49 / month → copy its **Price ID** (`price_...`)
   - **Desk** — $149 / month → copy its **Price ID**
3. **Developers → API keys** → copy the **Secret key** (`sk_live_...` or `sk_test_...` while testing).

## 3. Give Supabase the secrets
Install the CLI once (`npm i -g supabase`; `supabase login`), then:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_PRICE_TRADER=price_traderId \
  STRIPE_PRICE_DESK=price_deskId \
  --project-ref pyzcwddyagodmtjuvwdn
```

## 4. Deploy the Edge Functions
```bash
supabase functions deploy create-checkout --project-ref pyzcwddyagodmtjuvwdn
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref pyzcwddyagodmtjuvwdn
```
(You can also deploy from the Supabase dashboard → Edge Functions if you prefer no CLI.)

## 5. Wire the Stripe webhook
1. Stripe → **Developers → Webhooks → Add endpoint**
   - URL: `https://pyzcwddyagodmtjuvwdn.functions.supabase.co/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
2. Copy the endpoint's **Signing secret** (`whsec_...`) and set it:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --project-ref pyzcwddyagodmtjuvwdn
```

## Done
Now on **pricing.html**, "Start 14-day trial" (Trader) and "Get Desk" send a signed-in
user to Stripe Checkout; on success they land on the dashboard and
`public.subscriptions.status` becomes `active`. The site reads it as `FLUX.SUB` /
`FluxSupa.hasActivePlan()`.

**Testing:** use Stripe **test mode** keys + test card `4242 4242 4242 4242`, any future
expiry/CVC. Flip to live keys when ready.

### Gating premium features (optional, later)
`FluxSupa.hasActivePlan()` returns true for active/trialing subscribers, and `FLUX.SUB`
holds `{plan,status}`. Use them to lock premium features (e.g. real-broker autopilot,
Level 2 data) behind a plan when you decide what's paid vs free.
