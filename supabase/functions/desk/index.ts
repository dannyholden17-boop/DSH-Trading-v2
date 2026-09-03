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
const M_TRADER = Deno.env.get("FLUX_DESK_TRADER_MODEL") || "claude-haiku-4-5-20251001";
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

/* ------------------------------------------------- memory and scoreboard */
// Every agent is shown its own playbook and its own scored record before it
// files. "Learning" here means the agent revises a text strategy in light of
// results it can be held to -- it is NOT weight training, and nothing in this
// codebase should imply that it is.
async function agentBrief(agent: string): Promise<any> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/desk_agent_brief`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ p_agent: agent }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function briefBlock(b: any): string {
  if (!b) return "";
  const pb = b.playbook || {};
  const rec: any[] = Array.isArray(b.record) ? b.record : [];
  const recent: any[] = Array.isArray(b.recent) ? b.recent : [];
  const lines = rec.map((r: any) =>
    `  ${r.horizon}: ${r.hits ?? 0}/${r.resolved ?? 0} correct` +
    (r.hit_rate != null ? ` (${r.hit_rate}%)` : "") +
    (r.avg_score != null ? `, avg credit ${r.avg_score}` : "")).join("\n");
  const last = recent.slice(0, 8).map((r: any) =>
    `  ${r.ticker} ${r.direction} ${r.horizon} @${r.confidence} -> ${r.correct ? "HIT" : "MISS"} (${r.realized_pct}%)`).join("\n");
  return `
YOUR OWN PLAYBOOK (v${pb.version ?? 1}${pb.method_name ? `, "${pb.method_name}"` : ""}):
${pb.playbook || "(none yet -- write one)"}

YOUR SCORED RECORD:
${lines || "  no resolved calls yet"}

YOUR LAST RESOLVED CALLS:
${last || "  none yet"}

Use your record honestly. If a horizon is going badly, change the approach or stand aside more often; do not repeat a method that is not working just because it is yours.`;
}

const HORIZON_MS: Record<string, number> = {
  intraday: 6 * 3600 * 1000,
  days: 3 * 86400 * 1000,
  weeks: 14 * 86400 * 1000,
};
function resolveAt(h: string): string {
  return new Date(Date.now() + (HORIZON_MS[h] ?? HORIZON_MS.days)).toISOString();
}
function normHorizon(h: any): string {
  const v = String(h || "days").toLowerCase();
  return v === "intraday" || v === "weeks" ? v : "days";
}
function normDirection(d: any): string {
  const v = String(d || "flat").toLowerCase();
  if (v === "up" || v === "long" || v === "buy") return "up";
  if (v === "down" || v === "short" || v === "sell" || v === "avoid") return "down";
  return "flat";
}

// An agent may hand back a revised playbook. Store it as a new version so the
// evolution of a strategy stays inspectable.
async function savePlaybook(agent: string, tier: string, revision: any) {
  if (!revision) return;
  const text = String(revision.playbook || "").trim();
  if (text.length < 40) return;                 // ignore empty or throwaway edits
  const cur = await sel(`desk_playbooks?agent=eq.${agent}&select=version,playbook`);
  const prev = cur[0];
  if (prev && String(prev.playbook || "").trim() === text) return;   // unchanged
  const body = {
    agent, tier,
    method_name: String(revision.method_name || "").slice(0, 80) || null,
    playbook: text.slice(0, 4000),
    version: (prev?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
  if (prev) await patch(`desk_playbooks?agent=eq.${agent}`, body);
  else await ins("desk_playbooks", [body]);
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
// momentum, range position and drawdown, turned into an entry / stop / target
// ladder and a position size. It stands on its own components -- there is no
// director tilt any more, because there is no director.
function dsaCall(f: Feat, _legacy = 0) {
  const parts: Record<string, number> = {};
  parts.momentum = Math.max(-25, Math.min(25, f.chgpct * 4));
  parts.range = (f.rangePos - 0.5) * 40;                              // high in range = trend
  parts.drawdown = f.downFromHigh > 25 ? Math.min(20, (f.downFromHigh - 25) * 0.5) : 0;  // value in the fall
  parts.value = f.pe != null && f.pe > 0
    ? (f.pe < 20 ? 15 : f.pe < 35 ? 5 : f.pe > 60 ? -18 : -5)
    : 0;
  parts.stretch = f.rangePos > 0.9 && (f.pe ?? 0) > 55 ? -15 : 0;      // extended AND expensive
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
    rationale: `DSA composite ${score >= 0 ? "+" : ""}${score} (momentum ${r2(parts.momentum)}, range ${r2(parts.range)}, value ${r2(parts.value)}, drawdown ${r2(parts.drawdown)}) → ${side}.`,
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

  // The JSON shape is specified once, in `ask` below. Do not restate it here --
  // two shape specs in one prompt and the model silently drops half of them.
  const rules = `You are one analyst on a simulated paper-trading research desk. You report to the traders: they read your filings and decide what reaches the executive, so your job is to be right and to be checkable, not to be loud.

