---
title: Roadmap
tags:
  - dsh
  - planning
type: roadmap
status: active
doc: docs/roadmap.html
---

# Roadmap

Where DSH v2 is going and in what order. The richer state-of-the-terminal
write-up is at `docs/roadmap.html`; this note is the working plan.

> [!tip] Guiding order
> Prove the *feel* first (the prototype), then make the loop *real* (engines +
> realtime), then wire *action* (live trading).

## Phase 1 — Prove the feel ✅

- [x] Design concepts: [[Aurora]], [[Aurora v2]], [[Conversational Cockpit]]
- [x] [[DSH Sentinel]] prototype — `dsh-living-bot.html`
- [x] This vault: notes, [[Engines.base|registry]], [[Architecture.canvas|canvas]]

## Phase 2 — Make the loop real

- [ ] Stand up the six [[DSH Sentinel#Background engines|engines]] as scheduled jobs
- [ ] Signal queue + [[Realtime Data Flow|findings table]]
- [ ] Core agent loop scoring signals into findings
- [ ] Realtime push into the live feed
- [ ] Replace prototype timers with real data

## Phase 3 — Wire action

- [ ] [[Conversational Cockpit]] as the primary surface
- [ ] Paper trading end-to-end
- [ ] [[Live Trading Blueprint|Live trading]] behind [[Risk]] guards
- [ ] Reports and saved backtests

## Later

- [ ] Personalization (learns your style, sizes to your book)
- [ ] Alerting to phone / email
- [ ] Shareable finding permalinks

## Related

- Back to [[DSH]]
