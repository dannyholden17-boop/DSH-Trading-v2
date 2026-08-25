// Flux — TradingView bridge (Edge Function)
// Ports the server-friendly core of the TradingView-API fork
// (dannyholden17-boop/TradingView-API, from Mathieu2301/TradingView-API):
//   - symbol resolve   -> symbol-search.tradingview.com/symbol_search/v3
//   - scan / getTA      -> scanner.tradingview.com/global/scan
// Returns TradingView's live price, change and technical-analysis rating so
// the site can show a real second opinion next to Fluxi's Kronos signal.
//
// The realtime WebSocket streaming from the fork (Node `ws`) is intentionally
// NOT ported: it needs a long-lived Node socket, which a static site + a
// request/response Edge Function can't host. The scanner REST gives live-enough
// data with a single call.
//
// Deploy:
//   supabase functions deploy tv --project-ref pyzcwddyagodmtjuvwdn
//
// Endpoints (GET or POST):
//   ?rating=NVDA            -> one name (resolves exchange automatically)
//   ?rating=NASDAQ:NVDA     -> one name (explicit id)
//   ?scan=AAPL,NVDA,MSFT    -> batch
//
// Not affiliated with or endorsed by TradingView. Data is TradingView's.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const TV_ORIGIN = { "origin": "https://www.tradingview.com", "user-agent": "Mozilla/5.0" };

// ticker -> full TradingView id, cached per warm instance
const RESOLVED = new Map<string, string>();

// TradingView Recommend.* is in [-1, 1]. Standard TV bands -> label.
function labelOf(score: number): string {
  if (score == null || isNaN(score)) return "—";
  if (score >= 0.5) return "Strong Buy";
  if (score >= 0.1) return "Buy";
  if (score > -0.1) return "Neutral";
  if (score > -0.5) return "Sell";
  return "Strong Sell";
}

async function resolveId(input: string): Promise<string | null> {
  const raw = (input || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes(":")) return raw;                 // already EXCHANGE:SYMBOL
  if (RESOLVED.has(raw)) return RESOLVED.get(raw)!;
  try {
    const u = new URL("https://symbol-search.tradingview.com/symbol_search/v3");
    u.searchParams.set("text", raw);
    u.searchParams.set("search_type", "stock");
    u.searchParams.set("start", "0");
    const r = await fetch(u.toString(), { headers: TV_ORIGIN });
    const j = await r.json().catch(() => null);
    const syms = j?.symbols || [];
    // prefer a US exchange match on the exact symbol
    const pick = syms.find((s: any) =>
      (s.symbol || "").toUpperCase() === raw &&
      /NASDAQ|NYSE|AMEX|BATS|ARCA/i.test(s.exchange || s.prefix || "")
    ) || syms.find((s: any) => (s.symbol || "").toUpperCase() === raw) || syms[0];
    if (!pick) return null;
    const exch = (pick.prefix || pick.exchange || "").split(" ")[0].toUpperCase();
    const id = exch ? `${exch}:${(pick.symbol || raw).toUpperCase()}` : raw;
    RESOLVED.set(raw, id);
    return id;
  } catch {
    return null;
  }
}

async function fetchScan(ids: string[], columns: string[]) {
  const r = await fetch("https://scanner.tradingview.com/global/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...TV_ORIGIN },
    body: JSON.stringify({ symbols: { tickers: ids }, columns }),
  });
  if (!r.ok) throw new Error("scan " + r.status);
  return await r.json();
}

const COLS = ["close", "change", "Recommend.All", "Recommend.MA", "Recommend.Other"];

function rowToRating(id: string, d: any[]) {
  const g = (name: string) => {
    const i = COLS.indexOf(name);
    return i >= 0 ? d[i] : null;
  };
  const score = +g("Recommend.All");
  return {
    id,
    symbol: id.includes(":") ? id.split(":")[1] : id,
    price: g("close") != null ? +(+g("close")).toFixed(2) : null,
    change: g("change") != null ? +(+g("change")).toFixed(2) : null, // percent
    score: isNaN(score) ? null : +score.toFixed(3),
    label: labelOf(score),
    ma: g("Recommend.MA") != null ? +(+g("Recommend.MA")).toFixed(3) : null,
    osc: g("Recommend.Other") != null ? +(+g("Recommend.Other")).toFixed(3) : null,
    source: "tradingview",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    let rating = url.searchParams.get("rating");
    let scan = url.searchParams.get("scan");
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      rating = rating || body.rating;
      scan = scan || (Array.isArray(body.scan) ? body.scan.join(",") : body.scan);
    }

    // ---- single rating ----
    if (rating) {
      const id = await resolveId(rating);
      if (!id) return json({ error: "unresolved", input: rating });
      const data = await fetchScan([id], COLS);
      const row = data?.data?.[0];
      if (!row || !row.d) return json({ error: "no_data", id });
      return json(rowToRating(row.s || id, row.d));
    }

    // ---- batch scan ----
    if (scan) {
      const wanted = scan.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 40);
      const ids = (await Promise.all(wanted.map(resolveId))).filter(Boolean) as string[];
      if (!ids.length) return json({ results: [] });
      const data = await fetchScan(ids, COLS);
      const byId: Record<string, any> = {};
      (data?.data || []).forEach((row: any) => { if (row?.s) byId[row.s] = row.d; });
      const results = ids.map((id) => (byId[id] ? rowToRating(id, byId[id]) : null)).filter(Boolean);
      return json({ results });
    }

    return json({ error: "pass ?rating=SYMBOL or ?scan=A,B,C" }, 400);
  } catch (e) {
    console.error("tv error", String(e));
    return json({ error: "upstream", detail: String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
