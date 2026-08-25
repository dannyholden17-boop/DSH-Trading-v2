// Flux — live quotes proxy
// Fetches batch quotes server-side (no browser CORS, no API key) and returns
// a compact map the client hydrates into FLUX.LIVE / FLUX.FUND.
//   GET /quotes?symbols=AAPL,MSFT,NVDA,...
//   -> { ok:true, source:"yahoo"|"stooq", ts:<ms>, quotes:{ AAPL:{last,prev_close,name,pe,mc,hi,lo,chg,chgpct}, ... } }
// Primary source: Yahoo Finance v7 batch quote (real-time-ish, keyless, needs a crumb+cookie).
// Fallback: Stooq CSV batch (keyless, delayed) if Yahoo throttles or blocks.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

// cache the Yahoo cookie + crumb across invocations while the instance is warm
let YZ: { cookie: string; crumb: string; at: number } | null = null;

async function yahooAuth(force = false): Promise<{ cookie: string; crumb: string } | null> {
  if (!force && YZ && Date.now() - YZ.at < 20 * 60 * 1000) return YZ;
  try {
    // 1) get a consent cookie
    const c = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
    let cookie = "";
    const sc = c.headers.get("set-cookie");
    if (sc) cookie = sc.split(",").map((p) => p.split(";")[0].trim()).filter(Boolean).join("; ");
    // 2) exchange for a crumb
    const cr = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, cookie, accept: "text/plain" },
    });
    const crumb = (await cr.text()).trim();
    if (!crumb || crumb.length > 40 || /<|>/.test(crumb)) return null;
    YZ = { cookie, crumb, at: Date.now() };
    return YZ;
  } catch (_e) {
    return null;
  }
}

async function fromYahoo(symbols: string[]): Promise<Record<string, any> | null> {
  const auth = await yahooAuth();
  if (!auth) return null;
  const run = async (au: { cookie: string; crumb: string }) => {
    const url =
      "https://query1.finance.yahoo.com/v7/finance/quote?crumb=" +
      encodeURIComponent(au.crumb) +
      "&symbols=" +
      encodeURIComponent(symbols.join(","));
    return await fetch(url, { headers: { "User-Agent": UA, cookie: au.cookie, accept: "application/json" } });
  };
  let r = await run(auth);
  if (r.status === 401 || r.status === 403) {
    const fresh = await yahooAuth(true);
    if (!fresh) return null;
    r = await run(fresh);
  }
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const list = j?.quoteResponse?.result;
  if (!Array.isArray(list) || !list.length) return null;
  const out: Record<string, any> = {};
  for (const q of list) {
    const t = (q.symbol || "").toUpperCase();
    if (!t) continue;
    const last = num(q.regularMarketPrice);
    if (last == null) continue;
    out[t] = clean({
      last,
      prev_close: num(q.regularMarketPreviousClose) ?? last,
      name: q.shortName || q.longName || t,
      pe: num(q.trailingPE),
      mc: q.marketCap ? +(q.marketCap / 1e9).toFixed(1) : null, // $B
      hi: num(q.fiftyTwoWeekHigh),
      lo: num(q.fiftyTwoWeekLow),
      chg: num(q.regularMarketChange),
      chgpct: num(q.regularMarketChangePercent),
    });
  }
  return Object.keys(out).length ? out : null;
}

async function fromStooq(symbols: string[]): Promise<Record<string, any> | null> {
  try {
    const s = symbols.map((x) => x.toLowerCase().replace(/[^a-z0-9.\-]/g, "") + ".us").join(",");
    const url = "https://stooq.com/q/l/?s=" + s + "&f=sd2t2ohlcvn&h&e=csv";
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const text = await r.text();
    const rows = text.trim().split(/\r?\n/);
    if (rows.length < 2) return null;
    const head = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const iSym = head.indexOf("symbol"), iClose = head.indexOf("close"),
      iOpen = head.indexOf("open"), iName = head.indexOf("name");
    const out: Record<string, any> = {};
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].split(",");
      const sym = (c[iSym] || "").toUpperCase().replace(/\.US$/, "");
      const last = num(c[iClose]);
      if (!sym || last == null) continue;
      out[sym] = clean({ last, prev_close: num(c[iOpen]) ?? last, name: iName >= 0 ? c[iName] : sym });
    }
    return Object.keys(out).length ? out : null;
  } catch (_e) {
    return null;
  }
}

function num(v: any): number | null {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? +(+n).toFixed(4) : null;
}
function clean(o: Record<string, any>) {
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}
async function batched<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<Record<string, any> | null>) {
  const out: Record<string, any> = {};
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  const results = await Promise.all(chunks.map((c) => fn(c).catch(() => null)));
  for (const r of results) if (r) Object.assign(out, r);
  return out;
}

/* ============================================================
   LICENSED FEED ADAPTER (optional)
   Set these Supabase secrets to route the WHOLE site through a
   licensed market-data provider instead of Yahoo/Stooq:
     FLUX_QUOTES_PROVIDER = polygon | finnhub | alpaca | twelvedata
     FLUX_QUOTES_KEY      = <api key>            (all providers)
     FLUX_QUOTES_SECRET   = <api secret>         (alpaca only)
   If unset or the call fails, we fall back to Yahoo, then Stooq —
   so the site keeps working with zero config.
   ============================================================ */
const PROVIDER = (Deno.env.get("FLUX_QUOTES_PROVIDER") || "").toLowerCase();
const LKEY = Deno.env.get("FLUX_QUOTES_KEY") || "";
const LSECRET = Deno.env.get("FLUX_QUOTES_SECRET") || "";

