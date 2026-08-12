---
title: Options Flow
tags:
  - dsh
  - engine
type: engine
status: online
cadence: 10s
latency_ms: 180
inputs:
  - options prints
  - open interest
  - implied vol
outputs:
  - unusual activity
  - gamma map
owner: Sentinel
---

# Options Flow

Tracks **unusual options activity** — large sweeps, open-interest shifts,
put/call skew, and gamma exposure. This is often the earliest read on where
informed money is leaning.

> [!info] Cadence
> Fastest engine on the desk: scans prints every **10s**.

## What it emits

- Sweep alerts (large, aggressive, at-the-ask orders)
- Open-interest deltas and unusual call/put ratios
- Gamma walls and skew flips

## Example finding

> [!example]
> **NVDA** — Massive call sweep: 14,200 contracts at $185, 3DTE, all at ask
> (~$4.6M premium). IV 62%, OI Δ +38%.

## Feeds

Strong flow signals are high-priority to the [[DSH Sentinel]] core, especially
when they agree with a [[Catalyst]] event or a [[Scanner]] breakout.

Part of the [[Engines.base|engine registry]].
