# Flux as a Claude connector

**Status:** design + working skeleton (`supabase/functions/mcp/index.ts`). Not deployed.

## The idea, corrected

The ask was "the site acts as a Claude plugin for Robinhood, but Claude runs
through the trading site." Two ways to read that, and only one of them works.

**What does not work:** Flux holding a Robinhood integration. Robinhood has no
public third-party trading API. The libraries that appear to offer one drive the
private mobile endpoints, which is a terms-of-service problem the moment money
changes hands for the product, and it would put Flux in the business of storing
brokerage credentials — the worst possible liability for a small company.

**What works, and is better:** Flux and Robinhood are *two separate connectors
on the same Claude*, and Claude is the join.

```
                    ┌──────────────────────────┐
                    │         Claude           │
                    │   (the user's session)   │
                    └────┬────────────────┬────┘
                         │                │
              MCP        │                │   Robinhood's own
           (this repo)   │                │   Claude connector
                         ▼                ▼
              ┌────────────────┐   ┌──────────────────┐
              │   Flux MCP     │   │   Robinhood      │
              │  the research  │   │  the brokerage   │
              ├────────────────┤   ├──────────────────┤
              │ desk rulings   │   │ accounts         │
              │ predictions    │   │ positions, quotes│
              │ track records  │   │ review_order     │
              │ paper book     │   │ place_order      │
              │ staged orders  │   │ (human confirms) │
              └────────────────┘   └──────────────────┘
```

Flux is the research authority. Robinhood is the broker. Neither talks to the
other; Claude carries the intent between them.

## Why this is the right shape, not a workaround

Robinhood's connector already enforces the thing Flux promises. Reading its own
tool contracts:

- `place_equity_order` **requires** `review_equity_order` first, the alerts
  presented, and *explicit user confirmation* — a generic "place it" is
  explicitly not a bypass.
- Accounts carry an `agentic_allowed` flag. A non-enrolled account is rejected
  outright; the user has to opt in on Robinhood's side.
- Orders are idempotent by `ref_id`.

So `PRODUCT.md`'s hard constraint — *a human's hand on every real order* — stops
being a promise Flux makes and becomes a property of the architecture. Flux
**cannot** place an order even if its own code were wrong, because it has no
path to a brokerage. That is a much stronger claim to sell than "we promise not
to."

It also means the desk's autonomy and the user's money are separated by
construction: Autopilot goes on trading its simulated book, and nothing about
connecting Robinhood changes that.

## Tools Flux exposes

Research is the product, so these are the tools. The gate is that none of them
execute anything.

| Tool | Returns | Auth |
|---|---|---|
| `desk_status` | Current round, stage, whether the desk is healthy | public |
| `desk_rulings` | Recent executive rulings: verdict, side, entry, stop, target, size, reason | Pro |
| `desk_view_on` | Everything the desk has done on one ticker, across rounds | Pro |
| `analyst_scoreboard` | Per-agent hit rate by horizon — the honesty tool | public |
| `agent_playbook` | An agent's current named method and version | public |
| `paper_book` | The member's simulated positions and orders | member |
| `stage_order` | Turns a Flux ruling into concrete order parameters | Pro |

`stage_order` is the interesting one and the one to be careful about. It returns
*parameters* — symbol, side, type, limit price, quantity derived from a size
percentage the caller supplies — shaped to drop straight into
`review_equity_order`. It returns them with an explicit
`requires_human_confirmation: true` and a note naming the broker's review step.
It does not call a broker. It cannot.

## Auth

The skeleton takes a bearer token (a per-member Flux API key) and resolves it to
a member and a tier. That is enough to develop against.

Production should be OAuth 2.1 with PKCE, which is what Claude's custom
connectors expect, so a member authorises Flux the same way they authorise any
other connector and no key is ever pasted into a config file. Scopes map onto
the tiers already in the product: `desk:read` (public), `research:read` (Pro),
`book:read` (member).

## What this does not do

- It does not place, cancel or modify any order, at any broker, ever.
- It does not read a brokerage balance. If Claude wants the user's positions it
  asks Robinhood's connector, which is the system of record for that.
- It gives no investment advice, and every research payload carries the same
  disclosure the site does.
- It does not make Flux a broker-dealer.

## Open questions for the product

1. **Metering.** MCP calls are cheap for Flux (Postgres reads) but the research
   behind them is not. Pro tier already exists in Stripe; the connector should
   check it and rate-limit.
2. **Where the paper book lives.** `paper_book` implies members' simulated
   positions are server-side. Today the terminal keeps them in the browser.
   Either move them or drop the tool from v1.
3. **Prediction freshness.** `desk_rulings` should refuse to serve a ruling from
   a failed round. `desk_floor().healthy` now reports this — the connector must
   respect it rather than serving a stale call as current.

## Verified

The skeleton was driven with real JSON-RPC against a stubbed data layer
(`initialize`, notifications, `tools/list`, six `tools/call` invocations, an
unknown tool and an unknown method):

```
initialize    -> 2025-06-18 | flux-desk
notification  -> status 202 (no reply, correct)
tools/list    -> desk_status, analyst_scoreboard, agent_playbook,
                 desk_rulings, desk_view_on, stage_order
desk_status   -> round 34 healthy false
  warning: The desk is stalled: traders: HTTP 400 credit balance too low.
           Treat any ruling below as stale.
rulings/anon  -> "This tool needs a Flux Pro connection..."  isError true
rulings/pro   -> 1 ruling
stage_order   -> {"symbol":"AFRM","side":"buy","type":"limit",
                  "limit_price":"73.9","quantity":"10","time_in_force":"gfd"}
  size capped: 4% -> 3% | requires_human_confirmation: true
unknown tool  -> 'No tool called "nope".'  isError true
bad method    -> -32601 Unsupported method: frobnicate
```

The staged size is derived, not echoed: $25,000 at the 3% cap the caller passed
(down from the desk's own 4%) is $750, and $750 / $73.90 is 10 shares.

`desk_status` surfacing `healthy: false` with the provider error is the new
failure reporting from the desk rework doing its job — a connector that served
that round's ruling as current would be lying.

## Before deploying

1. **`flux_api_keys` does not exist yet** (`token`, `user_id`, `tier`,
   `revoked`). The code degrades safely without it — every caller resolves to
   the public tier and the Pro tools refuse — so the function is deployable as
   a read-only public connector today. Pro access needs that table, or the
   OAuth flow instead.
2. **Deploy with `verify_jwt = false`.** Claude presents its own credential, not
   a Supabase JWT; auth is the bearer check inside the function.
3. **Rate limit it.** Postgres reads are cheap; the research behind them is not.
