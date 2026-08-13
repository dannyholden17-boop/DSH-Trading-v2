---
title: DSH Trading v2
aliases:
  - Home
  - DSH
  - Map of Content
tags:
  - moc
  - dsh
status: active
---

# DSH Trading v2

Home base for the next version of the DSH trading terminal. This vault holds the
design concepts, the always-on **[[DSH Sentinel]]** bot, its background engines,
and the architecture that makes it real.

> [!tip] Start here
> New to the project? Read [[DSH Sentinel]] first — it's the heart of v2 — then
> skim the [[Roadmap]].

## Design concepts

Three progressively bolder reimaginings of the front end.

- [[Aurora]] — a polished restyle of the classic terminal
- [[Aurora v2]] — a deeper rethink of layout and hierarchy
- [[Conversational Cockpit]] — no dashboard; you *ask* and DSH assembles the answer

## The living bot

- [[DSH Sentinel]] — an autonomous desk that researches around the clock
- Engines: [[Scanner]] · [[Catalyst]] · [[Options Flow]] · [[Technicals]] · [[Risk]] · [[Backtest]]
- [[Engines.base|Engine registry]] — live table of every engine

## Architecture

- [[Live Trading Blueprint]] — how orders and live trading are wired
- [[Realtime Data Flow]] — how findings stream from engine to screen
- [[Architecture.canvas|System canvas]] — the whole thing on one board

## Planning

- [[Roadmap]] — where this is going and in what order

## The idea in one line

> [!abstract] Thesis
> A bot that *lives* in the app — six background engines run at all times,
> the agent reasons over what they surface, and it **spits out findings on its
> own** into a live feed you can act on. Perplexity-for-trading, but it never
> stops working.
