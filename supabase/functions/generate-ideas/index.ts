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

// Higher-beta / momentum / rebound candidates across AI, semis, power, crypto, growth —
// deliberately NOT just mega-cap blue chips.
const CANDIDATES = [
  "GEV","VST","CEG","OKLO","SMR","NVDA","AMD","SMCI","ARM","MU","MRVL","AVGO","QCOM","ON","TSM",
  "MARA","COIN","HOOD","SOFI","AFRM","UPST","XYZ",
  "PLTR","SNOW","NET","CRWD","DDOG","APP","ANET","PANW","NOW","MDB","ZS",
  "TSLA","RIVN","CVNA","ABNB","SHOP","RBLX","DKNG","UBER","MELI",
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

    // 3) select ~3 momentum (up + near highs) + ~3 rebound (deeply below highs)
    const momentum = rows.slice().sort((a, b) =>
      (b.chgpct + b.rangePos * 4) - (a.chgpct + a.rangePos * 4)).slice(0, 3);
    const momSet = new Set(momentum.map((r) => r.t));
    const rebound = rows.filter((r) => !momSet.has(r.t) && r.downFromHigh >= 20)
      .sort((a, b) => b.downFromHigh - a.downFromHigh).slice(0, 3);
    const picks = [...momentum, ...rebound].slice(0, 6);
    if (!picks.length) return json({ ok: false, error: "no candidates (quotes empty?)", quotesCount: Object.keys(quotes).length }, 502);

    // 4) one Opus call writes a brief for every pick, grounded in the live numbers
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("FLUX_IDEAS_MODEL") || "claude-opus-5";
    let briefs: Record<string, any> = {};
    let dbg: any = { key: !!key, model };
    if (key) {
      const facts = picks.map((r, i) => `${i + 1}. ${r.t} (${r.name}) — $${r.last.toFixed(2)}, ${r.chgpct >= 0 ? "+" : ""}${r.chgpct.toFixed(1)}% today, ${r.downFromHigh.toFixed(0)}% below 52wk high $${r.hi.toFixed(2)} (low $${r.lo.toFixed(2)})${r.pe ? `, P/E ${r.pe}` : ""}, bucket=${momSet.has(r.t) ? "MOMENTUM" : "REBOUND"}`).join("\n");
      const prompt =
`You are Fluxi, the Flux trading desk. Write a punchy daily "trade idea" brief for each of these ${picks.length} names, using ONLY the live figures given (do not invent numbers). These are SIMULATED / educational ideas on a paper desk — never financial advice, never promise returns or exact timing.

For each name return: a 1-line headline, a 2-3 sentence thesis (why it could move — momentum setup or a beaten-down name with rebound potential), a short catalyst, a short risk, a conviction 0-100 (be honest, most 45-70), a horizon ("days"/"weeks"/"months"), and a plausible directional target price near the current price (a level, not a promise).

LIVE DATA:
${facts}

Respond with STRICT JSON only, no prose, shape:
{"ideas":[{"ticker":"GEV","kind":"momentum|rebound","headline":"...","thesis":"...","catalyst":"...","risk":"...","conviction":60,"horizon":"weeks","target":123.45}]}`;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 2200, messages: [{ role: "user", content: prompt }] }),
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
    const ideas = picks.map((r, i) => {
      const b = briefs[r.t] || {};
      const isMom = momSet.has(r.t);
      return {
        day, idx: i + 1, ticker: r.t, name: r.name, sector: null,
        kind: b.kind || (isMom ? "momentum" : "rebound"),
        direction: "long",
        price: +r.last.toFixed(2),
        target: b.target != null ? +(+b.target).toFixed(2) : +(r.last * (isMom ? 1.12 : 1.25)).toFixed(2),
        conviction: Math.max(1, Math.min(100, Math.round(b.conviction || (isMom ? 62 : 55)))),
        horizon: b.horizon || (isMom ? "weeks" : "months"),
        headline: b.headline || (isMom ? `${r.t} riding momentum` : `${r.t} — beaten down, rebound setup`),
        thesis: b.thesis || (isMom
          ? `${r.name} is up ${r.chgpct.toFixed(1)}% and trading near the top of its 52-week range — trend and relative strength are with it.`
          : `${r.name} is ${r.downFromHigh.toFixed(0)}% below its 52-week high of $${r.hi.toFixed(2)}. Names like this can stay down for a while, but the setup favors a recovery over time.`),
        catalyst: b.catalyst || "Sector rotation and follow-through buying.",
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
