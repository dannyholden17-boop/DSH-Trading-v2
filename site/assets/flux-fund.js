/* ============================================================
   Flux Fund — a SCRIPTED DEMONSTRATION, not a trading system.

   READ THIS BEFORE USING ANY NUMBER FROM THIS FILE ON A PAGE.

   Nothing here is a model, a strategy, or the research desk. The
   book is generated from a seeded hash of the ticker and the
   clock: `F.seed(ticker + "|" + tick)` picks what to buy, a coin
   flip (`roll < 0.72`) decides buy vs sell, and the "reason" on
   each row is drawn at random from a fixed list of strings. It
   reads live prices only so the marks move.

   It exists to show what the interface looks like with a book in
   it. It must never be presented as an AI trading, as a strategy,
   as a track record, or as the desk's work — the desk is real and
   lives in flux-desk.js, and its rulings are actual model output.

   Any surface that renders this must label it as a scripted
   demonstration in the surface itself, not in a footnote.
   F.Fund.SCRIPTED is exported so a page can assert it.
   ============================================================ */
(function () {
  "use strict";
  var F = window.FLUX = window.FLUX || {};

  var DAY = 86400000;
  var CFG = {
    START: 250000,            // virtual AUM at launch
    LIFE_MS: 3 * DAY,         // rolling "since launch" window
    TICK_MS: 30000,           // one decision every 30s (visible order flow)
    TARGET: 11,               // target number of open positions
    TRADE_EVERY: 1,           // evaluate every tick
  };

  // liquid names the fund rotates through (subset of the 253-name universe)
  var UNI = ["NVDA","AMD","TSLA","AAPL","MSFT","AMZN","META","GOOGL","NFLX","AVGO",
    "MU","ARM","INTC","CRM","ORCL","UBER","PLTR","COIN","SMCI","QQQ",
    "JPM","BAC","GS","V","MA","AXP","UNH","LLY","JNJ","XOM","CVX",
    "WMT","COST","HD","NKE","MCD","DIS","BA","CAT","GE","HON","TMUS","SOFI","HOOD"];

  /* Labels for the demo rows. These are NOT reasons — nothing reasoned.
     They name the scripted rule that produced the row, so the demo cannot
     be mistaken for model output. */
  var REASONS = {
    buy:  ["scripted entry", "scripted entry, add to book", "scripted entry, rotation"],
    sell: ["scripted exit", "scripted exit, trim", "scripted exit, rotation"],
    add:  ["scripted add"],
  };

  // deterministic RNG stream from a string
  function rng(s) { var x = F.seed(s); return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  // smooth seeded wiggle for ticker t at ABSOLUTE tick tk — evolves with wall-clock,
  // mean-reverting (sinusoids only, no drift) so nothing is rigged to trend up.
  function wob(t, tk) {
    var a = (F.seed(t + "|a") % 1000) / 1000, b = (F.seed(t + "|b") % 1000) / 1000;
    var amp1 = 0.035 + a * 0.05, amp2 = 0.015 + b * 0.03;
    return amp1 * Math.sin(tk / (320 + a * 240) + a * 6.28)
      + amp2 * Math.sin(tk / (70 + b * 60) + b * 6.28);
  }
  // price of t at absolute tick tk, anchored so tk==tickNow → live (no seam with live marks)
  function priceAt(t, tk, tickNow) {
    var live = F.priceOf(t); if (live == null) live = (F.PRICES && F.PRICES[t]) || 100;
    return +(live * (1 + wob(t, tk) - wob(t, tickNow))).toFixed(2);
  }
  function secOf(t) { return (F.FUND && F.FUND[t] && F.FUND[t].sec) || "the tape"; }

  var CACHE = { bucket: -1, data: null };

  function build(now) {
    var K = Math.floor(CFG.LIFE_MS / CFG.TICK_MS);           // ticks in the window
    var tickNow = Math.floor(now / CFG.TICK_MS);             // ABSOLUTE current tick
    var tick0 = tickNow - K;                                  // launch tick
    var cash = CFG.START, positions = {}, trades = [], realized = 0, curve = [];
    var curveStep = Math.max(1, Math.floor(K / 200));

    for (var tk = tick0; tk <= tickNow; tk++) {
      var ts = tk * CFG.TICK_MS;
      var held = Object.keys(positions);

      if (tk % CFG.TRADE_EVERY === 0 && tk < tickNow) {       // a decision tick
        var r = rng("flux-fund|" + tk);
        var roll = r();
        var wantBuy = held.length < CFG.TARGET ? roll < 0.72 : roll < 0.38;
        if (wantBuy) {
          var cand = null, bestScore = -1, rank = 1;
          for (var i = 0; i < UNI.length; i++) {
            var t = UNI[i], sc = ((F.seed(t + "|" + Math.floor(tk / 8)) % 1000) / 1000);
            if (sc > bestScore && (!positions[t] || positions[t].qty * priceAt(t, tk, tickNow) < cash * 0.14)) { bestScore = sc; cand = t; rank = (i % 5) + 1; }
          }
          if (cand) {
            var px = priceAt(cand, tk, tickNow);
            var notional = cash * (0.03 + r() * 0.05);
            var qty = Math.max(1, Math.floor(notional / px));
            var cost = qty * px;
            if (cost <= cash && qty >= 1) {
              var p = positions[cand] || { qty: 0, avg: 0 };
              var isAdd = p.qty > 0;
              p.avg = +(((p.qty * p.avg) + cost) / (p.qty + qty)).toFixed(4);
              p.qty += qty; positions[cand] = p; cash -= cost;
              trades.push({ ts: ts, side: "buy", t: cand, qty: qty, price: px,
                reason: fill(pick(isAdd ? REASONS.add : REASONS.buy, r), rank, secOf(cand)) });
            }
          }
        } else if (held.length) {
          var worst = null, wScore = 2;
          for (var j = 0; j < held.length; j++) { var ht = held[j], hs = ((F.seed(ht + "|" + Math.floor(tk / 8)) % 1000) / 1000); if (hs < wScore) { wScore = hs; worst = ht; } }
          if (worst) {
            var pos = positions[worst], spx = priceAt(worst, tk, tickNow);
            var sq = (r() < 0.5 && pos.qty > 3) ? Math.floor(pos.qty * (0.4 + r() * 0.3)) : pos.qty;
            sq = Math.max(1, Math.min(sq, pos.qty));
            var proceeds = sq * spx; cash += proceeds;
            realized += (spx - pos.avg) * sq;
            trades.push({ ts: ts, side: "sell", t: worst, qty: sq, price: spx,
              reason: pick(REASONS.sell, r), pl: +((spx - pos.avg) * sq).toFixed(2) });
            pos.qty -= sq; if (pos.qty <= 0) delete positions[worst];
          }
        }
      }

      if ((tk - tick0) % curveStep === 0 || tk === tickNow) {
        var eq = cash;
        for (var ct in positions) eq += positions[ct].qty * priceAt(ct, tk, tickNow);
        curve.push({ ts: ts, eq: +eq.toFixed(2) });
      }
    }
    var startTs = tick0 * CFG.TICK_MS;

    // live-marked current snapshot
    var posList = [], invested = 0;
    for (var t2 in positions) {
      var pp = positions[t2], live = F.priceOf(t2) || pp.avg, mkt = pp.qty * live;
      invested += mkt;
      posList.push({ t: t2, name: (F.NAMES && F.NAMES[t2]) || t2, qty: pp.qty, avg: +pp.avg.toFixed(2),
        price: live, mkt: +mkt.toFixed(2), pl: +((live - pp.avg) * pp.qty).toFixed(2),
        plpct: pp.avg ? +(((live - pp.avg) / pp.avg) * 100).toFixed(2) : 0, sec: secOf(t2) });
    }
    posList.sort(function (a, b) { return b.mkt - a.mkt; });
    var aum = +(cash + invested).toFixed(2);
    if (curve.length) curve[curve.length - 1].eq = aum;      // endpoint == live AUM

    // day P/L = AUM now vs AUM ~1 day of ticks back on the curve
    var dayIdx = Math.max(0, curve.length - 1 - Math.round((DAY / CFG.TICK_MS) / curveStep));
    var dayBase = curve[dayIdx] ? curve[dayIdx].eq : CFG.START;
    var weightBase = invested || 1;
    posList.forEach(function (p) { p.weight = +(p.mkt / weightBase * 100).toFixed(1); });

    return {
      aum: aum, cash: +cash.toFixed(2), invested: +invested.toFixed(2),
      ret: aum - CFG.START, retPct: +(((aum - CFG.START) / CFG.START) * 100).toFixed(2),
      realized: +realized.toFixed(2),
      dayPL: +(aum - dayBase).toFixed(2), dayPct: +(((aum - dayBase) / dayBase) * 100).toFixed(2),
      exposure: +(invested / aum * 100).toFixed(1),
      nOpen: posList.length, nTrades: trades.length,
      positions: posList, curve: curve, trades: trades,
      startTs: startTs, launchedAgo: CFG.LIFE_MS,
    };
  }
  function fill(tpl, r, sec) { return tpl.replace("{r}", r).replace("{sec}", sec); }

  var Fund = F.Fund = {
    /* Assert this before rendering. Nothing here reasoned; see the file header. */
    SCRIPTED: true,
    DISCLOSURE: "Scripted demonstration: a seeded script, not a model and not the desk.",
    CFG: CFG,
    // memoized snapshot — rebuilt only when the 45s bucket advances
    snapshot: function () {
      var now = F.now ? F.now() : Date.now();
      var bucket = Math.floor(now / CFG.TICK_MS);
      if (bucket !== CACHE.bucket || !CACHE.data) { CACHE.bucket = bucket; CACHE.data = build(bucket * CFG.TICK_MS); }
      // always refresh live marks (prices tick between buckets)
      return CACHE.data;
    },
    // newest-first trades
    recentTrades: function (n) {
      var s = this.snapshot(); var a = s.trades.slice().reverse();
      return n ? a.slice(0, n) : a;
    },
    // copy the fund's current allocation into the visitor's paper book, scaled to their cash
    copyToBook: function () {
      if (!F.Book) return { ok: false };
      var s = this.snapshot(), book = F.Book.get(), budget = book.cash;
      if (budget < 100) return { ok: false, msg: "Not enough paper cash to mirror the fund." };
      var invest = budget * 0.95, n = 0;
      s.positions.forEach(function (p) {
        var alloc = invest * (p.weight / 100), qty = Math.floor(alloc / (p.price || 1));
        if (qty >= 1) { var r = F.Book.place({ side: "buy", ticker: p.t, qty: qty, type: "market", silent: true }); if (r && r.ok) n++; }
      });
      if (F.toast) F.toast(" Mirrored the fund — " + n + " positions into your paper account.", { icon: "" });
      return { ok: true, placed: n };
    },
  };
})();
