---
title: DSH Sentinel
aliases:
  - Sentinel
  - The living bot
tags:
  - dsh
  - sentinel
  - concept
status: prototype
prototype: dsh-living-bot.html
---

# DSH Sentinel

An **always-on autonomous market desk**. You open the app and DSH is already
working: a glowing core with a heartbeat, six [[#Background engines|background
engines]] running at all times, and a live feed of findings the bot produces
**on its own** — no prompt required.

> [!abstract] What makes it "alive"
> Most trading apps wait for you to click. Sentinel inverts that: the engines
> never stop, the agent continuously reasons over their output, and it pushes
> new [[#Findings|findings]] into the feed the moment they appear.

There's a working prototype at `dsh-living-bot.html` (see [[Roadmap]]).

## Anatomy

| Piece | Role |
|-------|------|
| **Core** | The agent loop — reasons over engine output, decides what's worth surfacing |
| **Engines** | Six always-on workers, each scanning a different dimension of the market |
| **Feed** | The stream of findings, newest first, each tagged by the engine that found it |
| **Mind** | A live ticker of what the bot is thinking right now |

## Background engines

Each engine runs on its own cadence and writes candidate signals the core scores.

- [[Scanner]] — sweeps the whole universe for setups
- [[Catalyst]] — earnings, filings, news, catalysts
- [[Options Flow]] — unusual options activity and positioning
- [[Technicals]] — indicator crosses, divergences, key levels
- [[Risk]] — watches your book: drawdown, correlation, stops
- [[Backtest]] — validates every flagged setup against history

See the live [[Engines.base|engine registry]] for status and cadence at a glance.

## Findings

A finding is one atomic insight the bot emits. Every finding carries:

- a **ticker** and current move
- a **severity** (info / med / high)
- the **engine** that produced it
- a one-line **insight** in plain language
- supporting **stats** and a **confidence** score
- **actions**: Dig in · Paper trade · Backtest · Watch

> [!example] A real finding
> **NVDA · high · Options Flow** — Massive call sweep: 14,200 contracts at the
> $185 strike, 3DTE, all at ask (~$4.6M premium). *Confidence 88%.*

## How it runs (short version)

```mermaid
graph LR
    E[Engines on cron] --> Q[(Signal queue)]
    Q --> C[Core agent loop]
    C --> F[(Findings table)]
    F --> RT[Realtime push]
    RT --> UI[Live feed]
    class DSH Sentinel internal-link;
```

The full wiring is in [[Realtime Data Flow]].

## Related

- [[Conversational Cockpit]] — the ask-anything surface Sentinel feeds into
- [[Live Trading Blueprint]] — how a finding becomes an actual order
