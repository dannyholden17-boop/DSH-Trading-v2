// Flux — price alert checker (scheduled)
// Reads active price_alerts, pulls live quotes, and emails the user when a
// ticker crosses their level; then deactivates that alert. Invoked by pg_cron
// during market hours (see supabase/EMAIL_SETUP.md).
//
// Guard: requires Authorization: Bearer <service_role_key>.
// Sends only if RESEND_API_KEY is set.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("FLUX_EMAIL_FROM") || "Flux <noreply@dsh-trading.com>";
const SITE = Deno.env.get("FLUX_SITE_URL") || "https://dsh-trading.com";

const H = { apikey: SERVICE_KEY, authorization: "Bearer " + SERVICE_KEY, "content-type": "application/json" };

async function rest(path: string) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: H });
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}
async function patch(path: string, body: unknown) {
  await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body),
  });
}
async function quotesFor(tickers: string[]): Promise<Record<string, any>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/quotes?symbols=" + encodeURIComponent(tickers.join(",")), { headers: H });
    const j = await r.json().catch(() => null);
    return (j && j.quotes) || {};
  } catch { return {}; }
}
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) return { skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + RESEND_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.id } : { ok: false, error: j };
}
function money(x: any) { const n = +x; return isFinite(n) ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }

function alertHTML(ticker: string, op: string, level: number, price: number) {
  return `<div style="background:#020617;padding:26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e6edf6;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="font-family:monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#00f2ff;">Flux · Price Alert</div>
    <h1 style="font-size:22px;margin:14px 0 6px;color:#fff;">🔔 ${ticker} crossed ${op} ${money(level)}</h1>
    <p style="font-size:15px;color:#c7d3e2;margin:6px 0 20px;">It's now trading at <b style="color:#fff;">${money(price)}</b>.</p>
    <a href="${SITE}/terminal.html?symbol=${ticker}" style="display:inline-block;background:#00f2ff;color:#022530;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px;">Open ${ticker} →</a>
    <p style="font-size:11px;color:#5f7189;line-height:1.5;margin-top:26px;">Simulated prices · not investment advice. Manage alerts in <a href="${SITE}/account.html" style="color:#7d90a8;">your account</a>.</p>
  </div></div>`;
}

serve(async (req) => {
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + SERVICE_KEY) return json({ error: "forbidden" }, 403);

  try {
    const alerts = await rest("price_alerts?active=eq.true&select=id,user_id,ticker,op,price") as any[];
    if (!alerts.length) return json({ ok: true, checked: 0, triggered: 0 });

    const tickers = [...new Set(alerts.map((a) => (a.ticker || "").toUpperCase()))];
    const q = await quotesFor(tickers);

    // only users who still want price alerts, with an email on file
    const uids = [...new Set(alerts.map((a) => a.user_id))];
    const prefs = await rest("user_prefs?price_alerts=eq.true&select=user_id,email&user_id=in.(" + uids.join(",") + ")") as any[];
    const emailByUser: Record<string, string> = {};
    prefs.forEach((p) => { if (p.email) emailByUser[p.user_id] = p.email; });

    let triggered = 0, skipped = 0;
    for (const a of alerts) {
      const t = (a.ticker || "").toUpperCase();
      const last = q[t] && q[t].last;
      if (last == null) continue;
      const hit = a.op === "above" ? (last >= +a.price) : (last <= +a.price);
      if (!hit) continue;
      const email = emailByUser[a.user_id];
      if (email) {
        const res = await sendEmail(email, `🔔 ${t} is ${a.op} ${money(a.price)}`, alertHTML(t, a.op, +a.price, last));
        if ((res as any).skipped) skipped++; else if ((res as any).ok) triggered++;
      }
      // deactivate whether or not we could email, so it doesn't refire every run
      await patch("price_alerts?id=eq." + a.id, { active: false, triggered_at: new Date().toISOString() });
    }
    return json({ ok: true, checked: alerts.length, triggered, skipped, resend_configured: !!RESEND_KEY });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
