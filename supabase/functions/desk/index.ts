// Flux — the persistent research desk.
//
//   3 analysts  ──►  Director of Research  ──►  two traders  ──►  Executive
//  fundamentals          synthesises the        Kronos + DSA      green light
//  catalyst              three notes into       turn the call     approve /
//  tape                  one package            into a trade      reduce / reject
//
// The loop never stops. A round is a state machine and ONE stage runs per
// invocation, so no call is long-running and a crash mid-stage is recoverable.
// pg_cron ticks this every minute; the engine decides whether to advance the
// open round or open a new one, pacing new rounds itself (faster while the US
// market is open, slower overnight) so "persistent" doesn't mean "expensive".
//
// Auth: optional header x-cron-secret: <CRON_SECRET>. Deployed verify_jwt=false.
// Secrets: ANTHROPIC_API_KEY, (auto) SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optional: FLUX_DESK_ANALYST_MODEL, FLUX_DESK_DIRECTOR_MODEL, FLUX_DESK_EXEC_MODEL,
//           FLUX_DESK_INTERVAL_RTH, FLUX_DESK_INTERVAL_OFF, FLUX_DESK_NAMES.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";

const M_ANALYST = Deno.env.get("FLUX_DESK_ANALYST_MODEL") || "claude-haiku-4-5-20251001";
const M_DIRECTOR = Deno.env.get("FLUX_DESK_DIRECTOR_MODEL") || "claude-haiku-4-5-20251001";
const M_EXEC = Deno.env.get("FLUX_DESK_EXEC_MODEL") || "claude-opus-5";

const NAMES_PER_ROUND = Math.max(2, Math.min(10, parseInt(Deno.env.get("FLUX_DESK_NAMES") || "6", 10)));
const INTERVAL_RTH = parseInt(Deno.env.get("FLUX_DESK_INTERVAL_RTH") || "900", 10);   // 15 min
const INTERVAL_OFF = parseInt(Deno.env.get("FLUX_DESK_INTERVAL_OFF") || "3600", 10);  // 1 h
const CLAIM_STALE_MS = 5 * 60 * 1000;

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const HJ = { ...H, "Content-Type": "application/json" };

// The desk's coverage universe. The round cursor walks it, so over a day the
// desk works through every name instead of circling the same handful.
const UNIVERSE = [
  "NVDA","AMD","AVGO","MU","ARM","SMCI","MRVL","QCOM","TXN","ADI","LRCX","AMAT","KLAC","TSM","ON","INTC",
  "PLTR","SNOW","NET","CRWD","DDOG","APP","ANET","PANW","NOW","MDB","ZS","CRM","ORCL","ADBE","INTU","SNPS","CDNS","WDAY","TEAM","SHOP","MELI",
  "META","GOOGL","AMZN","MSFT","AAPL","NFLX","UBER","ABNB","DASH","RBLX","SPOT","PINS","SNAP","DKNG",
  "GEV","VST","CEG","OKLO","SMR","NEE","XOM","CVX","COP","SLB","FSLR","ENPH",
  "COIN","MARA","RIOT","MSTR","HOOD","SOFI","AFRM","UPST","XYZ","PYPL","V","MA","AXP","NU",
  "JPM","BAC","WFC","GS","MS","C","SCHW",
  "LLY","UNH","JNJ","PFE","MRK","ABBV","TMO","ABT","AMGN","GILD",
  "TSLA","RIVN","F","GM","CVNA","NKE","SBUX","MCD","WMT","COST","HD","LOW","TGT","DIS","BA","CAT","GE","DE","UPS","LMT",
];

/* ------------------------------------------------------------------ utils */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
const nz = (v: any, d = 0) => (Number.isFinite(+v) ? +v : d);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** US regular trading hours, roughly, in UTC (no DST table — close enough for pacing). */
function marketOpen(d = new Date()) {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 13 * 60 + 30 && mins <= 20 * 60;
}
function roundInterval() { return (marketOpen() ? INTERVAL_RTH : INTERVAL_OFF) * 1000; }

async function sel(path: string): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : [];          // PostgREST returns an object on error
}
async function ins(table: string, rows: unknown) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...HJ, Prefer: "return=minimal" }, body: JSON.stringify(rows),
  });
}
async function patch(path: string, body: unknown, representation = false) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...HJ, Prefer: representation ? "return=representation" : "return=minimal" },
    body: JSON.stringify(body),
  });
  return representation ? ((await r.json().catch(() => [])) as any[]) : [];
}

