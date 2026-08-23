/* Flux — live quote feed (client).
   Polls the `quotes` Supabase edge function (Yahoo/Stooq, keyless, server-side)
   and hydrates FLUX.LIVE + live FLUX.FUND fields for the whole universe, so the
   terminal, screener, options, paper desk and AI all use real quotes. Works
   logged-out. No tick streaming (free data) — refreshes every ~10s, which reads
   as live on screen. */
(function () {
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var PROJECT = "https://pyzcwddyagodmtjuvwdn.supabase.co";
  var ANON = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var ENDPOINT = PROJECT + "/functions/v1/quotes";
  var EVERY = 10000;          // poll cadence (ms)
  var MAXSYMS = 240;          // cap per request
  var backoff = 0, timer = null, stopped = false;

  F.Feed = { status: "init", source: null, lastAt: 0, ok: false };

  function universe() {
    // everything the engine knows, plus whatever the user is actually looking at
    var set = {};
    try { Object.keys(F.PRICES || {}).forEach(function (t) { set[t] = 1; }); } catch (e) {}
    try { (F.Watch && F.Watch.get() || []).forEach(function (t) { set[(t || "").toUpperCase()] = 1; }); } catch (e) {}
    try {
      var b = F.Book && F.Book.get && F.Book.get();
      if (b && b.positions) Object.keys(b.positions).forEach(function (t) { set[t] = 1; });
    } catch (e) {}
    var qs = window.location && window.location.search || "";
    var m = /[?&]symbol=([A-Za-z.\-]{1,10})/.exec(qs);
    if (m) set[m[1].toUpperCase()] = 1;
    return Object.keys(set).slice(0, MAXSYMS);
  }

  function apply(quotes) {
    if (!quotes) return 0;
    F.LIVE = F.LIVE || {};
    F.FUND = F.FUND || {};
    F.NAMES = F.NAMES || {};
    var n = 0;
    for (var t in quotes) {
      var q = quotes[t]; if (!q || q.last == null) continue;
      F.LIVE[t] = { last: +q.last, prev_close: (q.prev_close != null ? +q.prev_close : +q.last), name: q.name || F.NAMES[t] || t };
      if (q.name && !F.NAMES[t]) F.NAMES[t] = q.name;
      // fold live fundamentals into FLUX.FUND (screener / options read these)
      var f = F.FUND[t] || {};
      if (q.pe != null) f.pe = +q.pe;
      if (q.mc != null) f.mc = +q.mc;
      if (q.hi != null) f.hi = +q.hi;
      if (q.lo != null) f.lo = +q.lo;
      if (f.sec == null) f.sec = (F.UNIVERSE && F.UNIVERSE[t] && F.UNIVERSE[t][1]) || "—";
      F.FUND[t] = f;
      n++;
    }
    return n;
  }

  function poll() {
    if (stopped) return;
    if (document.hidden) { schedule(EVERY); return; }
    var syms = universe();
    if (!syms.length) { schedule(EVERY); return; }
    F.Feed.status = "polling";
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var killer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 9000);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ANON, "Authorization": "Bearer " + ANON },
      body: JSON.stringify({ symbols: syms }),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(killer);
        if (j && j.ok && j.quotes) {
          var n = apply(j.quotes);
          F.Feed = { status: "live", source: j.source, lastAt: Date.now(), ok: n > 0, count: n };
          backoff = 0;
          try { window.dispatchEvent(new Event("flux-prices")); } catch (e) {}
        } else {
          F.Feed.status = "empty"; bump();
        }
        schedule(EVERY);
      })
      .catch(function () {
        clearTimeout(killer);
        F.Feed.status = "error"; bump();
        schedule(EVERY + backoff);
      });
  }

  function bump() { backoff = Math.min(60000, (backoff || 5000) * 2); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(poll, ms); }

  F.Feed.start = function () { stopped = false; schedule(0); };
  F.Feed.stop = function () { stopped = true; clearTimeout(timer); };

  // kick off shortly after load so the engine + universe are in place
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(F.Feed.start, 300); });
  } else {
    setTimeout(F.Feed.start, 300);
  }
  // repoll promptly when the tab regains focus
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !stopped) schedule(200); });
})();
