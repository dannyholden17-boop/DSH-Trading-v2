---
title: Flux
aliases:
  - Flux desk
  - The product
tags:
  - dsh
  - flux
  - moc
type: moc
status: live
site: https://dsh-trading.com
---

# Flux

What [[DSH]] v2 actually shipped as. Flux is a research desk and paper-trading
workstation: it reads the market, argues with itself about what it finds, files
dated calls it can be graded on, and runs a simulated fund in the open.

> [!warning] The one rule everything else hangs off
> **Never let simulated data pass as real, and never invent a number.** Most of
> the work in [[Truthfulness constraints]] is undoing places where the site
> broke that rule before anyone was watching closely.

## Start here

- [[Truthfulness constraints]] — what Flux may and may not say. Read first.
- [[The trading floor]] — the desk hierarchy and the 46 agents
- [[The agent roster]] — all 152 subagents, and what was deliberately left out
- [[Live system state]] — what is deployed, what is blocked right now
- [[Market data]] — where quotes come from
- [[Front-end performance]] — layout stability, and how to keep it

## What is real

| Thing | State |
|---|---|
| The desk (analysts → review → executive) | Built, running, **stalled on API credit** |
| Paper trading terminal | Live |
| Brokerage connection | Read-only via Claude's Robinhood connector; Alpaca keys in-browser |
| The Flux Fund | Simulated, virtual money |
| Backtesting | **Does not exist.** See [[Backtest]] |
| Published desktop / mobile builds | None yet |

## What it is not

Flux is **not a broker-dealer** and gives **no investment advice**. Nothing
automated touches real money. A connected brokerage is read-only until the
member explicitly changes that, and no real order is ever placed without a
human confirming it.
