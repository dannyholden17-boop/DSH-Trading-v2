// Flux — research proxy (OpenBB).
//
// OpenBB is Python, so it runs as a small service you deploy once
// (openbb-bridge/). This function is the only thing that talks to it: it holds
// the bridge URL + token, caches answers, and hands the browser a small,
// stable JSON shape.
//
//   browser ──► functions/v1/research ──► openbb-bridge (FastAPI) ──► OpenBB
//
// Secrets:
//   OPENBB_BRIDGE_URL     e.g. https://openbb.your-host.com
//   OPENBB_BRIDGE_TOKEN   the BRIDGE_TOKEN the service was started with
//
// With no bridge configured it answers {ok:false, configured:false} — a
// deliberate, quiet "not available", so every widget that asks can simply
// stay hidden instead of showing an error.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BRIDGE = (Deno.env.get("OPENBB_BRIDGE_URL") || "").replace(/\/+$/, "");
const TOKEN = Deno.env.get("OPENBB_BRIDGE_TOKEN") || "";

const TTL = 30 * 60 * 1000;        // company data
const MACRO_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { t: number; v: unknown }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}

async function bridge(path: string) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(BRIDGE + path, {
      headers: TOKEN ? { authorization: "Bearer " + TOKEN } : {},
      signal: ctl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!body) throw new Error("bridge returned no JSON (HTTP " + res.status + ")");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function memo(key: string, ttl: number, path: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await bridge(path);
  // only cache good answers — an upstream hiccup shouldn't stick for 30 minutes
  if (v && (v as any).ok) cache.set(key, { t: Date.now(), v });
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const q = url.searchParams;

  if (!BRIDGE) {
    return json({
      ok: false,
      configured: false,
      message: "OpenBB research is not connected — deploy openbb-bridge/ and set OPENBB_BRIDGE_URL.",
    });
  }

  const sym = (q.get("symbol") || q.get("fundamentals") || q.get("estimates") || q.get("filings") || "")
    .toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);

  try {
    if (q.has("health")) return json(await bridge("/health"));

    if (q.has("macro")) {
      return json(await memo("macro", MACRO_TTL, "/macro"));
    }
    if (q.has("movers")) {
      const kind = (q.get("movers") || "gainers").toLowerCase();
      if (!["gainers", "losers", "active"].includes(kind)) return json({ ok: false, error: "bad movers kind" }, 400);
      return json(await memo("mov:" + kind, 10 * 60 * 1000, "/movers?kind=" + kind + "&limit=10"));
    }
    if (q.has("estimates")) {
      if (!sym) return json({ ok: false, error: "missing symbol" }, 400);
      return json(await memo("est:" + sym, TTL, "/estimates?symbol=" + sym));
    }
    if (q.has("filings")) {
      if (!sym) return json({ ok: false, error: "missing symbol" }, 400);
      return json(await memo("fil:" + sym, TTL, "/filings?symbol=" + sym + "&limit=8"));
    }
    // default: company fundamentals
    if (!sym) return json({ ok: false, error: "missing symbol" }, 400);
    return json(await memo("fund:" + sym, TTL, "/fundamentals?symbol=" + sym));
  } catch (e) {
    const msg = String((e as Error).message || e);
    return json({ ok: false, configured: true, error: msg.slice(0, 300) }, 502);
  }
});
