---
title: Scanner
tags:
  - dsh
  - engine
type: engine
status: online
cadence: 15s
latency_ms: 240
inputs:
  - market quotes
  - volume
outputs:
  - breakout candidates
  - volume anomalies
owner: Sentinel
---

# Scanner

Sweeps the **entire tradable universe** (~6,400 tickers) on a tight loop,
ranking anything that stands out: volume spikes, base breakouts, gaps, and
squeeze conditions.

> [!info] Cadence
> Runs every **15s** during market hours; a lighter pre-market gap scan runs
> before the open.

## What it emits

- Breakout candidates clearing resistance on above-average volume
- Relative-volume outliers (top 1% of the universe)
- Squeeze setups (high short float + rising price)

## Example finding

> [!example]
> **AMD** — Breaking out of a 6-week base on **2.7× volume**; cleared $172 with
> room to $186.

## Feeds

Signals go to the [[DSH Sentinel]] core, which cross-checks against
[[Options Flow]] and validates promising setups via [[Backtest]].

Part of the [[Engines.base|engine registry]].
