# OpenBB → Flux bridge

Gives Flux a real research back end — company fundamentals, analyst consensus,
SEC filings and the macro backdrop — from [OpenBB](https://openbb.co).

OpenBB is a Python platform. It can't run in a browser or inside a Deno Edge
Function, so it lives here as a small HTTP service you deploy once (the same
shape as `kronos-bridge/`).

```
OpenBB (Python)  ──►  this service  ──►  Edge Function `research`  ──►  Flux site
                       (FastAPI)          (proxy + cache)             terminal · research page
```

**The site works without it.** With no bridge deployed the `research` function
answers `{ok:false, configured:false}`, the client latches that and stops
asking, and every widget that would have used OpenBB simply stays hidden.

## What it exposes

| Route | What you get | Provider (no API key) |
|---|---|---|
| `GET /health` | service + OpenBB status, provider list | — |
| `GET /fundamentals?symbol=NVDA` | P/E, forward P/E, PEG, margins, ROE/ROA, debt/equity, growth, market cap, sector, float | yfinance |
| `GET /estimates?symbol=NVDA` | analyst price target (high/low/consensus), coverage count, recommendation | yfinance |
| `GET /filings?symbol=NVDA` | recent SEC filings with links | sec |
| `GET /macro` | Treasury curve (3m/2y/5y/10y/30y + 10y−2y spread), effective fed funds, CPI YoY, unemployment | federal_reserve, oecd |
| `GET /movers?kind=gainers\|losers\|active` | market movers | yfinance |

Answers are cached in-process (30 min for company data, 6 h for macro), and the
`research` Edge Function caches again on top, so a busy site makes very few
upstream calls.

## Run it

```bash
cd openbb-bridge
pip install -r requirements.txt          # OpenBB is a big install, be patient
export BRIDGE_TOKEN="$(openssl rand -hex 24)"   # required in production
uvicorn app:app --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker build -t flux-openbb .
docker run -p 8000:8000 -e BRIDGE_TOKEN=... flux-openbb
```

Any host that runs a container works — Render, Railway, Fly.io, Cloud Run, or a
VPS. It needs ~1 GB of RAM and no GPU. Give it a stable HTTPS URL.

## Point Flux at it

```bash
supabase secrets set OPENBB_BRIDGE_URL="https://openbb.your-host.com"
supabase secrets set OPENBB_BRIDGE_TOKEN="the same BRIDGE_TOKEN"
```

Then check it end to end:

```bash
curl "https://<project>.supabase.co/functions/v1/research?health=1" -H "apikey: <publishable key>"
curl "https://<project>.supabase.co/functions/v1/research?symbol=NVDA" -H "apikey: <publishable key>"
```

Once that returns `"ok": true`, the terminal's **Key metrics** card grows the
OpenBB rows (forward P/E, margins, ROE, debt/equity, revenue growth, analyst
target and coverage) and the **Macro** card appears on the Research page.

## Optional API keys

Everything above is keyless. OpenBB reads provider keys from the environment,
so setting any of these upgrades the sources with no code change:

```
OPENBB_FRED_API_KEY      # US macro series, free from FRED
OPENBB_FMP_API_KEY       # deeper fundamentals + estimates
OPENBB_INTRINIO_API_KEY
OPENBB_TIINGO_API_KEY
```

## Security

* `BRIDGE_TOKEN` is required for every route except `/health`. Set it — an open
  bridge is an open proxy to whatever OpenBB can reach.
* Only the Edge Function should know the URL and token; the browser never sees
  either.
* No user data is sent to the bridge: it receives a ticker, nothing more.