Use ONLY the figures given — never invent a number, a headline or an event. Be willing to say neutral; most convictions should sit between 35 and 70. This is educational research on virtual money, never financial advice.`;

  const AGENTS = ["fundamentals", "catalyst", "tape"];
  const briefs: Record<string, any> = {};
  await Promise.all(AGENTS.map(async (a) => { briefs[a] = await agentBrief(a); }));

  const ask =
`Respond with STRICT JSON only, shape:
{"notes":[{"ticker":"NVDA","view":"bullish|bearish|neutral","conviction":62,
  "note":"2-3 sentences a trader can act on","evidence":["..."],"risk":"the one thing that breaks this",
  "prediction":{"direction":"up|down|flat","horizon":"intraday|days|weeks","target":134.0,"stop":109.5,"confidence":62}}],
 "playbook_revision":{"method_name":"short name for your approach","playbook":"your revised strategy, or repeat the current one unchanged"}}

Rules on the prediction:
- It is scored later against the real price. A wrong high-confidence call costs you more than a wrong low-confidence one, so stake conviction honestly.
- "flat" is a real answer and scores as a hit if the name goes nowhere. Use it rather than guessing a direction.
- Pick the horizon you actually mean: intraday (hours), days (about three sessions), weeks (about two weeks).
- target and stop are optional; direction, horizon and confidence are not.`;

  const lens: Record<string, string> = {
    fundamentals: `You are the FUNDAMENTALS analyst. Judge each name on valuation, growth and quality -- is the price paying for something real?\n\nLIVE NUMBERS:\n${numbers}${fundExtra}`,
    catalyst: `You are the CATALYST analyst. Judge each name on what is actually happening right now -- company news, sector news, and policy announcements that move it. If a name has no matched headline, say so and mark it flat rather than inventing a story.\n\nHEADLINES:\n${newsBlock}\n\nPRICE CONTEXT:\n${numbers}`,
    tape: `You are the TAPE analyst. Judge each name on price action alone -- trend, momentum, where it sits in its range, whether it is extended or basing, and what the technical rating says.\n\nTAPE:\n${tapeBlock}`,
  };

  const prompts: Record<string, string> = {};
  for (const a of AGENTS) {
    prompts[a] = `${rules}\n\n${lens[a]}\n${briefBlock(briefs[a])}\n\n${ask}`;
  }

  const results = await Promise.all(Object.keys(prompts).map(async (agent) => {
    const r = await askJSON(M_ANALYST, prompts[agent], 3000);
    return { agent, r };
  }));

  const rows: any[] = [];
  const preds: any[] = [];
  const featBy: Record<string, Feat> = {}; for (const f of feats) featBy[f.t] = f;

  for (const { agent, r } of results) {
    const list: any[] = (r.data && r.data.notes) || [];
    const method = (r.data && r.data.playbook_revision && r.data.playbook_revision.method_name) || null;
    for (const n of list) {
      const tk = String(n.ticker || "").toUpperCase();
      if (!tk || !syms.includes(tk)) continue;
      const pr = n.prediction || {};
      rows.push({
        round_id: round.id, stage: "analyst", agent, ticker: tk,
        payload: {
          view: String(n.view || "neutral").toLowerCase(),
          conviction: Math.max(0, Math.min(100, Math.round(nz(n.conviction, 50)))),
          note: String(n.note || "").slice(0, 1200),
          evidence: Array.isArray(n.evidence) ? n.evidence.slice(0, 4).map((e: any) => String(e).slice(0, 240)) : [],
          risk: String(n.risk || "").slice(0, 400),
          prediction: {
            direction: normDirection(pr.direction),
            horizon: normHorizon(pr.horizon),
            confidence: Math.max(0, Math.min(100, Math.round(nz(pr.confidence, nz(n.conviction, 50))))),
            target: pr.target != null ? r2(nz(pr.target)) : null,
            stop: pr.stop != null ? r2(nz(pr.stop)) : null,
          },
        },
      });
      // the same call, in scoreable form
      const f = featBy[tk];
      if (f && f.last > 0) {
        const h = normHorizon(pr.horizon);
        preds.push({
          round_id: round.id, tier: "analyst", agent, ticker: tk,
          horizon: h, resolve_at: resolveAt(h),
          direction: normDirection(pr.direction),
          price_at_call: r2(f.last),
          target: pr.target != null ? r2(nz(pr.target)) : null,
          stop: pr.stop != null ? r2(nz(pr.stop)) : null,
          confidence: Math.max(0, Math.min(100, Math.round(nz(pr.confidence, nz(n.conviction, 50))))),
          method, rationale: String(n.note || "").slice(0, 600),
        });
      }
    }
    if (!r.ok) {
      rows.push({ round_id: round.id, stage: "analyst", agent, ticker: null, payload: { error: r.error } });
    }
    // let the analyst revise its own approach
    if (r.ok) await savePlaybook(agent, "analyst", r.data && r.data.playbook_revision);
  }
  if (rows.length) await ins("desk_notes", rows);
  if (preds.length) await ins("desk_predictions", preds);
  // carry the round's context forward so later stages don't refetch
  await patch(`desk_rounds?id=eq.${round.id}`, {
    meta: { ...(round.meta || {}), news, tv, obb_count: Object.keys(obb).length },
  });
  return { ok: results.some((x) => x.r.ok), stage: "analysts", notes: rows.length, predictions: preds.length,
    agents: results.map((x) => ({ a: x.agent, ok: x.r.ok, err: x.r.error })) };
}

// The traders are the analysts' boss. They read every analyst filing AND each
// analyst's scored record, run Kronos (the desk's primary algorithm) and the DSA
// composite as inputs, apply their own playbook, then decide what is worth the
// executive's time. Selection is the job: a short list is a good list.
async function stageTraders(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const featBy: Record<string, Feat> = {}; for (const f of feats) featBy[f.t] = f;
  const syms = feats.map((f) => f.t);

  const notes = await sel(`desk_notes?round_id=eq.${round.id}&stage=eq.analyst&select=agent,ticker,payload`);
  const byTicker: Record<string, any[]> = {};
  for (const n of notes) { if (!n.ticker) continue; (byTicker[n.ticker] ||= []).push(n); }

  // how the analysts have actually been doing, so a trader can weight them
  const record = await sel("desk_agent_record?tier=eq.analyst&select=agent,horizon,resolved,hits,hit_rate,avg_score");
  const recBy: Record<string, string[]> = {};
  for (const r of record) {
    (recBy[r.agent] ||= []).push(
      `${r.horizon} ${r.hits ?? 0}/${r.resolved ?? 0}${r.hit_rate != null ? ` (${r.hit_rate}%)` : ""}`);
  }
  const recordBlock = Object.keys(recBy).length
    ? Object.keys(recBy).map((a) => `  ${a}: ${recBy[a].join(", ")}`).join("\n")
    : "  no resolved analyst calls yet -- weight them equally for now";

  // real Kronos forecasts when the Python bridge has published any
  let fc: Record<string, any> = {};
  try {
    const list = await sel(`forecasts?ticker=in.(${syms.join(",")})&select=ticker,pred_close,pred_return,confidence,model,updated_at`);
    for (const f of list) fc[f.ticker] = f;
  } catch { /* table may not exist yet */ }

  // the two algorithmic inputs, computed before the traders reason over them
  const algo: Record<string, any> = {};
  for (const f of feats) {
    algo[f.t] = { kronos: kronosCall(f, fc[f.t]), dsa: dsaCall(f, 0) };
  }

  const desk = feats.map((f) => {
    const list = byTicker[f.t] || [];
    const lines = list.map((n) => {
      const pr = n.payload.prediction || {};
      return `  - ${n.agent}: ${n.payload.view} (${n.payload.conviction}) calls ${pr.direction ?? "?"} over ${pr.horizon ?? "?"} at confidence ${pr.confidence ?? "?"} — ${n.payload.note}${n.payload.risk ? ` RISK: ${n.payload.risk}` : ""}`;
    }).join("\n");
    const a = algo[f.t];
    return `${f.t} (${f.name}) — $${r2(f.last)}, ${f.chgpct >= 0 ? "+" : ""}${r2(f.chgpct)}% today, ${Math.round(f.rangePos * 100)}% of range
