# Flux AI — turn on the full LLM brain (optional, ~5 min)

The `/ai` page (JARVIS) **already works with no setup** — it answers questions about
prices, valuations, Kronos signals, the fund, risk and briefs using the site's real
data, and it has voice control. That's the built-in *grounded* engine.

To upgrade it to **free-form conversation** (ask it anything, in plain English), deploy
the `ai-chat` Edge Function and give it an API key. When it's live, the site
automatically routes open-ended questions to Claude; if it's not, nothing breaks — the
grounded engine keeps answering.

Project ref: `pyzcwddyagodmtjuvwdn`

## 1. Get an Anthropic API key
https://console.anthropic.com → **API Keys** → create key (`sk-ant-...`). Add a little
credit to the account.

## 2. Give Supabase the key
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx --project-ref pyzcwddyagodmtjuvwdn
# optional — pick the model (defaults to claude-sonnet-5):
supabase secrets set FLUX_MODEL=claude-sonnet-5 --project-ref pyzcwddyagodmtjuvwdn
```

## 3. Deploy the function
```bash
supabase functions deploy ai-chat --project-ref pyzcwddyagodmtjuvwdn
```
(Or paste `supabase/functions/ai-chat/index.ts` into the dashboard → Edge Functions.)

## Done
Open **/ai** and ask something open-ended ("explain what a call sweep means", "compare
NVDA and AMD for me"). It now answers with Claude, grounded in the live desk context,
and still obeys the honesty rules (simulated data, model estimates, never advice, never
trades a real account without your rules).

**Cost:** you pay Anthropic per message (fractions of a cent for short replies). No key =
no cost = grounded engine only.

---

### Making it truly "always on" (server-side briefs, next step)
Right now the AI recomputes briefs and under/overvalued models live in the browser while
the page is open, and the **Autopilot fund** already trades 24/7 via `pg_cron`. To have
the AI write and store briefs on a schedule independent of anyone visiting, add a cron
that calls a `generate-brief` function every N minutes and writes to a `briefs` table —
say the word and I'll wire it.
