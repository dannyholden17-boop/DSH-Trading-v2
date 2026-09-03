-- ============================================================
-- The desk gets a new chain of command, a memory, and a scoreboard.
--
-- Hierarchy change: the Director of Research is gone. Analysts report
-- to the TRADERS, who read every filing plus each analyst's scored
-- record, run Kronos (the desk's primary algorithm) and the DSA
-- composite as inputs, apply their own playbook, and decide what
-- reaches the Executive. Selection is now the traders' job.
--
-- Two new ideas:
--   1. Every agent files DATED, FALSIFIABLE predictions, so "the
--      analysts learn" means something checkable rather than a claim.
--   2. Every agent keeps a PLAYBOOK it revises itself. This is the
--      model rewriting its own text strategy in light of its record --
--      NOT weight training. Never describe it as the latter.
--
-- Applied to the live project 2026-09-03 as three migrations:
--   desk_predictions_and_playbooks
--   desk_seed_playbooks_and_resolve_cron
--   desk_agents_new_hierarchy_and_scoreboard
-- This file is the record of that change; see those for the exact DDL.
-- ============================================================

-- desk_predictions: one row per dated, scoreable call
--   tier ('analyst'|'trader'), agent, ticker, horizon
--   ('intraday'|'days'|'weeks'), resolve_at, direction ('up'|'down'|
--   'flat'), price_at_call, target, stop, confidence, method, rationale
--   + resolution: resolved_at, price_at_resolve, realized_pct, correct, score

-- desk_playbooks: agent, tier, method_name, playbook, version, updated_at
--   Seeded with a starting method for all three analysts, both traders
--   and the executive. Agents revise their own; version increments so
--   the history of a strategy stays inspectable.

-- desk_resolve_predictions(limit): scores matured calls against
--   prices.last with a 0.5% dead band, so "flat" is a real answer and
--   noise is not counted as a win. Credit is confidence-weighted:
--   a wrong high-conviction call costs more than a wrong hedge.
--   Scheduled every 10 minutes via cron job 'desk-resolve-predictions'.

-- desk_agent_record (view, public): per agent/tier/horizon --
--   calls, resolved, hits, hit_rate, avg_move_pct, avg_score,
--   avg_confidence, last_call_at. This is the product's own honesty check.

-- desk_agent_brief(agent): what an agent is shown about itself before
--   it files -- its playbook, its record, its last twelve resolved calls.

-- desk_agents(): reworked for the new hierarchy. Trader payloads carry
--   `stance` now, so the executive's "sided with" counts read both
--   stance and the legacy side. Adds scoreboard + playbooks.

-- desk_floor(): adds `healthy`, `rounds_failed_today` and
--   `predictions_total`, so the site can stop presenting a starved
--   round as a filed one.