${lines || "  - (no analyst covered this name)"}
  KRONOS: ${a.kronos.action} (${a.kronos.model}${a.kronos.real ? ", real forecast" : ", approximation"}) ${a.kronos.pred_return_pct >= 0 ? "+" : ""}${a.kronos.pred_return_pct}% over 5 candles, confidence ${a.kronos.confidence}
  DSA:    ${a.dsa.side} composite ${a.dsa.score >= 0 ? "+" : ""}${a.dsa.score} (${a.dsa.rationale})`;
  }).join("\n\n");

  const TRADERS = ["kronos", "dsa"];
  const briefs: Record<string, any> = {};
  await Promise.all(TRADERS.map(async (t) => { briefs[t] = await agentBrief(t); }));

  const shared =
`You are a TRADER on a simulated paper-trading desk, and the three analysts report to you. They research; you decide what is worth the executive's time.

Your job is selection, not repetition:
- Read every filing and weight each analyst by the record below, not by how confident they sound.
- Kronos is the desk's primary algorithm and DSA is a transparent composite. They are inputs you may overrule -- say so when you do.
- Pass forward only what you would actually stake size on. Dropping a name is a real answer and a short list is a good list.
- A strong negative read is a call, not a pass: hand it up as a short/avoid rather than dropping it.
- You also file your own scored prediction on each name you pass up.