/** Ask Claude for STRICT JSON and parse it defensively (fences, stray prose). */
async function askJSON(model: string, prompt: string, maxTokens = 4000) {
  if (!ANTHROPIC) return { ok: false, error: "no ANTHROPIC_API_KEY", data: null as any };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`, data: null as any };
  const body = await res.json();
  let txt = Array.isArray(body?.content) ? body.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") : "";
  txt = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  const obj = txt.match(/\{[\s\S]*\}/);
  try {
    return { ok: true, error: null, data: obj ? JSON.parse(obj[0]) : JSON.parse(txt) };
  } catch (e) {
    return { ok: false, error: "parse: " + String(e).slice(0, 120), data: null as any, raw: txt.slice(0, 300) };
  }
}

/* ------------------------------------------------------------ market data */
type Feat = {
  t: string; name: string; last: number; prev: number; hi: number; lo: number;
  pe: number | null; mc: number | null; chgpct: number; rangePos: number; downFromHigh: number;
};

function featOf(t: string, q: any): Feat | null {
  const last = nz(q.last), prev = nz(q.prev_close) || last, hi = nz(q.hi) || last, lo = nz(q.lo) || last;
  if (!(last > 0)) return null;
  return {
    t, name: q.name || t, last, prev, hi, lo,
    pe: q.pe ?? null, mc: q.mc ?? null,
    chgpct: prev ? ((last - prev) / prev) * 100 : 0,
    rangePos: hi > lo ? (last - lo) / (hi - lo) : 0.5,
    downFromHigh: hi ? ((hi - last) / hi) * 100 : 0,
  };
}

async function quotesFor(symbols: string[]): Promise<Record<string, any>> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/quotes`, {
    method: "POST", headers: HJ, body: JSON.stringify({ symbols }),
  });
  const j = await r.json().catch(() => null);
  return (j && j.quotes) || {};
}

async function newsFor(feats: Feat[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/news?limit=60`, { headers: H });
    const j = await r.json().catch(() => null);
    const items: any[] = (j && j.items) || [];
    for (const f of feats) {
      const nm = (f.name || "").toLowerCase().replace(/[.,]/g, "").split(/\s+/)[0];
      const re = new RegExp("[^a-z]" + f.t.toLowerCase() + "[^a-z]");
      const hits = items.filter((it) => {
        const hay = " " + (it.title + " " + (it.summary || "")).toLowerCase() + " ";
        return re.test(hay) || (nm && nm.length >= 3 && hay.includes(nm));
      }).slice(0, 3).map((it) => `"${it.title}" (${it.source}${it.gov ? ", GOV" : ""})`);
      if (hits.length) out[f.t] = hits;
      }
    // the macro/policy wire everyone is trading against
    const gov = items.filter((it) => it.gov).slice(0, 5).map((it) => `"${it.title}" (${it.source})`);
    if (gov.length) out.__GOV__ = gov;
  } catch { /* news is best-effort */ }
  return out;
}

async function tvFor(symbols: string[]): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/tv?scan=${encodeURIComponent(symbols.join(","))}`, { headers: H });
    const j = await r.json().catch(() => null);
    for (const x of (j && j.results) || []) if (x && x.symbol) out[x.symbol] = x;
  } catch { /* TradingView is best-effort */ }
  return out;
}

async function openbbFor(symbols: string[]): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  try {
    const probe = await fetch(`${SUPABASE_URL}/functions/v1/research?symbol=${symbols[0]}`, { headers: H });
    const first = await probe.json().catch(() => null);
    if (!first || first.configured === false) return out;          // bridge not deployed — skip quietly
    if (first.ok && first.fundamentals) out[symbols[0]] = first.fundamentals;
    const rest = await Promise.all(symbols.slice(1).map((s) =>
      fetch(`${SUPABASE_URL}/functions/v1/research?symbol=${s}`, { headers: H })
        .then((r) => r.json()).catch(() => null)));
    rest.forEach((j, i) => { if (j && j.ok && j.fundamentals) out[symbols[i + 1]] = j.fundamentals; });
  } catch { /* optional */ }
  return out;
}

