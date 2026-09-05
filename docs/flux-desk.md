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
