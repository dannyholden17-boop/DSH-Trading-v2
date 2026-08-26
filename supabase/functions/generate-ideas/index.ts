// Flux — daily trade-ideas generator.
// Selects momentum + beaten-down rebound candidates from LIVE quotes (not just
// blue-chips), then has Opus write a brief (thesis / catalyst / risk) for each,
// and writes them to public.trade_ideas for today. Runs once/day via pg_cron.
//
// Auth: pass header x-cron-secret: <CRON_SECRET>. Deployed with verify_jwt=false.
// Secrets used: ANTHROPIC_API_KEY, CRON_SECRET, (auto) SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Broad scan universe (~110 names) across every sector, growth AND value, so ideas
// can come from momentum, undervalued, overvalued and rebound buckets — not a handful.
const CANDIDATES = [
  // AI / semis
  "NVDA","AMD","AVGO","MU","ARM","SMCI","MRVL","QCOM","TXN","ADI","LRCX","AMAT","KLAC","ASML","TSM","ON","NXPI","MCHP","INTC",
  // software / internet
  "PLTR","SNOW","NET","CRWD","DDOG","APP","ANET","PANW","NOW","MDB","ZS","CRM","ORCL","ADBE","INTU","SNPS","CDNS","WDAY","TEAM","HUBS","SHOP","MELI",
  "META","GOOGL","AMZN","MSFT","AAPL","NFLX","UBER","ABNB","DASH","RBLX","SPOT","PINS","SNAP","ROKU","DKNG",
  // power / energy / clean
  "GEV","VST","CEG","OKLO","SMR","NEE","XOM","CVX","COP","SLB","FSLR","ENPH","PLUG",
  // fintech / crypto
  "COIN","MARA","RIOT","MSTR","HOOD","SOFI","AFRM","UPST","XYZ","PYPL","V","MA","AXP","NU",
  // banks
  "JPM","BAC","WFC","GS","MS","C","SCHW",
  // healthcare / pharma
  "LLY","UNH","JNJ","PFE","MRK","ABBV","TMO","ABT","AMGN","GILD",
  // consumer / retail / autos / industrials
  "TSLA","RIVN","F","GM","CVNA","NKE","SBUX","MCD","WMT","COST","HD","LOW","TGT","DIS","BA","CAT","GE","DE","UPS","LMT",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const secret = Deno.env.get("CRON_SECRET");
    const given = req.headers.get("x-cron-secret");
    if (secret && given !== secret) return json({ ok: false, error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const day = new Date().toISOString().slice(0, 10);
    const H0 = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    // Idempotent per day: if today's ideas already exist and not forced, skip the Opus call.
    // This caps LLM cost to ~one run/day no matter how often the endpoint is hit.
    const chk = await fetch(`${SUPABASE_URL}/rest/v1/trade_ideas?day=eq.${day}&select=id&limit=1`, { headers: H0 });
    const existing = await chk.json().catch(() => []);
    if (Array.isArray(existing) && existing.length && !force) return json({ ok: true, day, cached: true });

    // 1) live quotes for the candidate set (reuse the quotes function)
    const qres = await fetch(`${SUPABASE_URL}/functions/v1/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ symbols: CANDIDATES }),
    });
    const qjson = await qres.json().catch(() => null);
    const quotes: Record<string, any> = (qjson && qjson.quotes) || {};

    // 2) build feature rows
    const rows = Object.keys(quotes).map((t) => {
      const q = quotes[t];
      const last = +q.last, prev = +q.prev_close || last, hi = +q.hi || last, lo = +q.lo || last;
      const chgpct = prev ? (last - prev) / prev * 100 : 0;
      const rangePos = hi > lo ? (last - lo) / (hi - lo) : 0.5;      // 0=at low, 1=at high
      const downFromHigh = hi ? (hi - last) / hi * 100 : 0;           // % below 52wk high
      return { t, name: q.name || t, last, prev, hi, lo, pe: q.pe ?? null, mc: q.mc ?? null, chgpct, rangePos, downFromHigh };
    }).filter((r) => isFinite(r.last) && r.last > 0);

    // 3) select ideas across FIVE buckets — momentum, undervalued, overvalued, rebound, breakout
    const used = new Set<string>();
    const take = (arr: any[], n: number) => { const out: any[] = []; for (const r of arr) { if (out.length >= n) break; if (!used.has(r.t)) { out.push(r); used.add(r.t); } } return out; };
    const tag = (arr: any[], bucket: string) => { arr.forEach((r) => (r.bucket = bucket)); return arr; };

    const momentum = tag(take([...rows].sort((a, b) => (b.chgpct + b.rangePos * 4) - (a.chgpct + a.rangePos * 4)), 3), "momentum");
    const undervalued = tag(take([...rows].filter((r) => r.pe != null && r.pe > 0 && r.pe < 28 && r.downFromHigh > 12)
      .sort((a, b) => (b.downFromHigh - b.pe) - (a.downFromHigh - a.pe)), 3), "undervalued");
    const overvalued = tag(take([...rows].filter((r) => r.pe != null && r.pe > 55 && r.rangePos > 0.65)
      .sort((a, b) => (b.pe + b.rangePos * 40) - (a.pe + a.rangePos * 40)), 2), "overvalued");
    const rebound = tag(take([...rows].filter((r) => r.downFromHigh >= 35).sort((a, b) => b.downFromHigh - a.downFromHigh), 2), "rebound");
    const breakout = tag(take([...rows].filter((r) => r.rangePos > 0.85 && r.chgpct > 0).sort((a, b) => b.rangePos - a.rangePos), 2), "breakout");
    const picks = [...momentum, ...undervalued, ...overvalued, ...rebound, ...breakout];
    if (!picks.length) return json({ ok: false, error: "no candidates (quotes empty?)", quotesCount: Object.keys(quotes).length }, 502);

    // 3b) real news context per pick (decision-dashboard method): pull the merged
    // wire once and match headlines by ticker / company name.
    let newsByTicker: Record<string, string[]> = {};
    try {
      const nres = await fetch(`${SUPABASE_URL}/functions/v1/news?limit=50`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      const njson = await nres.json().catch(() => null);
      const items: any[] = (njson && njson.items) || [];
      for (const r of picks) {
        const nm = (r.name || "").toLowerCase().replace(/[.,]/g, "").split(/\s+/)[0];
        const tkRe = new RegExp("[^a-z]" + r.t.toLowerCase() + "[^a-z]");
        const hits = items.filter((it) => {
          const hay = " " + (it.title + " " + (it.summary || "")).toLowerCase() + " ";
          return tkRe.test(hay) || (nm && nm.length >= 3 && hay.includes(nm));
        }).slice(0, 3).map((it) => `"${it.title}" (${it.source})`);
        if (hits.length) newsByTicker[r.t] = hits;
      }
    } catch { /* news is best-effort */ }

    // 4) one Opus call writes a decision-dashboard brief for every pick,
    // grounded in the live numbers AND today's real headlines
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("FLUX_IDEAS_MODEL") || "claude-opus-5";
    let briefs: Record<string, any> = {};
    let dbg: any = { key: !!key, model, newsMatched: Object.keys(newsByTicker).length };
    if (key) {
      const facts = picks.map((r, i) => {
        const nw = newsByTicker[r.t] ? ` NEWS: ${newsByTicker[r.t].join(" | ")}` : "";
        return `${i + 1}. ${r.t} (${r.name}) — $${r.last.toFixed(2)}, ${r.chgpct >= 0 ? "+" : ""}${r.chgpct.toFixed(1)}% today, at ${(r.rangePos * 100).toFixed(0)}% of its 52wk range (${r.downFromHigh.toFixed(0)}% below the $${r.hi.toFixed(2)} high)${r.pe ? `, P/E ${r.pe}` : ", P/E n/a"}, BUCKET=${(r.bucket || "").toUpperCase()}.${nw}`;
      }).join("\n");
      const prompt =
`You are Fluxi, the Flux trading desk. Today you scanned ${rows.length} US stocks and shortlisted these ${picks.length} into buckets. Write a sharp daily DECISION DASHBOARD for EACH, using ONLY the live figures given (do not invent numbers). Where NEWS headlines are given, weave the most relevant one into the thesis or catalyst — cite it naturally, never invent news. These are SIMULATED / educational ideas on a paper desk — never financial advice, never promise returns or exact timing.

Frame each by its BUCKET:
- MOMENTUM / BREAKOUT: trend + relative strength; why it can keep running. Bullish target ABOVE the current price.
- UNDERVALUED: a value/mean-reversion case — cheap on P/E and/or beaten down but with a reason to re-rate. Bullish target above price.
- REBOUND: deeply beaten-down higher-risk recovery; honest that timing is unknown. Bullish target above price.
- OVERVALUED: a CAUTION / avoid / short-watch case — stretched valuation and extended price; why the risk is to the downside. Target BELOW the current price.

For each name return:
- headline (1 line), thesis (2-3 sentences), catalyst (short; use real NEWS when given), risk (short)
- conviction 0-100 (honest, most 40-70) and horizon ("days"/"weeks"/"months")
- target: plausible directional level (above price for bullish buckets, below for OVERVALUED)
- entry: a sensible entry zone price (near/below current for bullish; for OVERVALUED the level that would confirm the caution)
- stop: the stop-loss / invalidation level (below entry for bullish; above price for OVERVALUED)
- watch: ONE concrete thing to watch that would change the call (a level breaking, an event, follow-through)

LIVE DATA:
${facts}

Respond with STRICT JSON only, no prose, shape:
{"ideas":[{"ticker":"GEV","kind":"momentum|undervalued|overvalued|rebound|breakout","direction":"long|avoid","headline":"...","thesis":"...","catalyst":"...","risk":"...","conviction":60,"horizon":"weeks","target":123.45,"entry":118.0,"stop":109.5,"watch":"..."}]}`;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
      });
      dbg.status = resp.status;
      if (resp.ok) {
        const data = await resp.json();
        let txt = Array.isArray(data?.content) ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") : "";
        dbg.snippet = (txt || "").slice(0, 200);
        txt = txt.replace(/```json/gi, "").replace(/```/g, "").trim();       // strip markdown fences
        const arr = txt.match(/\[[\s\S]*\]/);                                 // the ideas array
        const obj = txt.match(/\{[\s\S]*\}/);                                 // or the whole object
        let list: any[] = [];
        try {
          if (obj) { const p = JSON.parse(obj[0]); list = p.ideas || (Array.isArray(p) ? p : []); }
          if (!list.length && arr) list = JSON.parse(arr[0]);
        } catch (e) { dbg.parseErr = String(e).slice(0, 120); }
        list.forEach((it: any) => { if (it && it.ticker) briefs[String(it.ticker).toUpperCase()] = it; });
        dbg.parsed = list.length;
      } else {
        dbg.errBody = (await resp.text().catch(() => "")).slice(0, 200);
      }
    }

    // 5) assemble rows (fallback brief if the LLM didn't cover a name)
    const bucketDefaults: Record<string, any> = {
      momentum:   { up: true,  mult: 1.12, conv: 62, hz: "weeks",  head: (r: any) => `${r.t} riding momentum`, th: (r: any) => `${r.name} is up ${r.chgpct.toFixed(1)}% and near the top of its 52-week range — trend and relative strength are with it.` },
      breakout:   { up: true,  mult: 1.14, conv: 60, hz: "weeks",  head: (r: any) => `${r.t} breaking to new highs`, th: (r: any) => `${r.name} is pressing the top of its range at $${r.last.toFixed(2)} — a breakout that can extend if it holds.` },
      undervalued:{ up: true,  mult: 1.2,  conv: 56, hz: "months", head: (r: any) => `${r.t} looks cheap here`, th: (r: any) => `${r.name} trades at ${r.pe ? "a P/E of " + r.pe : "a low multiple"} and ${r.downFromHigh.toFixed(0)}% below its high — a value/mean-reversion case if sentiment turns.` },
      rebound:    { up: true,  mult: 1.25, conv: 50, hz: "months", head: (r: any) => `${r.t} — beaten down, rebound setup`, th: (r: any) => `${r.name} is ${r.downFromHigh.toFixed(0)}% below its 52-week high of $${r.hi.toFixed(2)}. It can stay down a while, but the setup favors recovery over time.` },
      overvalued: { up: false, mult: 0.85, conv: 52, hz: "weeks",  head: (r: any) => `${r.t} looks stretched — caution`, th: (r: any) => `${r.name} carries a rich ${r.pe ? "P/E of " + r.pe : "valuation"} while trading near the top of its range — the risk here skews to the downside.` },
    };
    const ideas = picks.map((r, i) => {
      const b = briefs[r.t] || {};
      const bk = (b.kind || r.bucket || "momentum");
      const d = bucketDefaults[bk] || bucketDefaults.momentum;
      const dir = b.direction || (bk === "overvalued" ? "avoid" : "long");
      const bull = dir !== "avoid";
      const defEntry = bull ? r.last * 0.99 : r.last * 1.02;
      const defStop = bull ? Math.max(r.lo, r.last * 0.92) : r.last * 1.07;
      return {
        day, idx: i + 1, ticker: r.t, name: r.name, sector: null,
        kind: bk, direction: dir,
        price: +r.last.toFixed(2),
        target: b.target != null ? +(+b.target).toFixed(2) : +(r.last * d.mult).toFixed(2),
        entry: b.entry != null ? +(+b.entry).toFixed(2) : +defEntry.toFixed(2),
        stop: b.stop != null ? +(+b.stop).toFixed(2) : +defStop.toFixed(2),
        watch: b.watch || (bull ? "Whether it holds above the entry zone on a pullback." : "Whether price loses momentum at these extended levels."),
        news: newsByTicker[r.t] ? newsByTicker[r.t].join(" | ").slice(0, 500) : null,
        conviction: Math.max(1, Math.min(100, Math.round(b.conviction || d.conv))),
        horizon: b.horizon || d.hz,
        headline: b.headline || d.head(r),
        thesis: b.thesis || d.th(r),
        catalyst: b.catalyst || "Sector rotation and follow-through flows.",
        risk: b.risk || "High volatility; the move may take longer than expected or fail.",
      };
    });

    // 6) replace today's ideas
    const base = `${SUPABASE_URL}/rest/v1/trade_ideas`;
    const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
    await fetch(`${base}?day=eq.${day}`, { method: "DELETE", headers: H });
    const ins = await fetch(base, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(ideas) });
    if (!ins.ok) return json({ ok: false, error: "insert failed", detail: (await ins.text()).slice(0, 300) }, 500);

    return json({ ok: true, day, count: ideas.length, used_llm: Object.keys(briefs).length > 0, dbg, tickers: ideas.map((i) => i.ticker) });
  } catch (e) {
    console.error("generate-ideas exception", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