/* -------------------------------------------------------- trader: Kronos */
// Faithful to the client engine: forecast the next candles, take the predicted
// return, threshold at 2%. Uses a REAL forecast from the `forecasts` table when
// the Python bridge has published one, else the same seeded Monte-Carlo.
function seedOf(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 233280; return h || 7; }
function kronosApprox(f: Feat) {
  const drift = f.prev ? (f.last - f.prev) / f.prev : 0;
  const vol = Math.max(0.009, Math.abs(drift) * 1.3 + 0.013);
  let r = seedOf(f.t + "|kronos");
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const H_ = 5, SAMPLES = 24, ends: number[] = [];
  for (let s = 0; s < SAMPLES; s++) {
    let p = f.last;
    for (let h = 0; h < H_; h++) p = p * (1 + drift * 0.3 + gauss() * vol);
    ends.push(p);
  }
  const mean = ends.reduce((a, b) => a + b, 0) / ends.length;
  const up = ends.filter((e) => e >= f.last).length / SAMPLES;
  return {
    predClose: mean,
    predReturn: f.last ? (mean - f.last) / f.last : 0,
    confidence: Math.round(Math.abs(up - 0.5) * 2 * 100),
    model: "Kronos-approx", real: false,
  };
}
function kronosCall(f: Feat, real: any) {
  const k = real && real.pred_close
    ? {
      predClose: nz(real.pred_close),
      predReturn: f.last ? (nz(real.pred_close) - f.last) / f.last : nz(real.pred_return),
      confidence: real.confidence != null ? nz(real.confidence) : 70,
      model: real.model || "Kronos", real: true,
    }
    : kronosApprox(f);
  const action = k.predReturn > 0.02 ? "BUY" : k.predReturn < -0.02 ? "SELL" : "HOLD";
  const side = action === "BUY" ? "long" : action === "SELL" ? "avoid" : "flat";
  return {
    trader: "kronos", action, side,
    pred_return_pct: r2(k.predReturn * 100),
    pred_close: r2(k.predClose),
    confidence: Math.round(k.confidence),
    model: k.model, real: k.real, horizon: "days",
    entry: side === "long" ? r2(f.last * 0.995) : null,
    stop: side === "long" ? r2(Math.max(f.lo, f.last * 0.94)) : null,
    target: side === "long" ? r2(Math.max(k.predClose, f.last * 1.03)) : null,
    rationale: `Kronos forecasts ${k.predReturn >= 0 ? "+" : ""}${r2(k.predReturn * 100)}% over the next 5 candles (${Math.round(k.confidence)}% path agreement) → ${action}.`,
  };
}

/* ------------------------------------------------------------ trader: DSA */
// The daily-stock-analysis engine: a transparent composite score over value,
// momentum, range position and drawdown, tilted by the director's read, turned
// into an entry / stop / target ladder and a position size.
function dsaCall(f: Feat, directorScore: number) {
  const parts: Record<string, number> = {};
  parts.momentum = Math.max(-25, Math.min(25, f.chgpct * 4));
  parts.range = (f.rangePos - 0.5) * 40;                              // high in range = trend
  parts.drawdown = f.downFromHigh > 25 ? Math.min(20, (f.downFromHigh - 25) * 0.5) : 0;  // value in the fall
  parts.value = f.pe != null && f.pe > 0
    ? (f.pe < 20 ? 15 : f.pe < 35 ? 5 : f.pe > 60 ? -18 : -5)
    : 0;
  parts.stretch = f.rangePos > 0.9 && (f.pe ?? 0) > 55 ? -15 : 0;      // extended AND expensive
  parts.director = Math.max(-30, Math.min(30, directorScore * 0.3));
  const score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  const side = score >= 18 ? "long" : score <= -18 ? "avoid" : "flat";
  const atrish = Math.max(f.last * 0.03, (f.hi - f.lo) * 0.04);        // a crude volatility unit
  return {
    trader: "dsa", score, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, r2(v)])),
    side,
    confidence: Math.min(95, Math.abs(score) + 30),
    horizon: f.downFromHigh > 25 ? "months" : "weeks",
    entry: side === "long" ? r2(f.last - atrish * 0.3) : side === "avoid" ? r2(f.last * 1.02) : null,
    stop: side === "long" ? r2(f.last - atrish * 2) : side === "avoid" ? r2(f.last * 1.08) : null,
    target: side === "long" ? r2(f.last + atrish * 3.5) : side === "avoid" ? r2(f.last * 0.9) : null,
    size_pct: side === "flat" ? 0 : Math.max(1, Math.min(8, Math.round(Math.abs(score) / 10))),
    rationale: `DSA composite ${score >= 0 ? "+" : ""}${score} (momentum ${r2(parts.momentum)}, range ${r2(parts.range)}, value ${r2(parts.value)}, drawdown ${r2(parts.drawdown)}, director ${r2(parts.director)}) → ${side}.`,
  };
}

