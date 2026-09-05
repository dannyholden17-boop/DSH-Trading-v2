---
title: Truthfulness constraints
aliases:
  - Compliance rules
  - What Flux may say
tags:
  - dsh
  - flux
  - compliance
type: policy
status: enforced
---

# Truthfulness constraints

The standard every surface of [[Flux]] is judged against. A compliance pass in
September 2026 returned **BLOCKED** on the live site; these are the rules that
came out of clearing it, and the specific ways each one had already been broken.

> [!danger] The failure mode to watch for
> None of the problems below looked like lies while they were being written.
> They looked like placeholder content, or a nice default, or a number that
> made a panel feel finished. That is exactly how they get shipped.

## The rules

1. **No invented market events.** Not as placeholder, not as example, not as
   demo data. If a source has not produced a signal, the panel is empty and
   says why.
2. **No performance claims of any kind.** No win rate, no Sharpe, no edge, no
   backtest figure — because [[Backtest|Flux does not backtest]].
3. **A chart is a record or it is labelled an illustration.** Never both, never
   neither.
4. **Simulation is labelled at the figure**, not in a footnote at the bottom of
   the page.
5. **A label must match what is actually armed.** If a live-money account can
   receive an order, the page may not say no real order is placed.
6. **A counter counts what its label claims.** "Rounds filed" means rounds that
   filed something.
7. **Flux does not give advice.** No "consider a stop", no "trimming size".
8. **A short position's downside is stated wherever a short can be entered.**

## What was actually found

> [!bug] Blocking
> - `terminal.html` said *"no real order is placed"* on a page whose Brokerage
>   tab takes live Alpaca keys and routes the Place button to a real order.
> - Twenty invented market events across nine pages — an NVDA call sweep with a
>   fabricated premium, a TSLA 8-K cutting guidance, and *"71% win-rate over 5
>   years"* on a product that says it does not backtest. The dashboard ranked
>   them as "eight live research signals" with a **Trade** button; the portfolio
>   page filtered them to names the member actually held.

> [!bug] Non-blocking, still fixed
> - A backtest engine advertised in five places, including a whole
>   `research.html` section sitting directly above its own paragraph explaining
>   that the desk keeps no such record.
> - A "MonteCarlo · 10k paths · 1-day VaR(95)" agent computing `exposure * 0.031`.
> - An equity curve drawn from a random walk with `+0.32` added to every step,
>   so it could only ever rise — under a tag reading **live**.
> - `desk_floor()` reporting 107 rounds filed and `healthy: true` when 32 rounds
>   had ever filed anything and none in two days. See [[Live system state]].

## Where this is enforced

- The four standing labels on `terminal.html` repaint from the real account state.
- `F.SIGNALS` and `DSH.FINDINGS` are empty arrays with a comment explaining that
  they must stay that way; `F.sigNone()` / `DSH.noFindings()` render the empty state.
- `desk_floor()` counts rounds that put a note on the record, and exposes
  `stall_reason` so a quiet desk can say why it is quiet.

## Absences that must never be filled in

No real customers, testimonials, case studies, press, assets under management,
verified track record, or executed real-money trades. If a section needs one of
those to look finished, the section is wrong, not the data.
