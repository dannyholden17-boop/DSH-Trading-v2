// Flux — AI news read (Edge Function)
// Pulls the top finance headlines (from the `news` function) and has the light
// model (Haiku) write Fluxi's 1-2 sentence read of what's driving markets.
// Heavily cached (10 min) so repeated widget hits are near-free.
//   GET /news-brief -> { text: "...", ts }  (or { text: null } if no API key)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("FLUX_MODEL_LIGHT") || "claude-haiku-4-5-20251001";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

let CACHE: { at: number; text: string } | null = null;
const TTL = 10 * 60 * 1000;

const SYS =
  "You are Fluxi, a sharp trading-desk assistant. Given today's finance headlines, write a 1-2 sentence read of what's driving US markets right now. Be specific and neutral, plain language, no preamble, no bullet points, no investment advice. Under 45 words.";

async function topHeadlines(): Promise<string[]> {
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/news?limit=12");
    const j = await r.json().catch(() => null);
    return ((j && j.items) || []).map((it: any) => `- ${it.title} (${it.source})`);
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (CACHE && Date.now() - CACHE.at < TTL) return json({ text: CACHE.text, cached: true });
    if (!KEY) return json({ text: null });
    const lines = await topHeadlines();
    if (!lines.length) return json({ text: null });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 160,
        system: SYS,
        messages: [{ role: "user", content: "Today's headlines:\n" + lines.join("\n") }],
      }),
    });
    if (!resp.ok) return json({ text: null });
    const data = await resp.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").trim()
      : "";
    if (text) CACHE = { at: Date.now(), text };
    return json({ text: text || null });
  } catch (e) {
    return json({ text: null, error: String(e) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
