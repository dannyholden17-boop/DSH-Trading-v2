---
title: Live Trading Blueprint
tags:
  - dsh
  - architecture
type: architecture
status: design
doc: docs/live-trading-blueprint.html
---

# Live Trading Blueprint

How a [[DSH Sentinel#Findings|finding]] becomes an actual order — and the guards
that sit between an idea and real money. The full write-up lives at
`docs/live-trading-blueprint.html`; this note is the map.

> [!warning] Safety first
> Every path from finding → order passes through [[Risk]]. No order is placed
> that would violate a stop, a size cap, or an exposure limit.

## From idea to fill

1. An engine emits a signal → the [[DSH Sentinel]] core scores it.
2. [[Backtest]] validates the setup; only proven edges become **trade ideas**.
3. You act on a finding in the [[Conversational Cockpit]] (Paper trade / trade).
4. The order layer checks [[Risk]] limits, then routes.
5. Fills, positions, and P&L flow back into [[Risk]] — closing the loop.

## Modes

| Mode | What happens |
|------|--------------|
| **Paper** | Simulated fills; ideas tracked as if live, zero capital at risk |
| **Live** | Real routing through the broker integration, gated by [[Risk]] |

## Open decisions

- [ ] Broker/execution integration surface
- [ ] Order types supported at launch (market / limit / bracket)
- [ ] Hard vs soft risk limits (block vs warn)
- [ ] Audit trail + kill switch

## Related

- [[Realtime Data Flow]] · [[DSH Sentinel]] · back to [[DSH]]
