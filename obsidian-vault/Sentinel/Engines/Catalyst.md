---
title: Catalyst
tags:
  - dsh
  - engine
type: engine
status: online
cadence: 30s
latency_ms: 620
inputs:
  - filings
  - news wire
  - earnings calendar
outputs:
  - event signals
  - drift estimates
owner: Sentinel
---

# Catalyst

Watches the world for **events that move price**: earnings, 8-K/10-Q filings,
news headlines, FDA calendars, and analyst actions. For each event it estimates
the historical **drift** — how the stock tends to behave afterward.

> [!info] Cadence
> Polls filings and the news wire every **30s**; the earnings calendar refreshes
> hourly.

## What it emits

- Earnings-drift signals with a historical analog count
- Filing-based signals (e.g. guidance cut in an 8-K)
- Cross-asset catalysts (e.g. BTC breakout → high-beta proxies)

## Example finding

> [!example]
> **TSLA** — New 8-K: guidance cut on delivery outlook. Historically a **-2.3%
> 5-day drift** across 17 similar filings.

## Feeds

Events flow to the [[DSH Sentinel]] core; the core often pairs a Catalyst signal
with [[Options Flow]] positioning before raising a finding.

Part of the [[Engines.base|engine registry]].
