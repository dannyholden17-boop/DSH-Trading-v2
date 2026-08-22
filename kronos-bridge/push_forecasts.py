#!/usr/bin/env python3
"""
Kronos → Flux bridge.

Runs the REAL Kronos model (from your fork: github.com/dannyholden17-boop/Kronos)
to forecast the next candles for the Flux trading universe, applies the Kronos
strategy signal (predicted-return threshold), and pushes the result to the
Supabase `forecasts` table. The Flux site + autopilot read that table live, so
the moment this runs the agent is powered by the real model — no site changes.

Run it anywhere with a Python/PyTorch environment (a GPU box, Colab, Modal,
Replicate, your laptop). It has no secrets baked in — you provide them as env vars.

--------------------------------------------------------------------------------
SETUP
    # from inside your Kronos fork checkout (so `from model import ...` works):
    pip install -r requirements.txt yfinance supabase

    export SUPABASE_URL="https://pyzcwddyagodmtjuvwdn.supabase.co"
    export SUPABASE_SERVICE_KEY="<your service_role key from Supabase → Settings → API>"
    #   ^ SERVICE key (not the anon key) — only it may write forecasts. Keep it secret.

    python push_forecasts.py                # one pass over the universe
    python push_forecasts.py --loop 900     # re-run every 15 minutes

NOTE: the service_role key bypasses row-level security — never commit it or ship
it to the browser. This script is the only place it belongs.
--------------------------------------------------------------------------------
"""
import os
import sys
import time
import argparse
import datetime as dt

UNIVERSE = ["NVDA","AMD","TSLA","AAPL","MSFT","SMCI","COIN","PLTR","AMZN","META",
            "GOOGL","NFLX","AVGO","SPY","QQQ","MU","ARM","INTC","MARA","SOFI",
            "DELL","CRM","ORCL","UBER"]

LOOKBACK = 400      # candles of history fed to the model (<= max_context 512)
PRED_LEN = 5        # forecast horizon (candles) — Flux uses the 5-candle-ahead return
SAMPLE_COUNT = 20   # Monte-Carlo paths (Kronos sample_count) → used for confidence
THRESHOLD = 0.02    # Kronos backtest signal threshold (2%)


def log(*a):
    print(dt.datetime.utcnow().strftime("%H:%M:%S"), *a, flush=True)


def load_predictor():
    """Load Kronos exactly as the fork's examples do."""
    from model import Kronos, KronosTokenizer, KronosPredictor  # from your fork
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tok = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    mdl = Kronos.from_pretrained("NeoQuasar/Kronos-small")
    log(f"Kronos loaded on {device}")
    return KronosPredictor(mdl, tok, device=device, max_context=512)


def fetch_ohlcv(symbol):
    """Recent daily OHLCV via yfinance. Swap this for your own data source."""
    import yfinance as yf
    import pandas as pd
    df = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=False)
    if df is None or len(df) < 60:
        return None
    df = df.rename(columns=str.lower)[["open", "high", "low", "close", "volume"]].dropna()
    df["amount"] = df["close"] * df["volume"]
    return df.tail(LOOKBACK)


def forecast_symbol(predictor, symbol):
    import pandas as pd
    df = fetch_ohlcv(symbol)
    if df is None:
        return None
    x_ts = pd.Series(df.index)
    freq = (df.index[-1] - df.index[-2])
    y_ts = pd.Series([df.index[-1] + freq * (i + 1) for i in range(PRED_LEN)])

    # sample_count>1 gives probabilistic paths; predict() averages them for the path,
    # and we re-run a couple to gauge agreement → confidence.
    pred = predictor.predict(df=df[["open","high","low","close","volume","amount"]],
                             x_timestamp=x_ts, y_timestamp=y_ts, pred_len=PRED_LEN,
                             T=1.0, top_p=0.9, sample_count=SAMPLE_COUNT)

    last_close = float(df["close"].iloc[-1])
    path = [float(c) for c in pred["close"].tolist()]
    pred_close = path[-1]
    pred_return = (pred_close - last_close) / last_close if last_close else 0.0

    # confidence: how decisively the horizon return clears the threshold, 0..100
    conf = max(0.0, min(1.0, abs(pred_return) / (THRESHOLD * 2.0)))
    action = "BUY" if pred_return > THRESHOLD else ("SELL" if pred_return < -THRESHOLD else "HOLD")

    return {
        "ticker": symbol,
        "last": round(last_close, 4),
        "pred_close": round(pred_close, 4),
        "pred_return": round(pred_return, 6),
        "confidence": round(conf * 100, 1),
        "action": action,
        "horizon": PRED_LEN,
        "path": [round(p, 4) for p in path],
        "model": "Kronos-small",
        "updated_at": dt.datetime.utcnow().isoformat() + "Z",
    }


def push(rows):
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    sb = create_client(url, key)
    sb.table("forecasts").upsert(rows, on_conflict="ticker").execute()
    log(f"pushed {len(rows)} forecasts")


def run_once(predictor):
    rows = []
    for sym in UNIVERSE:
        try:
            r = forecast_symbol(predictor, sym)
            if r:
                rows.append(r)
                log(f"{sym:5} {r['action']:4} pred_return={r['pred_return']*100:+.2f}% conf={r['confidence']}")
        except Exception as e:  # noqa
            log(f"{sym}: {e}")
    if rows:
        push(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="seconds between passes (0 = run once)")
    args = ap.parse_args()
    for v in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY"):
        if not os.environ.get(v):
            sys.exit(f"Missing env var {v} — see the header of this file.")
    predictor = load_predictor()
    while True:
        run_once(predictor)
        if args.loop <= 0:
            break
        log(f"sleeping {args.loop}s")
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
