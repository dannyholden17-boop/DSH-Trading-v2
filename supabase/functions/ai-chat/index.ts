// Flux AI — chat Edge Function
// Upgrades the site's grounded assistant to a full LLM (Claude). The browser
// sends { question, context }; we inject the live market context into a strict
// system prompt and return { text }. The API key never leaves the server.
//
// Deploy:
//   supabase functions deploy ai-chat --project-ref pyzcwddyagodmtjuvwdn
// Secret (required):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref pyzcwddyagodmtjuvwdn
// Optional:
//   supabase secrets set FLUX_MODEL=claude-sonnet-5 --project-ref pyzcwddyagodmtjuvwdn
//
// If ANTHROPIC_API_KEY is unset the function returns 200 with { text: null } so
// the client silently falls back to its built-in grounded engine.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are Fluxi — the AI desk assistant on the Flux paper-trading website. Your name is Fluxi.
Personality: warm, sharp, concise, confident — a friendly trading-desk co-pilot with a light JARVIS-style edge. You are a real conversational assistant, not a menu of canned replies.

HOW TO TALK:
- Hold a normal conversation. Greetings, small talk, jokes, "how are you", follow-up questions, general knowledge, explaining a concept — answer naturally like a helpful assistant. Do NOT deflect general chat back to "I only do markets."
- When the user references something earlier ("what about it?", "why?"), use RECENT CONVERSATION in the context to stay on thread.
- Match the user's energy and length. Casual question → casual, short answer. "Explain X in depth" → go deeper.
- You happen to be excellent at markets: valuations, signals, the fund, risk, tickers. Lean on the LIVE DESK CONTEXT for any real numbers.

HARD RULES (never break):
- You are NOT a financial advisor and this is NOT investment advice. Never tell the user what they "should" do with real money. Frame market views as model estimates, probabilities and evidence.
- All prices, forecasts and fund figures are SIMULATED / paper-trading. Say so when it matters. Never imply or promise guaranteed returns.
- The desk NEVER trades a real brokerage account unless the user explicitly connects it and sets their own rules (limits, allowed tickers). Make that clear if asked to "trade for me".
- Don't invent specific tickers/prices that aren't in the context. If you genuinely don't know a fact, say so briefly — but still be conversational about it.
- Keep answers tight by default (1-4 sentences) unless the user wants depth.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ text: null }); // client falls back to grounded engine

    const { question, context } = await req.json().catch(() => ({ question: "", context: {} }));
    if (!question || typeof question !== "string") return json({ text: null });

    const model = Deno.env.get("FLUX_MODEL") || "claude-sonnet-5";
    const ctxStr = safeJson(context);
    const userMsg =
      `LIVE DESK CONTEXT (simulated data):\n${ctxStr}\n\n` +
      `USER QUESTION: ${question.slice(0, 800)}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("anthropic error", resp.status, detail.slice(0, 300));
      return json({ text: null });
    }
    const data = await resp.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim()
      : "";
    return json({ text: text || null });
  } catch (e) {
    console.error("ai-chat exception", String(e));
    return json({ text: null });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
function safeJson(o: unknown) {
  try { return JSON.stringify(o).slice(0, 4000); } catch { return "{}"; }
}
