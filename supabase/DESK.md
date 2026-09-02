# The Desk — the persistent research loop

A research desk with a real chain of command, running continuously:

```
   3 analysts  ──►  Director of Research  ──►  two traders  ──►  Executive
 fundamentals        resolves the             Kronos + DSA       green light
 catalyst            disagreements,           price the trade    approve /
 tape                one package per name     entry/stop/target  reduce / reject
```

Nothing on the site is green-lit unless the Executive says so, and every note
along the way is on the record.

## Who does what

| Agent | What it sees | What it produces |
|---|---|---|
| **Fundamentals analyst** | live P/E, market cap, 52-week range, drawdown, plus OpenBB fundamentals when the research bridge is deployed | view · conviction · note · evidence · risk |
| **Catalyst analyst** | matched company headlines and the government/policy wire from the `news` function | same shape; told to mark a name neutral rather than invent a story |
| **Tape analyst** | price, momentum, range position, distance from the high, TradingView rating from the `tv` function | same shape |
| **Director of Research** | all three filings, side by side | stance · score −100…100 · summary · key points · where the analysts disagreed · what would change the call. Drops names not worth the traders' time; a strong negative read is passed on as `avoid`, not dropped |
| **Kronos** (trader) | the round's price features | forecasts the next 5 candles → predicted return → `>+2% BUY, <−2% SELL` → entry/stop/target. Uses a **real** forecast from the `forecasts` table when the Python bridge has published one, otherwise the same seeded Monte-Carlo the browser engine uses |
| **DSA** (trader) | the same features plus the director's score | a transparent composite over momentum, range, drawdown, value and stretch → side, size, entry/stop/target. Every component is stored, so the score can always be taken apart |
| **Executive** | the director's package and both traders' proposals, plus what the desk has already green-lit | `approved` / `reduced` / `rejected` per name, with final entry, stop, target, size and the reason — including which trader it sided with |

## How "persistent" works

`pg_cron` calls the `desk` Edge Function **every minute**. Each call advances the
open round by exactly one stage, so no invocation is long-running and a crash
mid-stage is recoverable (a claim older than 5 minutes is retried).

Between rounds the engine paces itself instead of running flat out:

| When | New round every |
|---|---|
| US market hours (13:30–20:00 UTC, weekdays) | 15 min (`FLUX_DESK_INTERVAL_RTH`) |
| Everything else | 60 min (`FLUX_DESK_INTERVAL_OFF`) |

A round covers 6 rotating names plus the day's 2 biggest movers. The rotation
cursor walks the whole universe, so over a day the desk works through every name
rather than circling the same handful.

## Cost

Five model calls per round: three analysts and the director on **Haiku**, the
executive on **Opus**. At the default pacing that's roughly 40 rounds and 40 Opus
calls on a weekday. Every model is overridable:

```bash
supabase secrets set FLUX_DESK_ANALYST_MODEL=claude-haiku-4-5-20251001
supabase secrets set FLUX_DESK_DIRECTOR_MODEL=claude-opus-5     # sharper synthesis, more cost
supabase secrets set FLUX_DESK_EXEC_MODEL=claude-opus-5
supabase secrets set FLUX_DESK_INTERVAL_RTH=1800                # slow it down
supabase secrets set FLUX_DESK_NAMES=4                          # smaller rounds
```

The traders cost nothing — they are code, not prompts.

## Tables

* `desk_rounds` — one row per cycle: `seq`, `stage`, `status`, `tickers`, `meta`
  (the round's price features, breadth, the director's desk view, the executive's note).
* `desk_notes` — every filing: `stage`, `agent`, `ticker`, `payload` jsonb.
* `desk_decisions` — the executive's rulings, with the Kronos and DSA payloads
  that produced them attached.

Row-level security:

| | logged out | signed in |
|---|---|---|
| rounds | ✅ full | ✅ full |
| decisions | one teaser per round | ✅ all |
| filings (`desk_notes`) | ❌ | ✅ all |

`desk_status()` is a security-definer function anyone can call for the live
header — stage, round number, counts.

Rounds older than 7 days are pruned nightly (`flux_desk_prune`); notes and
decisions cascade.

## Operating it

```bash
# what is it doing right now
curl "$URL/rest/v1/rpc/desk_status" -X POST -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'

# advance one stage by hand
curl "$URL/functions/v1/desk"

# force a full round start to finish (testing)
curl "$URL/functions/v1/desk?run=1"

# pause the loop
select cron.unschedule('flux_desk_tick');
```

Schema and cron live in `supabase/desk.sql`; the engine is
`supabase/functions/desk/index.ts`; the page is `site/desk.html` with
`site/assets/flux-desk.js`.

## Honest limits

* The analysts and the executive are language models reading live numbers and
  real headlines. They are told never to invent a figure, and every note is
  stored so you can check them — but they can still be wrong.
* Kronos runs the browser approximation until the Python bridge
  (`kronos-bridge/`) publishes real forecasts; the stored payload says which one
  produced each call (`"real": true|false`).
* Nothing here trades a real account. The desk writes research; the paper book
  and Autopilot are separate, and a connected brokerage is never touched.
