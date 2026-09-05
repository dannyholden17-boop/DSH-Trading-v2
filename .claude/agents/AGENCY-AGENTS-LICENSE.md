# agency-agents — third-party attribution

The 102 `agency-*.md` agents in this directory are derived from
[agency-agents](https://github.com/msitarzewski/agency-agents) ("The Agency"),
via the fork at `dannyholden17-boop/agency-agents`.

```
MIT License
Copyright (c) 2025 AgentLand Contributors
```

The full licence text is in the upstream repository. MIT permits this use with
attribution, which is what this file is for.

## What was changed

Each file was rewritten on import rather than copied verbatim:

- **`name` was slugified and namespaced.** Upstream uses a display name
  ("Bookkeeper & Controller"); Claude Code needs a slug. Each is now
  `agency-<original-filename>`, which keeps them sorted apart from the 46
  purpose-built `flux-*` desk agents.
- **`model: inherit` added**, matching the rest of this roster.
- **`description` and `vibe` quoted**, since several contained a colon and
  would otherwise have broken the YAML.
- **Flux's house rules appended to every file.** Subagents share no context, so
  the compliance constraints this product runs under have to be restated in
  each one. See `obsidian-vault/Flux/Truthfulness constraints.md`.

## What was deliberately not imported

Upstream ships 279 agents across 22 categories. Imported: design, engineering,
product, security, strategy, testing and project-management — the build-side
roles.

**The five `finance/` agents were left out on purpose.** This project already
has 46 finance agents built for it, each carrying the desk's routing rules and
disclosure obligations. A generic "Investment Researcher" persona dropped into
a product that may not give investment advice, may not claim a track record and
may not invent a figure is a liability rather than a capability, and it would
compete with agents that were written to those constraints. The same reasoning
excluded marketing, sales and paid-media: they write claims for a living, and
this product is under a claims restriction.

To pull any of those in later, take the upstream file and apply the same two
steps: slugify the name, and append the house rules.
