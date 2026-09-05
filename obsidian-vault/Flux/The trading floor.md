---
title: The trading floor
aliases:
  - The desk
  - Desk hierarchy
tags:
  - dsh
  - flux
  - desk
type: architecture
status: built
charter: docs/flux-desk.md
---

# The trading floor

[[Flux]]'s research loop, as a chain of command rather than one model with a
prompt. Information moves **upward only** — no branch may hand work sideways or
back down.

```
Analyst Branch → Review & Strategy Branch → Executive Branch → Simulated Execution Desk
                                                            ↘ Post-Trade Monitoring
```

Forty-six agents live in `.claude/agents/flux-*.md`. The full charter, including
the runbook and failure-mode table, is in `docs/flux-desk.md`.

## The branches

| Branch | Count | Job |
|---|---|---|
| Analyst | 25 | Read a name through one lens and file a dated, scoreable prediction |
| Review & Strategy | 10 | Weigh each filing against that analyst's own graded record |
| Executive | 6 | Rule: approve, cut the size, or refuse — with the reason on the record |
| Monitoring | 5 | Track open positions against the thesis they were entered on |

> [!note] Sector coverage is one agent, not eighteen
> `flux-analyst-sector` is parameterised with a playbook per sector. Eighteen
> near-identical agent files would have been eighteen things to keep in sync.

## Rules that make it worth having

- **Analysts run in parallel and must not see each other's output.** Agreement
  is only evidence if it was reached independently.
- **Unanimity is a caution, not a bonus.** `flux-review-ranking` treats it as a
  signal that the analysts shared an assumption.
- **The risk officer's veto cannot be overridden**, and `flux-exec-cro` is
  expected to use it.
- **Rejections are published to the same log as approvals.** A desk that only
  shows what it took is selling a highlight reel.
- **No prediction without a resolve date.** See [[Truthfulness constraints]].

## Where it stops

The Executive's ruling reaches a **simulated** execution desk. There is no path
from any of this to a real brokerage account. See [[Live system state]] for what
is actually running.

> [!warning] Not yet proven end to end
> The prediction system shipped 3 September 2026 at 13:49 UTC. The last round to
> complete successfully was at 11:04 the same day. **No round has ever run with
> both the prediction code and working API credit**, so `desk_predictions` has
> never held a row.