/* --------------------------------------------------------------- stages */

async function stageOpen() {
  const prev = (await sel("desk_rounds?select=id,seq,stage,status,finished_at,meta&order=seq.desc&limit=1"))[0];
  const seq = prev ? nz(prev.seq) + 1 : 1;
  const cursor = prev && prev.meta && Number.isFinite(+prev.meta.cursor) ? +prev.meta.cursor : 0;

  // rotate through the universe so coverage is real, then blend in today's movers
  const rot: string[] = [];
  for (let i = 0; i < NAMES_PER_ROUND; i++) rot.push(UNIVERSE[(cursor + i) % UNIVERSE.length]);
  const nextCursor = (cursor + NAMES_PER_ROUND) % UNIVERSE.length;

  const quotes = await quotesFor(UNIVERSE);
  const feats = Object.keys(quotes).map((t) => featOf(t, quotes[t])).filter(Boolean) as Feat[];
  const movers = [...feats].sort((a, b) => Math.abs(b.chgpct) - Math.abs(a.chgpct)).slice(0, 2).map((f) => f.t);
  const tickers = Array.from(new Set([...rot, ...movers])).filter((t) => quotes[t]).slice(0, NAMES_PER_ROUND + 2);
  const chosen = tickers.map((t) => featOf(t, quotes[t])).filter(Boolean) as Feat[];
  if (!chosen.length) return { ok: false, error: "no quotes" };

  const breadth = feats.length
    ? { up: feats.filter((f) => f.chgpct > 0).length, down: feats.filter((f) => f.chgpct < 0).length, scanned: feats.length,
        avg: r2(feats.reduce((a, b) => a + b.chgpct, 0) / feats.length) }
    : null;

  const row = await fetch(`${SUPABASE_URL}/rest/v1/desk_rounds`, {
    method: "POST", headers: { ...HJ, Prefer: "return=representation" },
    body: JSON.stringify({
      seq, stage: "analysts", status: "running", tickers,
      meta: { cursor: nextCursor, feats: chosen, breadth, market_open: marketOpen() },
    }),
  });
  const created = (await row.json().catch(() => []))[0];
  return { ok: true, stage: "open", seq, round: created?.id, tickers };
}

