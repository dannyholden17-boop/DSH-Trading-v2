// ============================================================
// FLUX — MCP server
//
// Makes Flux a connector Claude can attach to, so the desk's research
// is reachable from a Claude session. Robinhood is a SEPARATE connector
// on the same Claude; see docs/MCP-SERVER.md for why that split is the
// architecture rather than a workaround.
//
// Hard rule: nothing in this file executes a trade, reads a brokerage
// balance, or holds a brokerage credential. `stage_order` returns order
// PARAMETERS for the broker's own review step to consume; the human
// confirms there. Flux has no path to a brokerage and must not grow one.
//
// Transport: JSON-RPC 2.0 over HTTP POST (MCP Streamable HTTP).
// Deploy with verify_jwt = false — auth is the bearer token below, since
// Claude presents its own credential, not a Supabase JWT.
//
// Secrets: (auto) SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "flux-desk", version: "0.1.0" };

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-allow-methods": "POST, OPTIONS",
};

const DISCLOSURE =
  "Simulated research on a paper desk. Educational only, not investment advice. " +
  "Trading involves risk of loss including principal. Flux is not a broker-dealer " +
  "and cannot place orders.";

/* ------------------------------------------------------------------ data */

const H = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
};

async function sel(path: string): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? j : [];
}

async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: H, body: JSON.stringify(args),
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

/* ------------------------------------------------------------------ auth */

type Caller = { member: string | null; tier: "public" | "member" | "pro" };

// A per-member Flux key, resolved to a tier. Production should be OAuth 2.1
// with PKCE so nothing is pasted into a config file -- see the design doc.
async function callerFor(req: Request): Promise<Caller> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { member: null, tier: "public" };
  try {
    const rows = await sel(
      `flux_api_keys?token=eq.${encodeURIComponent(token)}&revoked=is.false&select=user_id,tier`);
    const k = rows[0];
    if (!k) return { member: null, tier: "public" };
    return { member: k.user_id, tier: k.tier === "pro" ? "pro" : "member" };
  } catch {
    return { member: null, tier: "public" };
  }
}

function needs(caller: Caller, tier: "member" | "pro"): string | null {
  if (tier === "pro" && caller.tier !== "pro") {
    return "This tool needs a Flux Pro connection. The desk's rulings and the " +
           "analysts' filings are the paid product; desk_status and " +
           "analyst_scoreboard are open to everyone.";
  }
  if (tier === "member" && caller.tier === "public") {
    return "This tool needs a signed-in Flux member connection.";
  }
  return null;
}

/* ----------------------------------------------------------------- tools */

const TOOLS = [
  {
    name: "desk_status",
    description:
      "What the Flux research desk is doing right now: the current round, which " +
      "desk is working, and whether the loop is healthy. Call this first -- if " +
      "healthy is false the desk is stalled and any ruling you read is stale.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "analyst_scoreboard",
    description:
      "How each agent on the desk has actually performed: hit rate by horizon " +
      "over its own dated predictions. Use this to weight the desk's opinions " +
      "instead of taking them at face value.",
    inputSchema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["analyst", "trader"], description: "Filter to one tier." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "agent_playbook",
    description:
      "An agent's current named method, in its own words, and which version it " +
      "is on. The agents revise these themselves in light of their record.",
    inputSchema: {
      type: "object",
      properties: { agent: { type: "string", description: "e.g. fundamentals, tape, kronos, dsa, executive" } },
      required: ["agent"],
      additionalProperties: false,
    },
  },
  {
    name: "desk_rulings",
    description:
      "The Executive's recent rulings: verdict (approved/reduced/rejected), side, " +
      "entry, stop, target, size and the reason it ruled that way -- including the " +
      "refusals, which are most of them. Pro connection required.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 10." },
        verdict: { type: "string", enum: ["approved", "reduced", "rejected"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "desk_view_on",
    description:
      "Everything the desk has done on one ticker: the analysts' filings, what " +
      "the traders passed up or dropped, the Executive's rulings, and the open " +
      "predictions against it. Pro connection required.",
    inputSchema: {
      type: "object",
      properties: { ticker: { type: "string", description: "US equity symbol." } },
      required: ["ticker"],
      additionalProperties: false,
    },
  },
  {
    name: "stage_order",
    description:
      "Turn a Flux ruling into concrete order parameters, shaped to hand to a " +
      "BROKER's own order-review tool. This does NOT place, cancel or modify any " +
      "order and Flux has no connection to any brokerage -- the human confirms at " +
      "the broker. Pro connection required.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        account_value: { type: "number", description: "Account value the size percentage applies to." },
        max_size_pct: { type: "number", description: "Cap on the desk's suggested size, in percent." },
      },
      required: ["ticker", "account_value"],
      additionalProperties: false,
    },
  },
];

