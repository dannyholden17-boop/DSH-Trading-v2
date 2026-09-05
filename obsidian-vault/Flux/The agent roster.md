---
title: The agent roster
aliases:
  - Agents
  - Subagents
tags:
  - dsh
  - flux
  - agents
type: reference
status: installed
---

# The agent roster

152 subagents live in `.claude/agents/`. They come from three places and are
namespaced so you can tell them apart at a glance.

| Prefix | Count | Where from |
|---|---:|---|
| `flux-*` | 46 | Written for this desk — see [[The trading floor]] |
| `agency-*` | 102 | Imported from [The Agency](https://github.com/msitarzewski/agency-agents), MIT |
| `impeccable-*` | 4 | Ship with the design skill |

## The imported roster

Build-side roles only: design, engineering, product, security, strategy,
testing and project-management. Slugified to `agency-<original-filename>`,
given `model: inherit`, and **every one has Flux's house rules appended**.

> [!important] Why the rules are pasted into all 102
> Subagents share no context. An agent invoked on this codebase has no idea it
> is working on a product that may not claim a track record, may not invent a
> figure, and may not give advice — unless its own file says so. That is the
> same reason each `flux-*` agent restates them. See
> [[Truthfulness constraints]].

## What was left out, and why

Upstream ships 279 agents across 22 categories. These were deliberately not
imported:

- **`finance/` (5)** — the desk already has 46 finance agents written to its
  routing rules and disclosure obligations. A generic "Investment Researcher"
  persona would compete with them while carrying none of their constraints.
- **`marketing/` (36), `sales/` (9), `paid-media/` (7)** — these write claims
  for a living, and this product is under a claims restriction. Importing them
  would be handing a persuasion brief to a surface that failed a compliance
  audit for exactly that.
- **`game-development/`, `gis/`, `healthcare/`, `spatial-computing/`,
  `academic/`** — not relevant to this product.

Attribution and the full import method are in
`.claude/agents/AGENCY-AGENTS-LICENSE.md`.

> [!tip] Adding one later
> Take the upstream file, slugify its `name` (upstream uses display names like
> "Bookkeeper & Controller", which is not a valid slug), quote `description`
> and `vibe` if they contain a colon, and append the house-rules block from any
> existing `agency-*.md`. Two of those steps are not optional: without the
> slug the agent will not load, and without the rules it does not know what
> product it is working on.
