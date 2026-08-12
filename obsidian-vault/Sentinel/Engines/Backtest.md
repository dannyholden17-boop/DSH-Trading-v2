---
title: Backtest
tags:
  - dsh
  - engine
type: engine
status: online
cadence: on-demand
latency_ms: 4200
inputs:
  - flagged setups
  - price history
outputs:
  - win-rate
  - edge stability
owner: Sentinel
---

# Backtest

The **validator**. When another engine flags a setup, Backtest replays it across
years of history to answer one question: *does this edge actually exist?* It
returns win-rate, average win/loss, and whether the edge is stable or decaying.

> [!info] Cadence
> Runs **on demand** — triggered by the [[DSH Sentinel]] core whenever a setup
> needs proof. Slowest engine (seconds, not milliseconds) by design.

## What it emits

- Win-rate and average +/- move for a flagged setup
- Edge-stability read (stable / decaying)
- Walk-forward validation results

## Example finding

> [!example]
> **AMZN** — Ran the flagged breakout over **5 years**: 71% win-rate, avg +3.9%
> / -1.8%, edge stable.

## Feeds

A passing backtest is what promotes a raw signal into a **trade idea** the
[[DSH Sentinel]] core is willing to put in front of you.

Part of the [[Engines.base|engine registry]].