ANALYST TRACK RECORDS (hits/resolved):
${recordBlock}

THE DESK:
${desk}`;

  const ask =
`Respond with STRICT JSON only, shape:
{"selections":[{"ticker":"NVDA","pass_up":true,"stance":"long|short|avoid","score":45,
  "summary":"2-3 sentences the executive can rule on","leaned_on":["which analysts or algorithms you weighted, and why"],
  "overruled":"what you disagreed with, or 'nothing'","watch":"the one thing that would change this",
  "prediction":{"direction":"up|down|flat","horizon":"intraday|days|weeks","target":134.0,"stop":109.5,"confidence":62}}],
 "playbook_revision":{"method_name":"short name for your approach","playbook":"your revised strategy, or repeat the current one unchanged"}}

Set pass_up false for names you are dropping, and still say why in summary.
Your prediction is scored against the real price later, so stake confidence honestly.`;

  const results = await Promise.all(TRADERS.map(async (agent) => {
    const r = await askJSON(M_TRADER, `${shared}\n${briefBlock(briefs[agent])}\n\n${ask}`, 4000);
    return { agent, r };
  }));

  const rows: any[] = [];
  const preds: any[] = [];
  const passed = new Set<string>();

  for (const { agent, r } of results) {
    const list: any[] = (r.data && r.data.selections) || [];
    const method = (r.data && r.data.playbook_revision && r.data.playbook_revision.method_name) || null;
    for (const x of list) {
      const tk = String(x.ticker || "").toUpperCase();
      const f = featBy[tk];
      if (!f) continue;
      const up = x.pass_up !== false;
      if (up) passed.add(tk);
      const pr = x.prediction || {};
      rows.push({
        round_id: round.id, stage: "trader", agent, ticker: tk,
        payload: {
          pass_up: up,
          stance: String(x.stance || "flat").toLowerCase(),
          score: Math.max(-100, Math.min(100, Math.round(nz(x.score)))),
          summary: String(x.summary || "").slice(0, 1200),
          leaned_on: Array.isArray(x.leaned_on) ? x.leaned_on.slice(0, 3).map((v: any) => String(v).slice(0, 240)) : [],
          overruled: String(x.overruled || "nothing").slice(0, 400),
          watch: String(x.watch || "").slice(0, 300),
          method,
          algo: algo[tk],
          prediction: {
            direction: normDirection(pr.direction),
            horizon: normHorizon(pr.horizon),
            confidence: Math.max(0, Math.min(100, Math.round(nz(pr.confidence, 50)))),
            target: pr.target != null ? r2(nz(pr.target)) : null,
            stop: pr.stop != null ? r2(nz(pr.stop)) : null,
          },
        },
      });
      if (up && f.last > 0) {
        const h = normHorizon(pr.horizon);
        preds.push({
          round_id: round.id, tier: "trader", agent, ticker: tk,
          horizon: h, resolve_at: resolveAt(h),
          direction: normDirection(pr.direction),
          price_at_call: r2(f.last),
          target: pr.target != null ? r2(nz(pr.target)) : null,
          stop: pr.stop != null ? r2(nz(pr.stop)) : null,
          confidence: Math.max(0, Math.min(100, Math.round(nz(pr.confidence, 50)))),
          method, rationale: String(x.summary || "").slice(0, 600),
        });
      }
    }
    if (!r.ok) {
      rows.push({ round_id: round.id, stage: "trader", agent, ticker: null, payload: { error: r.error } });
    }
    if (r.ok) await savePlaybook(agent, "trader", r.data && r.data.playbook_revision);
  }

  if (rows.length) await ins("desk_notes", rows);
  if (preds.length) await ins("desk_predictions", preds);
  await patch(`desk_rounds?id=eq.${round.id}`, {
    meta: {
      ...(round.meta || {}),
      passed_up: Array.from(passed),
      traders_ok: results.some((x) => x.r.ok),
      traders_err: results.map((x) => x.r.error).filter(Boolean).join(" | ") || null,
    },
  });
  return {
    ok: results.some((x) => x.r.ok), stage: "traders",
    selections: rows.length, predictions: preds.length, passed_up: passed.size,
    kronos_real: Object.keys(fc).length,
    agents: results.map((x) => ({ a: x.agent, ok: x.r.ok, err: x.r.error })),
  };
}

async function stageExecutive(round: any) {
  const feats: Feat[] = (round.meta && round.meta.feats) || [];
  const featBy: Record<string, Feat> = {}; for (const f of feats) featBy[f.t] = f;
  const notes = await sel(`desk_notes?round_id=eq.${round.id}&select=stage,agent,ticker,payload`);
  // only what a trader actually passed up reaches this desk
  const tBy: Record<string, Record<string, any>> = {};
  for (const n of notes) {
    if (!n.ticker || n.stage !== "trader") continue;
    (tBy[n.ticker] ||= {})[n.agent] = n.payload;
  }
  const live = Object.keys(tBy).filter((t) =>
    Object.values(tBy[t]).some((p: any) => p && p.pass_up));
  if (!live.length) {
    await patch(`desk_rounds?id=eq.${round.id}`, { stage: "done", status: "done", finished_at: new Date().toISOString() });
    return { ok: true, stage: "executive", decisions: 0, note: "the traders passed nothing up this round" };
  }

  // what the desk has already green-lit today, so the executive can manage concentration
  const recent = await sel("desk_decisions?verdict=neq.rejected&select=ticker,side,created_at&order=created_at.desc&limit=25");
  const bookLine = recent.length
    ? recent.slice(0, 12).map((d: any) => `${d.ticker} ${d.side}`).join(", ")
    : "nothing open";

  const body = live.map((t) => {
    const f = featBy[t], picks = tBy[t] || {};
    const lines = Object.keys(picks).map((agent) => {
      const p = picks[agent];
      const a = p.algo || {};
      const pr = p.prediction || {};
      return `  ${agent.toUpperCase()} (${p.pass_up ? "passed up" : "dropped"}): ${p.stance} score ${p.score} — ${p.summary}
    calls ${pr.direction} over ${pr.horizon} at confidence ${pr.confidence}${pr.target != null ? `, target ${pr.target}` : ""}${pr.stop != null ? `, stop ${pr.stop}` : ""}
    leaned on: ${(p.leaned_on || []).join("; ") || "—"}
    overruled: ${p.overruled || "nothing"}    watch: ${p.watch || "—"}${a.kronos ? `
    (Kronos said ${a.kronos.action} ${a.kronos.pred_return_pct >= 0 ? "+" : ""}${a.kronos.pred_return_pct}% conf ${a.kronos.confidence}; DSA composite ${a.dsa?.score})` : ""}`;
    }).join("\n");
    return `${t} (${f?.name || t}) — $${r2(f?.last || 0)}, ${(f?.chgpct ?? 0) >= 0 ? "+" : ""}${r2(f?.chgpct || 0)}% today
