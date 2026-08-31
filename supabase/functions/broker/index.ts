// Flux — brokerage bridge.
//
// A stateless proxy between the Flux terminal and a user's own brokerage.
// The browser cannot call a brokerage REST API directly (no CORS, and the
// secret would be pinned to an origin anyway), so the request comes through
// here instead.
//
// Design rules, deliberately:
//   * credentials are NEVER stored, logged or cached. They arrive on the
//     request, are used for exactly one upstream call, and are dropped.
//   * every response is normalised into the Flux shape the terminal already
//     paints, so "Brokerage" mode shows the broker's own numbers — equity,
//     buying power, market value, unrealised P/L — and never paper numbers.
//   * live (real-money) endpoints are opt-in per request: paper is default.
//
// Providers
//   alpaca     — implemented (paper + live). Keys: API key id + secret.
//   snaptrade  — not implemented; see BROKERAGE.md. It needs partner
//                (clientId/consumerKey) credentials and a signed handshake,
//                so it is a server-configured integration, not a paste-your-key
//                one. Returns 501 with that explanation rather than pretending.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const ALPACA_PAPER = "https://paper-api.alpaca.markets";
const ALPACA_LIVE = "https://api.alpaca.markets";

type Creds = { key: string; secret: string; paper: boolean };

async function alpaca(path: string, c: Creds, init: RequestInit = {}) {
  const base = c.paper ? ALPACA_PAPER : ALPACA_LIVE;
  const res = await fetch(base + path, {
    ...init,
    headers: {
      "APCA-API-KEY-ID": c.key,
      "APCA-API-SECRET-KEY": c.secret,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    // surface the broker's own message, but never echo the credentials back
    const msg = (body && (body.message || body.error)) || ("HTTP " + res.status);
    throw new Error(String(msg).slice(0, 300));
  }
  return body;
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
};

function acctShape(a: any) {
  const equity = n(a.equity);
  const last = n(a.last_equity) || equity;
  return {
    equity,
    cash: n(a.cash),
    buying_power: n(a.buying_power),
    day_pl: equity - last,
    day_pl_pct: last ? ((equity - last) / last) * 100 : 0,
    currency: a.currency || "USD",
    status: a.status || "",
    account_number: a.account_number ? "••••" + String(a.account_number).slice(-4) : "",
    pattern_day_trader: !!a.pattern_day_trader,
    trading_blocked: !!a.trading_blocked,
  };
}

function posShape(p: any) {
  const qty = n(p.qty);
  const price = n(p.current_price);
  return {
    ticker: p.symbol,
    qty,
    side: qty < 0 ? "short" : "long",
    avg: n(p.avg_entry_price),
    price,
    mkt: n(p.market_value),
    pl: n(p.unrealized_pl),
    plPct: n(p.unrealized_plpc) * 100,
    dayPl: n(p.unrealized_intraday_pl),
  };
}

function ordShape(o: any) {
  return {
    id: o.id,
    ticker: o.symbol,
    side: o.side,
    qty: n(o.qty) || n(o.notional),
    price: n(o.filled_avg_price) || n(o.limit_price) || 0,
    type: o.order_type || o.type || "market",
    status: o.status,
    tif: o.time_in_force,
    ts: o.submitted_at || o.created_at,
    filled: n(o.filled_qty),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const provider = String(b.provider || "alpaca").toLowerCase();
  const action = String(b.action || "account").toLowerCase();

  if (provider === "snaptrade") {
    return json({
      error: "snaptrade_not_configured",
      message:
        "SnapTrade needs partner credentials (clientId + consumerKey) and a signed " +
        "registration handshake, so it has to be configured server-side rather than " +
        "by pasting a key. See BROKERAGE.md.",
    }, 501);
  }
  if (provider !== "alpaca") return json({ error: "unknown provider: " + provider }, 400);

  const creds: Creds = {
    key: String(b.key || "").trim(),
    secret: String(b.secret || "").trim(),
    paper: b.paper !== false,
  };
  if (!creds.key || !creds.secret) return json({ error: "missing credentials" }, 400);

  try {
    if (action === "account" || action === "verify") {
      const a = await alpaca("/v2/account", creds);
      return json({ ok: true, provider, paper: creds.paper, account: acctShape(a) });
    }

    if (action === "positions") {
      const p = await alpaca("/v2/positions", creds);
      return json({ ok: true, positions: (Array.isArray(p) ? p : []).map(posShape) });
    }

    if (action === "orders") {
      const lim = Math.min(100, Math.max(1, parseInt(String(b.limit || 25), 10) || 25));
      const o = await alpaca("/v2/orders?status=all&direction=desc&limit=" + lim, creds);
      return json({ ok: true, orders: (Array.isArray(o) ? o : []).map(ordShape) });
    }

    // everything the terminal needs for one repaint, in a single round trip
    if (action === "snapshot") {
      const [a, p, o] = await Promise.all([
        alpaca("/v2/account", creds),
        alpaca("/v2/positions", creds),
        alpaca("/v2/orders?status=all&direction=desc&limit=25", creds),
      ]);
      return json({
        ok: true, provider, paper: creds.paper,
        account: acctShape(a),
        positions: (Array.isArray(p) ? p : []).map(posShape),
        orders: (Array.isArray(o) ? o : []).map(ordShape),
      });
    }

    if (action === "place") {
      const o = b.order || {};
      const sym = String(o.ticker || o.symbol || "").toUpperCase();
      const qty = Math.abs(parseFloat(String(o.qty || 0)));
      const side = String(o.side || "buy").toLowerCase();
      const type = String(o.type || "market").toLowerCase();
      if (!sym || !qty) return json({ error: "order needs a symbol and a quantity" }, 400);
      if (side !== "buy" && side !== "sell") return json({ error: "side must be buy or sell" }, 400);
      const payload: Record<string, unknown> = {
        symbol: sym, qty: String(qty), side, type,
        time_in_force: String(o.tif || "day").toLowerCase(),
      };
      if (type === "limit" || type === "stop_limit") {
        const lp = parseFloat(String(o.limit_price || o.limit || 0));
        if (!(lp > 0)) return json({ error: "a limit order needs a limit price" }, 400);
        payload.limit_price = String(lp);
      }
      if (type === "stop" || type === "stop_limit") {
        const sp = parseFloat(String(o.stop_price || o.stop || 0));
        if (!(sp > 0)) return json({ error: "a stop order needs a stop price" }, 400);
        payload.stop_price = String(sp);
      }
      const r = await alpaca("/v2/orders", creds, { method: "POST", body: JSON.stringify(payload) });
      return json({ ok: true, order: ordShape(r) });
    }

    if (action === "cancel") {
      const id = String(b.id || "");
      if (!id) return json({ error: "missing order id" }, 400);
      await alpaca("/v2/orders/" + encodeURIComponent(id), creds, { method: "DELETE" });
      return json({ ok: true, cancelled: id });
    }

    return json({ error: "unknown action: " + action }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 502);
  }
});
