# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four confirmed audiences. The user was asked to name a primary and answered "all the
above", so no single audience outranks the others; the site has to serve all four
without lying to any of them.

1. **Retail traders with their own money at risk.** They already trade. They open Flux
   for a second opinion before placing a trade — the desk's read, Kronos's forecast, a
   place to test the idea on paper first. Brokerage connect matters to this group.
2. **People learning to trade.** Little or nothing at risk yet. The paper account is the
   point: real prices, real news, virtual money, somewhere to build judgment without
   losing anything.
3. **Prospective buyers or licensees of the product itself.** DSH Trading intends to sell
   Flux. This visitor is evaluating whether it is a real, working, finished product
   rather than a demo.
4. **Pro subscribers to the research.** They pay to read what the analysts, the Director
   and the Executive concluded. The terminal is where they act on it, not the draw.

## Product Purpose

Flux (dsh-trading.com, by DSH Trading) is an AI trading research desk with a
paper-trading workstation attached. A continuous research loop reasons about the US
equity universe and publishes its conclusions; members can act on them in a simulated
terminal with real market data and virtual money, or connect their own brokerage and act
for real under their own hand.

## Positioning

**The desk has a chain of command, and the whole argument is on the record.**

Three analysts (fundamentals, catalyst, tape) file on each name. A Director of Research
resolves where they disagree and passes one package forward. Two traders — Kronos, a
candle-forecasting model, and DSA, a transparent composite scorer — each price the trade.
An Executive approves, reduces or rejects, and says which trader it sided with. Every
filing is stored and readable.

Competing products show a signal. Flux shows the argument that produced it, including the
disagreements and the refusals.

## Operating Context

- Sessions cluster around US market hours; the desk itself paces faster while the market
  is open (a round every 15 minutes) and hourly overnight.
- The terminal is a dense multi-panel workstation used for long sittings, not glanced at.
- Members carry a watchlist, receive daily email briefs and price alerts, and follow a
  news wire that includes government and policy announcements.
- Pro access is sold through Stripe. An admin role exists and is verified server-side.

## Capabilities and Constraints

**Shipped capability**

- Paper terminal: live quotes, simulated fills, a virtual $100,000 book, order ticket,
  positions, orders, watchlist, market pulse.
- Charting: TradingView Lightweight Charts (vendored) — candles, volume, moving averages,
  benchmark compare, zoom and crosshair.
- Kronos forecasting engine: the real model when the Python bridge publishes forecasts,
  a seeded approximation in the browser otherwise. The stored payload records which ran.
- DSA scoring engine: a transparent composite over momentum, range, drawdown, value and
  stretch, with every component stored.
- The Desk: a persistent research loop, one stage per tick, paced by market hours.
- Daily Trade Ideas, Autopilot, a simulated Fund with a full trade ledger, Research
  (OpenBB bridge, optional), a merged news wire, Markets, Portfolio, Account, Pricing.
- Brokerage connect: Alpaca paper and live, through a stateless proxy. Credentials live in
  the member's browser and are never stored server-side.
- Bring-your-own Anthropic key; Pro gating on the algorithms; rate limits on free AI.

**Hard constraints that future work must preserve**

- Flux is **not a broker-dealer** and gives **no investment advice**.
- Everything is **simulated** unless a member connects their own brokerage, and even then
  no order is ever placed without an explicit human action. Autopilot does not trade a
  connected account.
- Results shown are hypothetical. Trading involves risk of loss including principal.
- The site is static HTML/CSS/vanilla JS deployed from `main` to Netlify with no build
  step, backed by Supabase. Assets are cache-busted with a `?v=N` query string.
- The owner's personal email must never appear in client code; `support@dsh-trading.com`
  is the public address.
- TradingView's scanner endpoints are unofficial and carry ToS risk for a commercial
  product. Recorded as a known exposure, undecided.

## Brand Commitments

- Name: **Flux**, by **DSH Trading**. Domain dsh-trading.com.
- The candlestick glyph mark (three bars, cyan / blue / violet) used as logo and favicon.
- **Dark is binding.** The user confirmed the redesign replaces the visual world but keeps
  a dark interface — it is a trading product looked at for hours. Recorded as a
  constraint on the new world, not as an endorsement of the current palette.
- All legal and disclosure copy survives any redesign unchanged in meaning.

## Evidence on Hand

**Real**

- Live equity quotes with a licensed-feed adapter, Yahoo and Stooq fallbacks.
- A real merged news wire: WSJ, Reuters and Bloomberg via Google News, plus CNBC,
  MarketWatch, Yahoo Finance, Investing.com, and government sources (Federal Reserve,
  BLS, SEC, White House, Treasury).
- Real TradingView technical ratings.
- Real desk output in Supabase — rounds, every analyst filing, every executive ruling.
- Real Kronos forecasts whenever the Python bridge is running.
- A design audit of the terminal (Sept 2026) recording measured WCAG AA contrast and
  target-size failures, 73 detector findings, and a 13/20 health score.

**Absences future work must not fabricate**

No real customers, testimonials, case studies, press, assets under management, verified
track record, or executed real-money trades. No performance claim of any kind.

## Product Principles

1. **Show the argument, not just the answer.** The disagreements and the refusals are the
   product; hiding them makes Flux another signal seller.
2. **Never let simulated data pass as real.** Paper numbers never appear where a member
   could read them as their brokerage's, and the word "simulated" is never buried.
3. **The machinery is inspectable.** Scores decompose, forecasts say which model produced
   them, filings are stored and readable.
4. **Serve four audiences on one site without lying to any of them.** A learner, a funded
   trader, a subscriber and an acquirer each need a different thing to be true, and all
   four claims must actually be true.
5. **A human's hand on every real order.** Nothing automated touches real money.
