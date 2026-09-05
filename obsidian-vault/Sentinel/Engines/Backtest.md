---
title: Backtest
aliases:
  - The validator
tags:
  - dsh
  - engine
  - retired
type: engine
status: never-built
cadence: n/a
inputs: []
outputs: []
owner: Sentinel
---

# Backtest

> [!danger] This engine does not exist and was never built
> This note used to describe a live validator that replayed flagged setups
> across years of history and returned win-rate, average win/loss and edge
> stability, with `status: online` and a `latency_ms` in the frontmatter. None
> of that was ever true. It was a design sketch that read as a running system.
>
> The same claim had leaked into the product — a whole marketing section on
> `research.html`, an entry in two engine rosters, a "5-year backtest" offer in
> the desktop assistant, and "local backtest replay" on the download page. All
> removed. See [[Truthfulness constraints]].

**[[Flux]] does not backtest.** There is no historical replay engine, and any
backtested figure the product showed would have been invented.

## What exists instead

A **forward record**. Every prediction is filed with the date it has to be right
by, and on that date it is graded against the tape whether it worked or not. The
grade stays attached to the analyst who made the call, and the misses are kept
in the same log as the hits.

- Written by the analyst stage into `desk_predictions`
- Graded by the `desk-resolve-predictions` cron, every ten minutes
- Surfaced on the analysts scoreboard

> [!note] Currently empty
> `desk_predictions` has never held a row — not because the write path is
> broken, but because no round has run with both the prediction code and
> working API credit. See [[Live system state]].

## Why the distinction matters

A backtest says *this pattern existed in history*. A forward record says *this
desk said this, on this date, and here is what happened*. The second is harder,
slower, and starts at zero — and it is the only one of the two that cannot be
tuned after the fact.