async function stageAnalysts(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const syms = feats.map((f) => f.t);
  const [news, tv, obb] = await Promise.all([newsFor(feats), tvFor(syms), openbbFor(syms)]);

  const numbers = feats.map((f) =>
    `${f.t} (${f.name}): $${r2(f.last)}, ${f.chgpct >= 0 ? "+" : ""}${r2(f.chgpct)}% today, ` +
    `${Math.round(f.rangePos * 100)}% of its 52-week range, ${r2(f.downFromHigh)}% below the $${r2(f.hi)} high` +
    `${f.pe ? `, P/E ${f.pe}` : ", P/E n/a"}${f.mc ? `, market cap ${f.mc}` : ""}.`).join("\n");

  const fundExtra = Object.keys(obb).length
    ? "\n\nDeeper fundamentals (OpenBB):\n" + Object.keys(obb).map((t) => {
      const d = obb[t];
      return `${t}: fwd P/E ${d.forward_pe ?? "n/a"}, profit margin ${d.profit_margin ?? "n/a"}, ROE ${d.return_on_equity ?? "n/a"}, debt/equity ${d.debt_to_equity ?? "n/a"}, revenue growth ${d.revenue_growth ?? "n/a"}, analyst view via consensus.`;
    }).join("\n")
    : "";

  const newsBlock = feats.map((f) => `${f.t}: ${news[f.t] ? news[f.t].join(" | ") : "no matched headlines"}`).join("\n") +
    (news.__GOV__ ? `\n\nPolicy / government wire: ${(news.__GOV__ as any).join(" | ")}` : "");

  const tapeBlock = feats.map((f) => {
    const x = tv[f.t];
    return `${f.t}: $${r2(f.last)}, ${f.chgpct >= 0 ? "+" : ""}${r2(f.chgpct)}% today, range position ${Math.round(f.rangePos * 100)}%, ${r2(f.downFromHigh)}% off the high` +
      (x ? `, TradingView rating ${x.label} (${x.score != null ? r2(x.score) : "n/a"})` : "");
  }).join("\n");

  const shape = `{"notes":[{"ticker":"NVDA","view":"bullish|bearish|neutral","conviction":0-100,"note":"2-3 sentences","evidence":["short fact","short fact"],"risk":"one line"}]}`;
  const rules = `You are one analyst on a simulated paper-trading research desk. Use ONLY the figures given — never invent a number, a headline or an event. Be willing to say neutral; most convictions should sit between 35 and 70. This is educational research on virtual money, never financial advice. Respond with STRICT JSON only, shape:\n${shape}`;

  const prompts: Record<string, string> = {
    fundamentals: `${rules}\n\nYou are the FUNDAMENTALS analyst. Judge each name on valuation, growth and quality — is the price paying for something real?\n\nLIVE NUMBERS:\n${numbers}${fundExtra}`,
    catalyst: `${rules}\n\nYou are the CATALYST analyst. Judge each name on what is actually happening right now — company news, sector news, and policy/government announcements that move it. If a name has no matched headline, say so and mark it neutral rather than inventing a story.\n\nHEADLINES:\n${newsBlock}\n\nPRICE CONTEXT:\n${numbers}`,
    tape: `${rules}\n\nYou are the TAPE analyst. Judge each name on price action alone — trend, momentum, where it sits in its range, whether it is extended or basing, and what the technical rating says.\n\nTAPE:\n${tapeBlock}`,
  };

  const results = await Promise.all(Object.keys(prompts).map(async (agent) => {
    const r = await askJSON(M_ANALYST, prompts[agent], 3000);
    return { agent, r };
  }));

  const rows: any[] = [];
  for (const { agent, r } of results) {
    const list: any[] = (r.data && r.data.notes) || [];
    for (const n of list) {
      const tk = String(n.ticker || "").toUpperCase();
      if (!tk || !syms.includes(tk)) continue;
      rows.push({
        round_id: round.id, stage: "analyst", agent, ticker: tk,
        payload: {
          view: String(n.view || "neutral").toLowerCase(),
          conviction: Math.max(0, Math.min(100, Math.round(nz(n.conviction, 50)))),
          note: String(n.note || "").slice(0, 1200),
          evidence: Array.isArray(n.evidence) ? n.evidence.slice(0, 4).map((e: any) => String(e).slice(0, 240)) : [],
          risk: String(n.risk || "").slice(0, 400),
        },
      });
    }
    if (!r.ok) {
      rows.push({ round_id: round.id, stage: "analyst", agent, ticker: null, payload: { error: r.error } });
    }
  }
  if (rows.length) await ins("desk_notes", rows);
  // carry the round's context forward so later stages don't refetch
  await patch(`desk_rounds?id=eq.${round.id}`, {
    meta: { ...(round.meta || {}), news, tv, obb_count: Object.keys(obb).length },
  });
  return { ok: true, stage: "analysts", notes: rows.length, agents: results.map((x) => ({ a: x.agent, ok: x.r.ok, err: x.r.error })) };
}

