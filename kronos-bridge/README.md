# Kronos → Flux bridge

Powers the Flux trading agent with the **real** [Kronos](https://github.com/dannyholden17-boop/Kronos)
model instead of the built-in approximation.

## How it fits together

```
Kronos model (PyTorch)  ──►  push_forecasts.py  ──►  Supabase `forecasts` table  ──►  Flux site + autopilot
      (your fork)              (this folder)            (public read)                  (uses real forecasts live)
```

The Flux site already reads the `forecasts` table every minute (`FLUX.KFORECAST`) and the
server-side autopilot trades on it. **You don't touch the site** — just run this bridge and
the agent switches from the in-browser Kronos-approximation to the real model.

## What it does

For each ticker in the Flux universe it:
1. pulls recent OHLCV,
2. runs `KronosPredictor.predict(...)` (your fork's API) to forecast the next 5 candles,
3. computes the **predicted return** and the Kronos signal (`>+2% BUY`, `<-2% SELL`, else `HOLD`),
4. upserts `{ticker, pred_close, pred_return, confidence, horizon, path, model}` into Supabase.

## Run it

From inside your Kronos fork checkout (so `from model import ...` resolves):

```bash
pip install -r requirements.txt yfinance supabase

export SUPABASE_URL="https://pyzcwddyagodmtjuvwdn.supabase.co"
export SUPABASE_SERVICE_KEY="<service_role key — Supabase → Settings → API>"

python /path/to/kronos-bridge/push_forecasts.py            # one pass
python /path/to/kronos-bridge/push_forecasts.py --loop 900 # every 15 min
```

Runs on CPU or GPU (GPU is much faster). Good hosts: a spare box, Google Colab,
[Modal](https://modal.com), or [Replicate](https://replicate.com) on a schedule.

## Security

- Use the **service_role** key (only it may write `forecasts`; the site uses the public
  key which is read-only here). **Never** commit it or put it in the website.
- The `forecasts` table is world-readable (it's just predictions) and only the service
  role can write it (enforced by row-level security).
