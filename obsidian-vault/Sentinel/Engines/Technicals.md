---
title: Technicals
tags:
  - dsh
  - engine
type: engine
status: online
cadence: 20s
latency_ms: 300
inputs:
  - price history
  - indicators
outputs:
  - indicator crosses
  - key levels
owner: Sentinel
---

# Technicals

Computes indicators across timeframes and flags the moments that matter:
MACD/EMA crosses, RSI divergences, VWAP reclaims, and support/resistance tests.

> [!info] Cadence
> Recomputes on a **20s** loop; intraday setups use 5m/15m candles.

## What it emits

- Trend-change signals (golden/death cross, MACD flip)
- Momentum divergences (price vs RSI)
- Level events (VWAP reclaim, breakout/breakdown of S/R)

## Example finding

> [!example]
> **AAPL** — VWAP reclaim after a morning flush + MACD bullish cross on the 15m.
> Reclaim setups here hit **68%**.

## Feeds

Technical confirmation raises the confidence the [[DSH Sentinel]] core assigns to
a finding; setups are stress-tested by [[Backtest]] before they're promoted.

Part of the [[Engines.base|engine registry]].