async function stageDirector(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const notes = await sel(`desk_notes?round_id=eq.${round.id}&stage=eq.analyst&select=agent,ticker,payload`);
  const byTicker: Record<string, any[]> = {};
  for (const n of notes) { if (!n.ticker) continue; (byTicker[n.ticker] ||= []).push(n); }

  const desk = feats.map((f) => {
    const list = byTicker[f.t] || [];
    const lines = list.map((n) =>
      `  - ${n.agent}: ${n.payload.view} (${n.payload.conviction}) — ${n.payload.note}${n.payload.risk ? ` RISK: ${n.payload.risk}` : ""}`).join("\n");
    return `${f.t} — $${r2(f.last)}, ${f.chgpct >= 0 ? "+" : ""}${r2(f.chgpct)}% today\n${lines || "  - (no analyst covered this name)"}`;
  }).join("\n\n");

  const prompt =
`You are the DIRECTOR OF RESEARCH on a simulated paper-trading desk. Three analysts — fundamentals, catalyst and tape — have filed on the names below. Your job is to synthesise, not to repeat: resolve where they disagree, say which view carries more weight and why, and hand the traders one clear package per name.

Drop any name that is not worth the traders' time — passing is a real answer and a short list is a good list. But a strong NEGATIVE read is a call, not a pass: if the analysts are lined up against a name, hand it forward as "avoid" with a negative score rather than dropping it.

For each name you keep, return:
- stance: "long" | "short" | "avoid" | "pass"
- score: -100..100 (conviction with direction; be honest, most between -60 and 60)
- summary: 2-3 sentences a trader can act on
- key_points: up to 3 short bullets, each grounded in what an analyst actually said
- disagreement: where the analysts differ, or "none"
- watch: the ONE thing that would change this call

ANALYST FILINGS:
${desk}

Respond with STRICT JSON only, shape:
{"package":[{"ticker":"NVDA","stance":"long","score":45,"summary":"...","key_points":["..."],"disagreement":"...","watch":"..."}],"desk_view":"one sentence on the overall tone across these names"}`;

  const r = await askJSON(M_DIRECTOR, prompt, 4000);
  const pkg: any[] = (r.data && r.data.package) || [];
  const rows = pkg.filter((p) => p && p.ticker).map((p) => ({
    round_id: round.id, stage: "director", agent: "director", ticker: String(p.ticker).toUpperCase(),
    payload: {
      stance: String(p.stance || "pass").toLowerCase(),
      score: Math.max(-100, Math.min(100, Math.round(nz(p.score)))),
      summary: String(p.summary || "").slice(0, 1200),
      key_points: Array.isArray(p.key_points) ? p.key_points.slice(0, 3).map((x: any) => String(x).slice(0, 240)) : [],
      disagreement: String(p.disagreement || "none").slice(0, 400),
      watch: String(p.watch || "").slice(0, 300),
    },
  }));
  if (rows.length) await ins("desk_notes", rows);
  await patch(`desk_rounds?id=eq.${round.id}`, {
    meta: { ...(round.meta || {}), desk_view: (r.data && r.data.desk_view) || null, director_ok: r.ok, director_err: r.error },
  });
  return { ok: true, stage: "director", kept: rows.length, err: r.error };
}

async function stageTraders(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const dir = await sel(`desk_notes?round_id=eq.${round.id}&stage=eq.director&select=ticker,payload`);
  const dirBy: Record<string, any> = {};
  for (const d of dir) if (d.ticker) dirBy[d.ticker] = d.payload;

  // real Kronos forecasts, when the Python bridge has published any
  const syms = feats.map((f) => f.t);
  let fc: Record<string, any> = {};
  try {
    const list = await sel(`forecasts?ticker=in.(${syms.join(",")})&select=ticker,pred_close,pred_return,confidence,model,updated_at`);
    for (const f of list) fc[f.ticker] = f;
  } catch { /* table may not exist yet */ }

  const rows: any[] = [];
  for (const f of feats) {
    const d = dirBy[f.t];
    if (!d || d.stance === "pass") continue;                 // the director already dropped it
    const k = kronosCall(f, fc[f.t]);
    const s = dsaCall(f, nz(d.score));
    rows.push({ round_id: round.id, stage: "trader", agent: "kronos", ticker: f.t, payload: k });
    rows.push({ round_id: round.id, stage: "trader", agent: "dsa", ticker: f.t, payload: s });
  }
  if (rows.length) await ins("desk_notes", rows);
  return { ok: true, stage: "traders", proposals: rows.length, kronos_real: Object.keys(fc).length };
}