/* --------------------------------------------------------------- handlers */

async function callTool(name: string, args: any, caller: Caller): Promise<any> {
  args = args || {};

  if (name === "desk_status") {
    const f = await rpc("desk_floor");
    const floor = Array.isArray(f) ? f[0] : f;
    if (!floor || !floor.round) return { error: "The desk record is unreachable." };
    const r = floor.round;
    return {
      round: r.seq,
      stage: r.stage,
      status: r.status,
      healthy: floor.healthy !== false,
      names_this_round: r.tickers,
      started_at: r.started_at,
      finished_at: r.finished_at,
      rounds_today: floor.rounds_today,
      rounds_failed_today: floor.rounds_failed_today,
      predictions_total: floor.predictions_total,
      warning: floor.healthy === false
        ? "The desk is stalled: " + (r.error || "the last round did not complete") +
          ". Treat any ruling below as stale."
        : undefined,
      disclosure: DISCLOSURE,
    };
  }

  if (name === "analyst_scoreboard") {
    const q = args.tier ? `&tier=eq.${encodeURIComponent(args.tier)}` : "";
    const rows = await sel(
      `desk_agent_record?select=agent,tier,horizon,calls,resolved,hits,hit_rate,avg_move_pct,avg_score,avg_confidence,last_call_at&order=tier,agent${q}`);
    return {
      scoreboard: rows,
      note: rows.length
        ? "hit_rate is over resolved predictions only. A 'flat' call counts as a " +
          "hit when the name went nowhere, so a high rate is not automatically a " +
          "directional edge."
        : "No predictions have resolved yet.",
      disclosure: DISCLOSURE,
    };
  }

  if (name === "agent_playbook") {
    const agent = String(args.agent || "").toLowerCase().replace(/[^a-z_]/g, "");
    if (!agent) return { error: "Name an agent." };
    const rows = await sel(
      `desk_playbooks?agent=eq.${agent}&select=agent,tier,method_name,playbook,version,updated_at`);
    if (!rows.length) return { error: `No agent called "${agent}" on this desk.` };
    return {
      ...rows[0],
      note: "The agent revises this itself in light of its scored record. It is a " +
            "text strategy the model rewrites -- not a trained model.",
    };
  }

  if (name === "desk_rulings") {
    const gate = needs(caller, "pro"); if (gate) return { error: gate };
    const lim = Math.max(1, Math.min(50, Number(args.limit) || 10));
    const vq = args.verdict ? `&verdict=eq.${encodeURIComponent(args.verdict)}` : "";
    const rows = await sel(
      `desk_decisions?select=ticker,name,verdict,side,price,entry,stop,target,size_pct,conviction,horizon,headline,reason,risk_flags,created_at&order=created_at.desc&limit=${lim}${vq}`);
    return { rulings: rows, count: rows.length, disclosure: DISCLOSURE };
  }

  if (name === "desk_view_on") {
    const gate = needs(caller, "pro"); if (gate) return { error: gate };
    const t = String(args.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "");
    if (!t) return { error: "Name a ticker." };
    const [rulings, notes, preds] = await Promise.all([
      sel(`desk_decisions?ticker=eq.${t}&select=verdict,side,entry,stop,target,size_pct,conviction,horizon,headline,reason,created_at&order=created_at.desc&limit=8`),
      sel(`desk_notes?ticker=eq.${t}&select=stage,agent,payload,created_at&order=created_at.desc&limit=24`),
      sel(`desk_predictions?ticker=eq.${t}&select=tier,agent,horizon,direction,confidence,method,price_at_call,realized_pct,correct,made_at,resolved_at&order=made_at.desc&limit=20`),
    ]);
    return {
      ticker: t,
      rulings,
      analyst_filings: notes.filter((n: any) => n.stage === "analyst"),
      trader_selections: notes.filter((n: any) => n.stage === "trader"),
      predictions: preds,
      disclosure: DISCLOSURE,
    };
  }

  if (name === "stage_order") {
    const gate = needs(caller, "pro"); if (gate) return { error: gate };
    const t = String(args.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "");
    const acct = Number(args.account_value);
    if (!t) return { error: "Name a ticker." };
    if (!isFinite(acct) || acct <= 0) return { error: "Give the account value the size applies to." };

    const rows = await sel(
      `desk_decisions?ticker=eq.${t}&verdict=neq.rejected&select=verdict,side,entry,stop,target,size_pct,conviction,horizon,headline,reason,created_at&order=created_at.desc&limit=1`);
    const d = rows[0];
    if (!d) {
      return {
        error: `The desk has no live approved or reduced call on ${t}. It may have ` +
               `refused it -- check desk_view_on for the reason rather than staging ` +
               `an order the desk did not make.`,
      };
    }
    const cap = isFinite(Number(args.max_size_pct)) ? Number(args.max_size_pct) : 100;
    const sizePct = Math.max(0, Math.min(Number(d.size_pct) || 0, cap));
    const notional = acct * (sizePct / 100);
    const limit = Number(d.entry) || null;
    const qty = limit && limit > 0 ? Math.floor(notional / limit) : null;

    return {
      // shaped for a broker's own order-review tool
      order_parameters: {
        symbol: t,
        side: d.side === "long" ? "buy" : "sell",
        type: limit ? "limit" : "market",
        limit_price: limit != null ? String(limit) : undefined,
        quantity: qty != null ? String(qty) : undefined,
        time_in_force: "gfd",
      },
      derived_from: {
        verdict: d.verdict, desk_size_pct: d.size_pct, applied_size_pct: sizePct,
        notional: Math.round(notional * 100) / 100,
        stop: d.stop, target: d.target, horizon: d.horizon,
        conviction: d.conviction, headline: d.headline, reason: d.reason,
        ruled_at: d.created_at,
      },
      requires_human_confirmation: true,
      next_step:
        "These are parameters only. Pass them to the brokerage connector's own " +
        "order-review tool, show the user the review output including every alert, " +
        "and place nothing until they explicitly confirm. Flux has no connection " +
        "to any brokerage and cannot place this order.",
      disclosure: DISCLOSURE,
    };
  }

  return { error: `No tool called "${name}".` };
}

