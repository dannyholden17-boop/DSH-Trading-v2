---
title: Live system state
aliases:
  - What is running
tags:
  - dsh
  - flux
  - ops
type: status
status: degraded
updated: 2026-09-05
---

# Live system state

A snapshot, not a design. Re-check before trusting it.

> [!failure] Blocked right now
> The Anthropic API ran out of credit partway through **3 September 2026**. The
> director stage has returned HTTP 400 on every round since. The desk still
> ticks once a minute, scans the tape, and files nothing.
>
> **75 consecutive rounds have produced nothing.** Everything downstream —
> filings, rulings, predictions, the graded record — is waiting on a top-up and
> resumes on its own once there is one.

## The record, as of 5 September 2026

| | |
|---|---|
| Rounds that filed anything, ever | 32 |
| Rounds attempted | 107 |
| Last actual filing | 3 Sept, 11:05 UTC |
| Filings on record | 1,525 |
| Rulings | 168 |
| **Predictions** | **0** — see [[The trading floor]] |

## Deployed

- **Site** — Netlify from `main`, no build step, `publish = "site"`. Pushing to
  `main` deploys in under ten seconds.
- **Supabase** `pyzcwddyagodmtjuvwdn` — 11 edge functions live including `desk`,
  `quotes`, `broker`, `research`, `ai-chat`.
- **Cron** — 11 jobs, including `flux_desk_tick` every minute and
  `desk-resolve-predictions` every ten minutes. The grading loop is armed and
  waiting for something to grade.

## Not deployed

`mcp`, `create-checkout`, `stripe-webhook`.

## Known open items

- [ ] Top up Anthropic credit — unblocks the entire research loop
- [ ] Decide on a licensed market-data provider — see [[Market data]]
- [ ] Publish the Higgsfield build (currently 401, unlisted)
- [ ] Resend + DNS for outbound email