async function stageExecutive(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const featBy: Record<string, Feat> = {}; for (const f of feats) featBy[f.t] = f;
  const notes = await sel(`desk_notes?round_id=eq.${round.id}&select=stage,agent,ticker,payload`);
  const dirBy: Record<string, any> = {}, kBy: Record<string, any> = {}, sBy: Record<string, any> = {};
  for (const n of notes) {
    if (!n.ticker) continue;
    if (n.agent === "director") dirBy[n.ticker] = n.payload;
    if (n.agent === "kronos") kBy[n.ticker] = n.payload;
    if (n.agent === "dsa") sBy[n.ticker] = n.payload;
  }
  const live = Object.keys(kBy);
  if (!live.length) {
    await patch(`desk_rounds?id=eq.${round.id}`, { stage: "done", status: "done", finished_at: new Date().toISOString() });
    return { ok: true, stage: "executive", decisions: 0, note: "nothing reached the traders" };
  }

  // what the desk has already green-lit today, so the executive can manage concentration
  const recent = await sel("desk_decisions?verdict=neq.rejected&select=ticker,side,created_at&order=created_at.desc&limit=25");
  const bookLine = recent.length
    ? recent.slice(0, 12).map((d: any) => `${d.ticker} ${d.side}`).join(", ")
    : "nothing open";

  const body = live.map((t) => {
    const f = featBy[t], d = dirBy[t] || {}, k = kBy[t], s = sBy[t];
    return `${t} (${f?.name || t}) — $${r2(f?.last || 0)}, ${(f?.chgpct ?? 0) >= 0 ? "+" : ""}${r2(f?.chgpct || 0)}% today
  DIRECTOR: ${d.stance} score ${d.score} — ${d.summary} WATCH: ${d.watch}${d.disagreement && d.disagreement !== "none" ? ` DISAGREEMENT: ${d.disagreement}` : ""}
  KRONOS:   ${k.action} (${k.model}${k.real ? ", real forecast" : ", approximation"}) predicted ${k.pred_return_pct >= 0 ? "+" : ""}${k.pred_return_pct}% over 5 candles, confidence ${k.confidence}. entry ${k.entry ?? "—"} stop ${k.stop ?? "—"} target ${k.target ?? "—"}
  DSA:      ${s.side} score ${s.score}, size ${s.size_pct}%. entry ${s.entry ?? "—"} stop ${s.stop ?? "—"} target ${s.target ?? "—"} (${s.rationale})`;
  }).join("\n\n");

  const prompt =
`You are the EXECUTIVE of a simulated paper-trading desk. Nothing trades without your green light. The Director of Research has filed a package on each name and two traders — KRONOS (a candle-forecast model) and DSA (a composite scoring engine) — have each proposed a trade.

Rule the desk, don't rubber-stamp it:
- Where the two traders agree AND the director agrees, you can approve at a normal size.
- Where they disagree, either pick a side and say why, or cut the size, or reject. Say which.
- Reject anything where the case is thin, the risk is unclear, or it just repeats exposure the desk already has.
- Position size is 1-8% of the book. Total newly approved risk this round should stay sensible; concentration in one theme is a reason to reduce.
- Never invent a number that was not given. Keep entry/stop/target consistent with the direction: for a long, stop below entry and target above; for an avoid/short, the reverse.

This is a simulated, educational paper desk on virtual money. Never financial advice, never a promise of returns.

ALREADY GREEN-LIT RECENTLY: ${bookLine}

ON YOUR DESK:
${body}

For every name above return a ruling. Respond with STRICT JSON only, shape:
{"decisions":[{"ticker":"NVDA","verdict":"approved|reduced|rejected","side":"long|short|avoid|flat","entry":118.0,"stop":109.5,"target":134.0,"size_pct":4,"conviction":62,"horizon":"days|weeks|months","headline":"one line","reason":"2 sentences on why you ruled this way, naming where the traders or analysts disagreed","risk_flags":"short, or 'none'"}],"desk_note":"one sentence on how you are running the book right now"}`;

  const r = await askJSON(M_EXEC, prompt, 5000);
  const list: any[] = (r.data && r.data.decisions) || [];

  const rows = list.filter((x) => x && x.ticker && featBy[String(x.ticker).toUpperCase()]).map((x) => {
    const t = String(x.ticker).toUpperCase();
    const f = featBy[t], d = dirBy[t] || {};
    const verdict = ["approved", "reduced", "rejected"].includes(String(x.verdict)) ? String(x.verdict) : "rejected";
    const side = String(x.side || "flat").toLowerCase();
    return {
      round_id: round.id, ticker: t, name: f.name, verdict, side,
      price: r2(f.last),
      entry: x.entry != null ? r2(nz(x.entry)) : null,
      stop: x.stop != null ? r2(nz(x.stop)) : null,
      target: x.target != null ? r2(nz(x.target)) : null,
      size_pct: verdict === "rejected" ? 0 : Math.max(0, Math.min(8, nz(x.size_pct, 2))),
      conviction: Math.max(0, Math.min(100, Math.round(nz(x.conviction, 50)))),
      horizon: String(x.horizon || "weeks").slice(0, 20),
      headline: String(x.headline || "").slice(0, 300),
      reason: String(x.reason || "").slice(0, 1200),
      risk_flags: String(x.risk_flags || "none").slice(0, 300),
      director_score: nz(d.score),
      teaser: false,
      kronos: kBy[t] || null,
      dsa: sBy[t] || null,
    };
  });

  // the strongest approved call of the round is the one logged-out visitors see
  const approved = rows.filter((x) => x.verdict !== "rejected").sort((a, b) => b.conviction - a.conviction);
  if (approved.length) approved[0].teaser = true;

  if (rows.length) await ins("desk_decisions", rows);
  await patch(`desk_rounds?id=eq.${round.id}`, {
    stage: "done", status: "done", finished_at: new Date().toISOString(),
    meta: { ...(round.meta || {}), desk_note: (r.data && r.data.desk_note) || null, exec_ok: r.ok, exec_err: r.error, feats: undefined },
  });
  return { ok: true, stage: "executive", decisions: rows.length, approved: approved.length, err: r.error };
}

