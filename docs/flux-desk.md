# The Flux desk — charter

The trading floor is three branches and a monitoring function. Information moves
**upward only**:

```
Analyst Branch → Review & Strategy Branch → Executive Branch → Simulated Execution Desk
                                                            ↘ Post-Trade Monitoring
```

## Hard routing rules

1. No analyst may bypass the Review & Strategy Branch.
2. No individual analyst may execute a simulated trade.
3. No simulated trade enters the Flux Fund without an Executive Branch decision
   **and** a passing deterministic risk gate.
4. Every proposal receives a Red Team review before it reaches the Executive Branch.
5. The Risk Review Agent and the Chief Risk Officer each hold an independent veto.
6. Agreement is not evidence. The Executive Branch may never approve on consensus alone.

## Scope of authority

Executive decisions bind **only the Flux simulated paper-money account**. For a
member's own brokerage, Flux presents research, risk and scenarios; the member
decides and the member acts. Nothing here is a real-money trading authority.

## House rules — binding on every agent

These are restated inside every agent file because subagents do not share context.

- **Not advice.** Output is research. Never personalised, never a recommendation.
- **No MNPI.** Public sources only. Never claim or imply access to confidential
  investment-banking information or material nonpublic information.
- **No invented sources.** Every material claim carries a source, a publication
  date and a data timestamp. Never cite something that does not support the claim.
- **Label the epistemics.** Separate verified fact, calculation, assumption,
  interpretation, prediction and unknown. Never blur them.
- **Simulated is stated.** Any figure from the paper account or a backtest is
  labelled hypothetical, at the surface, not in a footnote.
- **No certainty language.** "Potentially undervalued on the stated assumptions",
  never "is undervalued". Never "will beat earnings".
- **Report the absence.** Missing, stale or unavailable data is an output, not a
  gap to fill with a plausible number.

## Roster

| Branch | Agents |
|---|---|
| Analyst | `flux-analyst-*` — 24 specialists plus `flux-analyst-red-team` |
| Review & Strategy | `flux-review-*` — 10 seniors |
| Executive | `flux-exec-*` — 6 officers |
| Post-trade | `flux-monitor-*` — 5 |

Sector coverage is one parameterised agent (`flux-analyst-sector`) carrying a
playbook per sector, rather than eighteen near-identical files. Invoke it with
the sector named in the prompt.

---

## Running a round

The roster is 46 seats, not 46 steps. A round invokes the seats the name
actually needs, and the branch order is the part that is not optional.

### 1. Generate the queue (no LLM judgement yet)

```
flux-analyst-quant-screen   → a research queue, with the universe and as-of
                              dates disclosed. Not a ranking, not a recommendation.
```

Feed the survivors to specialists. A screen that returns nothing is a result.

### 2. Analyst branch — parallel, independent

Pick the seats the thesis requires. Three to six is a round; twenty-five is a
committee meeting. Typical long candidate:

```
flux-analyst-value  ·  flux-analyst-quality  ·  flux-analyst-sector
flux-analyst-sec-filings  ·  flux-analyst-catalyst
```

Short candidate swaps in `flux-analyst-short` and **always**
`flux-analyst-forensic`. Anything with a date attached pulls in
`flux-analyst-earnings-preview` or `flux-analyst-merger-arb`.

**Run them in parallel and do not let them see each other's output.** Their
independence is the only thing that makes their agreement worth anything later.
Every one files the standard research package.

Then, unconditionally:

```
flux-analyst-portfolio-exposure  → what this does to the book we already have
flux-analyst-red-team            → may not decline to object
```

### 3. Review & strategy branch — sequential, and it can send work back

```
flux-review-data-verification  ← FIRST. Hard-stops on an unverifiable figure,
                                 so running it after the expensive reviews
                                 wastes them.
flux-review-director           ← completeness, support, independence
flux-review-fundamental        ← re-derives the valuation
flux-review-trading-strategy   ← reviews the trade, not the company
flux-review-macro-strategy     ← the undeclared macro bet
flux-review-risk               ← VETO POINT
flux-review-red-team-chair     ← objection register; open items travel up
flux-review-compliance         ← BLOCK POINT
flux-review-portfolio-construction
flux-review-ranking            ← Priority A/B/C/Rejected
```

Any of these may return the package. A return is a normal outcome, not a
failure of the round.

### 4. Executive branch — only Priority A arrives here

```
flux-exec-head-research      ← defends or fails to defend the process
flux-exec-cro                ← ABSOLUTE VETO, unoverridable
flux-exec-head-trading       ← can this be simulated honestly
flux-exec-cio                ← the capital call
flux-exec-portfolio-manager  ← size and funding source
flux-exec-committee-chair    ← blocks the vote if any review above is missing
```

### 5. After entry

```
flux-monitor-position       ← every session
flux-monitor-thesis-drift   ← weekly, and after any material filing
flux-monitor-invalidation   ← every session; keeps the modified-stop register
flux-monitor-attribution    ← at close, and monthly on the book
flux-monitor-post-trade     ← at close, always, win or lose
```

## What a round is allowed to produce

A round may legitimately end in any of these, and four of the five are not a trade:

- an approved simulated position,
- an approved position at a smaller size,
- a watchlist entry pending a named confirmation,
- a return to the analysts with specific questions,
- a rejection, with the gate that stopped it.

**The rejections are published.** A desk that shows only what it took has no
record, it has a highlight reel.

## Failure modes this structure exists to prevent

| Failure | The seat that catches it |
|---|---|
| A number nobody checked | `flux-review-data-verification` |
| A thesis with no exit | `flux-review-trading-strategy` |
| A position sized past the limit | `flux-review-risk`, then `flux-exec-cro` |
| Everyone agreeing because they read the same article | `flux-review-red-team-chair` |
| A claim the site cannot legally make | `flux-review-compliance` |
| A stop widened after the loss | `flux-monitor-invalidation` |
| Being right for the wrong reason | `flux-monitor-attribution` |
| The reason for holding quietly changing | `flux-monitor-thesis-drift` |

## Cost discipline

Every seat is an LLM call. A full 46-seat round on one name is expensive and
almost always wasteful. Invoke the branch, not the roster: the analysts the
thesis needs, the full review chain (it is short and mostly cheap), and the
executive only for Priority A. The monitoring seats run on a schedule, not per
idea.