async function fromPolygon(symbols: string[]): Promise<Record<string, any> | null> {
  const url = "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=" +
    encodeURIComponent(symbols.join(",")) + "&apiKey=" + encodeURIComponent(LKEY);
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const list = j?.tickers;
  if (!Array.isArray(list)) return null;
  const out: Record<string, any> = {};
  for (const t of list) {
    const sym = (t.ticker || "").toUpperCase();
    const last = num(t?.day?.c) ?? num(t?.min?.c) ?? num(t?.prevDay?.c);
    if (!sym || last == null) continue;
    out[sym] = clean({
      last, prev_close: num(t?.prevDay?.c) ?? last, name: sym,
      chg: num(t?.todaysChange), chgpct: num(t?.todaysChangePerc),
    });
  }
  return Object.keys(out).length ? out : null;
}

async function fromFinnhub(symbols: string[]): Promise<Record<string, any> | null> {
  const out: Record<string, any> = {};
  const CC = 8; // concurrency (finnhub quotes are per-symbol)
  for (let i = 0; i < symbols.length; i += CC) {
    const chunk = symbols.slice(i, i + CC);
    await Promise.all(chunk.map(async (sym) => {
      try {
        const r = await fetch("https://finnhub.io/api/v1/quote?symbol=" +
          encodeURIComponent(sym) + "&token=" + encodeURIComponent(LKEY));
        if (!r.ok) return;
        const q = await r.json().catch(() => null);
        const last = num(q?.c);
        if (last == null || last === 0) return;
        out[sym] = clean({ last, prev_close: num(q?.pc) ?? last, name: sym, chg: num(q?.d), chgpct: num(q?.dp) });
      } catch (_e) { /* skip */ }
    }));
  }
  return Object.keys(out).length ? out : null;
}

async function fromAlpaca(symbols: string[]): Promise<Record<string, any> | null> {
  const r = await fetch("https://data.alpaca.markets/v2/stocks/snapshots?symbols=" +
    encodeURIComponent(symbols.join(",")), {
    headers: { "APCA-API-KEY-ID": LKEY, "APCA-API-SECRET-KEY": LSECRET },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== "object") return null;
  const out: Record<string, any> = {};
  for (const sym of Object.keys(j)) {
    const s = j[sym];
    const last = num(s?.latestTrade?.p) ?? num(s?.dailyBar?.c);
    if (last == null) continue;
    out[sym.toUpperCase()] = clean({ last, prev_close: num(s?.prevDailyBar?.c) ?? last, name: sym.toUpperCase() });
  }
  return Object.keys(out).length ? out : null;
}

async function fromTwelveData(symbols: string[]): Promise<Record<string, any> | null> {
  const r = await fetch("https://api.twelvedata.com/quote?symbol=" +
    encodeURIComponent(symbols.join(",")) + "&apikey=" + encodeURIComponent(LKEY));
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== "object") return null;
  const rows = j.symbol ? { [j.symbol]: j } : j; // single vs batch shape
  const out: Record<string, any> = {};
  for (const sym of Object.keys(rows)) {
    const q = rows[sym];
    const last = num(q?.close);
    if (!q || q.status === "error" || last == null) continue;
    out[sym.toUpperCase()] = clean({
      last, prev_close: num(q?.previous_close) ?? last,
      name: q?.name || sym.toUpperCase(), chgpct: num(q?.percent_change),
    });
  }
  return Object.keys(out).length ? out : null;
}

async function fromLicensed(symbols: string[]): Promise<Record<string, any> | null> {
  if (!PROVIDER) return null;
  const hasKey = PROVIDER === "alpaca" ? (LKEY && LSECRET) : !!LKEY;
  if (!hasKey) return null;
  try {
    if (PROVIDER === "polygon") return await fromPolygon(symbols);
    if (PROVIDER === "finnhub") return await fromFinnhub(symbols);
    if (PROVIDER === "alpaca") return await fromAlpaca(symbols);
    if (PROVIDER === "twelvedata" || PROVIDER === "twelve") return await fromTwelveData(symbols);
  } catch (_e) { return null; }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    let raw = url.searchParams.get("symbols") || "";
    if (!raw && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      raw = (body.symbols || "");
      if (Array.isArray(raw)) raw = raw.join(",");
    }
    const symbols = [...new Set(
      raw.toUpperCase().split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)),
    )].slice(0, 260);
    if (!symbols.length) {
      return new Response(JSON.stringify({ ok: false, error: "no symbols" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 1) Licensed provider first when configured (env). One flag flips the site.
    let quotes: Record<string, any> = {};
    let source = "";
    if (PROVIDER) {
      const lic = await fromLicensed(symbols).catch(() => null);
      if (lic && Object.keys(lic).length >= Math.min(symbols.length, 3)) {
        quotes = lic; source = PROVIDER;
      }
    }
    // 2) Yahoo (keyless) — the default free feed / fallback.
    if (!Object.keys(quotes).length) {
      quotes = await batched(symbols, 50, fromYahoo);
      source = "yahoo";
    }
    // 3) Stooq — last-resort keyless fallback.
    if (Object.keys(quotes).length < Math.min(symbols.length, 3)) {
      const sq = await batched(symbols, 25, fromStooq);
      if (Object.keys(sq).length > Object.keys(quotes).length) { quotes = sq; source = "stooq"; }
    }

    return new Response(JSON.stringify({
      ok: true, source, licensed: !!PROVIDER && source === PROVIDER,
      provider: PROVIDER || null, ts: Date.now(), count: Object.keys(quotes).length, quotes,
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