/* ------------------------------------------------------------------ tick */
async function tick(force: boolean) {
  const latest = (await sel("desk_rounds?select=id,seq,stage,status,claimed_at,finished_at,meta&order=seq.desc&limit=1"))[0];

  // no round yet, or the last one finished — open a new one when it's time
  if (!latest || latest.status !== "running") {
    const since = latest?.finished_at ? Date.now() - Date.parse(latest.finished_at) : Infinity;
    if (!force && since < roundInterval()) {
      return { ok: true, waiting: true, next_in_s: Math.round((roundInterval() - since) / 1000), seq: latest?.seq ?? 0 };
    }
    return await stageOpen();
  }

  // a round is open: claim the current stage so overlapping ticks can't double-run it
  const stale = encodeURIComponent(new Date(Date.now() - CLAIM_STALE_MS).toISOString());
  const claimed = await patch(
    `desk_rounds?id=eq.${latest.id}&stage=eq.${latest.stage}&or=(claimed_at.is.null,claimed_at.lt.${stale})`,
    { claimed_at: new Date().toISOString() }, true);
  if (!claimed.length) return { ok: true, busy: true, seq: latest.seq, stage: latest.stage };
  const round = claimed[0];

  try {
    let out: any;
    if (round.stage === "analysts") { out = await stageAnalysts(round); await patch(`desk_rounds?id=eq.${round.id}`, { stage: "director", claimed_at: null }); }
    else if (round.stage === "director") { out = await stageDirector(round); await patch(`desk_rounds?id=eq.${round.id}`, { stage: "traders", claimed_at: null }); }
    else if (round.stage === "traders") { out = await stageTraders(round); await patch(`desk_rounds?id=eq.${round.id}`, { stage: "executive", claimed_at: null }); }
    else if (round.stage === "executive") { out = await stageExecutive(round); }
    else {
      await patch(`desk_rounds?id=eq.${round.id}`, { status: "done", stage: "done", finished_at: new Date().toISOString(), claimed_at: null });
      out = { ok: true, stage: round.stage, note: "closed" };
    }
    return { ...out, seq: round.seq, round: round.id };
  } catch (e) {
    await patch(`desk_rounds?id=eq.${round.id}`, {
      status: "error", error: String(e).slice(0, 500), finished_at: new Date().toISOString(), claimed_at: null,
    });
    return { ok: false, error: String(e).slice(0, 300), seq: round.seq };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const secret = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret");
  const url = new URL(req.url);
  if (secret && given !== secret && url.searchParams.get("public") !== "1") {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    // ?run=1 drives a whole round to completion in one call (used for testing)
    if (url.searchParams.get("run") === "1") {
      const steps: any[] = [];
      for (let i = 0; i < 6; i++) {
        const s = await tick(i === 0);
        steps.push(s);
        if (s.waiting || s.busy || s.ok === false) break;
        if (s.stage === "executive") break;
      }
      return json({ ok: true, steps });
    }
    return json(await tick(url.searchParams.get("force") === "1"));
  } catch (e) {
    console.error("desk exception", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});
