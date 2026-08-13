---
title: Risk
tags:
  - dsh
  - engine
type: engine
status: online
cadence: 5s
latency_ms: 90
inputs:
  - your positions
  - live P&L
outputs:
  - drawdown alerts
  - exposure map
owner: Sentinel
---

# Risk

The engine pointed at **your book**, not the market. It watches open positions
for drawdown, proximity to stops, correlation to the index, and concentration by
sector — and raises alerts before things get uncomfortable.

> [!warning] Highest priority
> Risk findings jump the queue. A position nearing its stop matters more than any
> new idea.

## What it emits

- Drawdown alerts as a position approaches its stop
- Correlation spikes (your book moving as one with SPX)
- Sector/exposure concentration warnings

## Example finding

> [!example]
> **META** — Position drawdown hit **-4.2%**, nearing your -5% stop. Correlation
> to SPX rose to 0.81.

## Feeds

Risk alerts surface directly in the [[DSH Sentinel]] feed and gate what the
[[Live Trading Blueprint|order layer]] will allow.

Part of the [[Engines.base|engine registry]].
