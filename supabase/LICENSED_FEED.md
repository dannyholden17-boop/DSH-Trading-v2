# Licensed market-data feed (optional)

The whole site gets its live prices from the `quotes` Edge Function (the client
poller `flux-feed.js` hydrates `FLUX.LIVE`, which every page reads). By default
`quotes` uses **Yahoo** (keyless) with a **Stooq** fallback — great for a demo,
but unofficial and not licensed for resale.

To route the entire site (terminal, markets, ticker tape, the Fund, and Fluxi)
through a **licensed** provider, set these Supabase secrets — no code change,
no redeploy of the site:

```bash
# pick ONE provider
supabase secrets set FLUX_QUOTES_PROVIDER=polygon    --project-ref pyzcwddyagodmtjuvwdn
supabase secrets set FLUX_QUOTES_KEY=<your_api_key>  --project-ref pyzcwddyagodmtjuvwdn
# Alpaca also needs a secret:
# supabase secrets set FLUX_QUOTES_SECRET=<your_api_secret> --project-ref pyzcwddyagodmtjuvwdn
```

Then redeploy the function once so it picks up the env:

```bash
supabase functions deploy quotes --project-ref pyzcwddyagodmtjuvwdn
```

## Supported providers

| `FLUX_QUOTES_PROVIDER` | Needs                         | Notes                                  |
|------------------------|-------------------------------|----------------------------------------|
| `polygon`              | `FLUX_QUOTES_KEY`             | Batch snapshot — fast, one call        |
| `alpaca`               | `FLUX_QUOTES_KEY` + `_SECRET` | Batch snapshots (latest trade + prev)  |
| `twelvedata`           | `FLUX_QUOTES_KEY`             | Batch quote — includes company name    |
| `finnhub`              | `FLUX_QUOTES_KEY`             | Per-symbol (concurrency-limited)       |

## Behavior & fallback

1. If `FLUX_QUOTES_PROVIDER` is set **and** returns data → the site uses it.
   The response is tagged `{"licensed": true, "provider": "...", "source": "..."}`.
2. Otherwise it falls back to **Yahoo**, then **Stooq**, exactly as before.

So a missing/expired key never breaks the site — it just degrades to the free
feed. This is deliberately separate from the **TradingView** technical-rating
integration (`tv` function): TradingView is shown as a second-opinion *rating*,
while this adapter is your authoritative *price* source when licensed.
