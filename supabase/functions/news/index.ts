// Flux — finance news aggregator (Edge Function)
// Fetches several public finance RSS feeds server-side (no browser CORS, no key),
// merges + dedupes them, and returns a compact JSON list the site renders into
// the news page and the terminal / dashboard / Fluxi widgets.
//   GET /news            -> { ok:true, ts, count, items:[{title,url,source,published,summary}] }
//   GET /news?q=NVDA     -> filter to headlines mentioning NVDA (or a name)
//   GET /news?limit=20   -> cap the list
// Sources: WSJ (Markets/Business/Tech), CNBC (Top/Markets), MarketWatch, Yahoo Finance.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=120",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const FEEDS: { url: string; source: string; g?: boolean; gov?: boolean }[] = [
  // WSJ / Reuters / Bloomberg via Google News (their own feeds block datacenter IPs)
  { url: "https://news.google.com/rss/search?q=site:wsj.com%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "WSJ", g: true },
  { url: "https://news.google.com/rss/search?q=site:reuters.com%20(markets%20OR%20business)%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "Reuters", g: true },
  { url: "https://news.google.com/rss/search?q=site:bloomberg.com%20(markets%20OR%20stocks)%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "Bloomberg", g: true },
  // Direct feeds that work from a datacenter
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", source: "CNBC" },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", source: "CNBC" },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", source: "CNBC" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", source: "MarketWatch" },
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance" },
  { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com" },

  // Government / official announcements (direct feeds)
  { url: "https://www.federalreserve.gov/feeds/press_all.xml", source: "Federal Reserve", gov: true },
  { url: "https://www.bls.gov/feed/bls_latest.rss", source: "BLS", gov: true },
  { url: "https://www.whitehouse.gov/feed/", source: "White House", gov: true },
  // Government (via Google News — .gov feeds that block datacenter IPs / lack RSS)
  { url: "https://news.google.com/rss/search?q=(site:federalreserve.gov%20OR%20FOMC%20OR%20%22interest%20rate%20decision%22)%20when:3d&hl=en-US&gl=US&ceid=US:en", source: "Federal Reserve", g: true, gov: true },
  { url: "https://www.sec.gov/news/pressreleases.rss", source: "SEC", gov: true },
  { url: "https://news.google.com/rss/search?q=(%22SEC%20charges%22%20OR%20%22SEC%20approves%22%20OR%20%22SEC%20settles%22%20OR%20%22Securities%20and%20Exchange%20Commission%22)%20when:3d&hl=en-US&gl=US&ceid=US:en", source: "SEC", g: true, gov: true },
  { url: "https://news.google.com/rss/search?q=(site:home.treasury.gov%20OR%20%22Treasury%20Department%22%20OR%20%22Treasury%20announces%22)%20when:3d&hl=en-US&gl=US&ceid=US:en", source: "Treasury", g: true, gov: true },
  { url: "https://news.google.com/rss/search?q=(%22jobs%20report%22%20OR%20%22CPI%20report%22%20OR%20%22inflation%20data%22%20OR%20tariffs%20OR%20%22White%20House%22%20economy)%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "Gov / Policy", g: true, gov: true },
];

// warm in-memory cache
let CACHE: { at: number; items: any[] } | null = null;
const TTL = 150 * 1000;

function decode(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ").trim();
}
// Skip raw EDGAR filing codes / index rows that aren't readable news.
function looksJunk(t: string): boolean {
  if (t.length < 10) return true;
  if (/^EDGAR Filing Documents/i.test(t)) return true;
  if (/^[0-9]{1,3}-?[A-Z]{1,3}\d?[A-Z]?$/.test(t)) return true;   // 6-K, 424B3, 10-K, 8-K
  if (/^[a-z]{2,6}-\d{6,8}$/i.test(t)) return true;               // wsm-20260826
  if (/^\d{7,}$/.test(t)) return true;
  return false;
}
function pick(block: string, name: string): string {
  const m = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? m[1] : "";
}
function linkOf(block: string): string {
  const t = decode(pick(block, "link"));
  if (t && /^https?:/.test(t)) return t;
  const m = block.match(/<link[^>]*href="([^"]+)"/i);
  return m ? m[1] : "";
}
function parse(xml: string, source: string, google = false, gov = false): any[] {
  const out: any[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  for (const b of blocks) {
    let title = decode(pick(b, "title"));
    // Google News appends " - Publisher" to every title — trim it.
    if (google) title = title.replace(/\s+[–-]\s+[^–-]{2,40}$/, "").trim();
    const url = linkOf(b);
    if (!title || !url || looksJunk(title)) continue;
    const dateRaw = decode(pick(b, "pubDate")) || decode(pick(b, "published")) || decode(pick(b, "updated"));
    let published = 0;
    if (dateRaw) { const d = Date.parse(dateRaw); if (!isNaN(d)) published = d; }
    const summary = decode(pick(b, "description") || pick(b, "summary")).slice(0, 240);
    out.push({ title, url, source, published, summary, gov });
  }
  return out;
}

async function fetchFeed(f: { url: string; source: string; g?: boolean; gov?: boolean }): Promise<any[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(f.url, { headers: { "User-Agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const xml = await r.text();
    return parse(xml, f.source, !!f.g, !!f.gov);
  } catch { return []; }
}

async function aggregate(): Promise<any[]> {
  if (CACHE && Date.now() - CACHE.at < TTL) return CACHE.items;
  const lists = await Promise.all(FEEDS.map(fetchFeed));
  const byKey = new Map<string, any>();
  const merged: any[] = [];
  for (const list of lists) {
    for (const it of list) {
      const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
      if (!key) continue;
      const prev = byKey.get(key);
      if (prev) { if (it.gov && !prev.gov) prev.gov = true; continue; } // dup: keep gov tag if either is gov
      byKey.set(key, it);
      merged.push(it);
    }
  }
  merged.sort((a, b) => (b.published || 0) - (a.published || 0));
  CACHE = { at: Date.now(), items: merged };
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const govOnly = url.searchParams.get("gov") === "1";
    const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get("limit") || "40", 10) || 40));
    let items = await aggregate();
    if (govOnly) items = items.filter((it) => it.gov);            // only official / government items
    if (q) items = items.filter((it) => (it.title + " " + it.summary).toLowerCase().includes(q));
    items = items.slice(0, limit);
    return json({ ok: true, ts: Date.now(), count: items.length, items });
  } catch (e) {
    return json({ ok: false, error: String(e), items: [] }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