/* ------------------------------------------------------------- transport */

function result(id: unknown, payload: unknown) {
  return { jsonrpc: "2.0", id, result: payload };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handle(msg: any, caller: Caller): Promise<any | null> {
  const { id, method, params } = msg || {};

  if (method === "initialize") {
    return result(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions:
        "Flux is a research desk: three analysts report to two traders, who decide " +
        "what reaches an executive who can refuse. Call desk_status first and check " +
        "`healthy`. Weight anything the desk says using analyst_scoreboard rather " +
        "than taking conviction at face value. Flux cannot place orders -- for " +
        "anything involving a real account, use the brokerage's own connector and " +
        "let the user confirm there.",
    });
  }

  // notifications carry no id and get no response
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;

  if (method === "ping") return result(id, {});

  if (method === "tools/list") return result(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = params?.name;
    if (!name) return rpcError(id, -32602, "tools/call needs a tool name.");
    try {
      const out = await callTool(String(name), params?.arguments, caller);
      return result(id, {
        content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
        isError: !!(out && out.error),
      });
    } catch (e) {
      return result(id, {
        content: [{ type: "text", text: `Flux failed to answer: ${String(e).slice(0, 300)}` }],
        isError: true,
      });
    }
  }

  if (method === "resources/list") return result(id, { resources: [] });
  if (method === "prompts/list") return result(id, { prompts: [] });

  return rpcError(id, -32601, `Unsupported method: ${method}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "MCP speaks JSON-RPC over POST." }), {
      status: 405, headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const caller = await callerFor(req);
  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "Malformed JSON.")), {
      status: 400, headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // a client may batch
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, caller)))).filter((x) => x !== null);
    return new Response(out.length ? JSON.stringify(out) : "", {
      status: out.length ? 200 : 202, headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const out = await handle(body, caller);
  if (out === null) return new Response("", { status: 202, headers: CORS });
  return new Response(JSON.stringify(out), {
    headers: { ...CORS, "content-type": "application/json" },
  });
});