${lines}`;
  }).join("\n\n");

  const prompt =
`You are the EXECUTIVE of a simulated paper-trading desk. Nothing trades without your green light. Two traders — KRONOS (built on the desk's candle-forecast algorithm) and DSA (a transparent composite) — manage the three analysts and have already filtered the round. What reaches you is what they were willing to stake size on, with the reasoning and the analysts they leaned on.

Rule the desk, don't rubber-stamp it:
- Where both traders passed the same name up and agree on direction, you can approve at a normal size.
- Where they disagree, or where only one passed it up, either pick a side and say why, or cut the size, or reject. Say which.
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
    const f = featBy[t];
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
      director_score: nz(Object.values(tBy[t] || {}).map((p: any) => nz(p.score))[0]),
      teaser: false,
      kronos: (tBy[t] || {}).kronos || null,
      dsa: (tBy[t] || {}).dsa || null,
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
    // A stage whose model calls all failed must NOT advance the round. Marking a
    // starved round "done" is how an out-of-credit desk went on looking alive
    // while filing nothing -- fail loudly instead.
    const halt = async (why: string) => {
      await patch(`desk_rounds?id=eq.${round.id}`, {
        status: "failed", stage: round.stage, claimed_at: null,
        error: why.slice(0, 500), finished_at: new Date().toISOString(),
      });
    };

    if (round.stage === "analysts") {
      out = await stageAnalysts(round);
      if (!out.ok) { await halt(`analysts: ${(out.agents || []).map((a: any) => a.err).filter(Boolean).join(" | ") || "no filings"}`); return { ...out, seq: round.seq, round: round.id, halted: true }; }
      await patch(`desk_rounds?id=eq.${round.id}`, { stage: "traders", claimed_at: null });
    } else if (round.stage === "traders") {
      out = await stageTraders(round);
      if (!out.ok) { await halt(`traders: ${(out.agents || []).map((a: any) => a.err).filter(Boolean).join(" | ") || "no selections"}`); return { ...out, seq: round.seq, round: round.id, halted: true }; }
      await patch(`desk_rounds?id=eq.${round.id}`, { stage: "executive", claimed_at: null });
    } else if (round.stage === "executive") {
      out = await stageExecutive(round);
      if (out.err) { await halt(`executive: ${out.err}`); return { ...out, seq: round.seq, round: round.id, halted: true }; }
    }
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
