// Flux — daily brief emailer (scheduled)
// For every user who opted into "Email me the daily brief", composes a morning
// email from the latest server brief + that user's starred watchlist and sends
// it via Resend. Invoked by pg_cron (see supabase/EMAIL_SETUP.md).
//
// Guard: requires Authorization: Bearer <service_role_key> (cron provides it),
// so it can't be triggered by the public.
// Sends only if RESEND_API_KEY is set; otherwise it reports what it *would* send.

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

function esc(s: string) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function money(x: any) { const n = +x; return isFinite(n) ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }

function watchRows(tickers: string[], q: Record<string, any>) {
  if (!tickers.length) return `<tr><td colspan="3" style="padding:10px 0;color:#8aa;">You haven't starred any stocks yet — star a few on the site and they'll appear here.</td></tr>`;
  return tickers.map((t) => {
    const d = q[t] || {};
    const last = d.last, pc = d.prev_close;
    const chg = (last != null && pc) ? ((last - pc) / pc * 100) : null;
    const col = chg == null ? "#8aa" : (chg >= 0 ? "#34d399" : "#f87171");
    const chgTxt = chg == null ? "—" : ((chg >= 0 ? "+" : "") + chg.toFixed(2) + "%");
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #16243a;font-weight:700;color:#eaf">${esc(t)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #16243a;text-align:right;color:#cfe;font-family:monospace;">${money(last)}</td>
      <td style="padding:8px 0 8px 14px;border-bottom:1px solid #16243a;text-align:right;color:${col};font-family:monospace;">${chgTxt}</td>
    </tr>`;
  }).join("");
}

function emailHTML(name: string, brief: any, tickers: string[], q: Record<string, any>) {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const headline = brief?.headline || "Your market brief";
  const body = esc(brief?.text || "The desk is scanning the tape.").replace(/\n/g, "<br>");
  return `<div style="background:#020617;padding:26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e6edf6;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="font-family:monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#00f2ff;">Flux · Morning Brief</div>
    <div style="color:#7d90a8;font-size:13px;margin-top:4px;">${esc(day)}</div>
    <h1 style="font-size:20px;margin:16px 0 6px;color:#fff;">${esc(headline)}</h1>
    <p style="font-size:14px;line-height:1.6;color:#c7d3e2;margin:8px 0 20px;">${body}</p>
    <div style="font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7d90a8;margin:22px 0 6px;">Your watchlist</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${watchRows(tickers, q)}</table>
    <a href="${SITE}/ai.html" style="display:inline-block;margin-top:22px;background:#00f2ff;color:#022530;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px;">Open Fluxi →</a>
    <p style="font-size:11px;color:#5f7189;line-height:1.5;margin-top:26px;">Simulated · virtual money · not investment advice. You're getting this because you enabled the daily brief in your Flux account. Manage it at <a href="${SITE}/account.html" style="color:#7d90a8;">your account</a>.</p>
  </div></div>`;
}

serve(async (req) => {
  // guard: only the scheduled job (service role) may trigger a send
  const auth = req.headers.get("authorization") || "";
  if (auth !== "Bearer " + SERVICE_KEY) return json({ error: "forbidden" }, 403);

  try {
    const prefs = await rest("user_prefs?daily_brief=eq.true&select=user_id,email");
    const recipients = (prefs as any[]).filter((p) => p.email);
    if (!recipients.length) return json({ ok: true, sent: 0, note: "no opted-in users" });

    const briefRows = await rest("briefs?select=headline,text,under,over,created_at&order=created_at.desc&limit=1");
    const brief = (briefRows as any[])[0] || null;

    // one watchlist read + one quotes call for all tickers
    const watch = await rest("watchlist?select=user_id,ticker");
    const byUser: Record<string, string[]> = {};
    (watch as any[]).forEach((w) => { (byUser[w.user_id] = byUser[w.user_id] || []).push((w.ticker || "").toUpperCase()); });
    const allTickers = [...new Set(Object.values(byUser).flat())];
    const q = await quotesFor(allTickers);

    let sent = 0, skipped = 0;
    const errors: any[] = [];
    for (const p of recipients) {
      const tickers = (byUser[p.user_id] || []).slice(0, 30);
      const html = emailHTML("", brief, tickers, q);
      const subject = "Your Flux morning brief — " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const res = await sendEmail(p.email, subject, html);
      if ((res as any).skipped) skipped++;
      else if ((res as any).ok) sent++;
      else errors.push((res as any).error);
    }
    return json({ ok: true, recipients: recipients.length, sent, skipped, resend_configured: !!RESEND_KEY, errors: errors.slice(0, 3) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
