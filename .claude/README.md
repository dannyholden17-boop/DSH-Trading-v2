# Impeccable — design guidance for this repo

[Impeccable](https://impeccable.style) (Apache-2.0, by Paul Bakaus) is installed
here at project scope: a design skill, four sub-agents, and a deterministic
anti-pattern detector wired into Claude Code's hooks.

Source: <https://github.com/pbakaus/impeccable> · v4.1.3

## What's here

```
.claude/skills/impeccable/   the skill: SKILL.md, 36 reference docs, 46 scripts
.claude/agents/              finish-reviewer, documenter, manual-edit-applier, asset-producer
.claude/settings.json        the hooks that run the detector
```

## How to use it

Reload the harness after pulling, then run the skill by name:

```
/impeccable init          # one-time: writes PRODUCT.md with durable product truth
/impeccable audit         # a11y, performance, responsive checks
/impeccable critique      # UX review: hierarchy, clarity, emotional resonance
/impeccable polish        # final pass before shipping
```

23 commands in total — `shape`, `craft`, `bolder`, `quieter`, `distill`,
`typeset`, `layout`, `colorize`, `animate`, `delight`, `harden`, `onboard`,
`clarify`, `adapt`, `optimize`, `extract`, `document`, `live`, and more. Every
one takes a target, e.g. `/impeccable polish terminal`.

## The hooks

`settings.json` runs the detector after every Edit/Write on a UI file (fast
tier, 5s) and a deeper pass on Stop (30s). Both no-op quietly if the skill
folder is missing or Node is older than 22.

## Full-strength detection

The detector parses HTML/CSS properly when four modules are resolvable, and
falls back to regex matching (an undercount) without them. `node_modules/` is
gitignored, so after a fresh clone:

```bash
npm install --no-save htmlparser2 css-select css-tree domutils
```

Deliberately not added as a root `package.json`: `netlify.toml` publishes
`site/` with no build command, and an unnecessary dependency install on every
deploy is a failure mode this site doesn't need.

## Updating

```bash
git clone --depth 1 https://github.com/pbakaus/impeccable /tmp/impeccable
cp -r /tmp/impeccable/.claude/skills/impeccable .claude/skills/
cp /tmp/impeccable/.claude/agents/*.md .claude/agents/
cp /tmp/impeccable/.claude/settings.json .claude/settings.json
```

(`npx impeccable install` is the upstream path and does the same thing, but it
downloads its bundle from a host this environment's egress proxy blocks.)
