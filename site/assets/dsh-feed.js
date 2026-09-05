/* ============================================================
   DSH Sentinel — live market feed
   Polls the `quotes` Supabase edge function, the same server-side
   feed the rest of Flux runs on: Yahoo first, Stooq as fallback,
   and a licensed provider ahead of both when one is configured
   (FLUX_QUOTES_PROVIDER). Keyless, so nothing to paste and no
   credential in this file.

   This used to call Finnhub straight from the browser on a key
   hardcoded here. That put a live credential in public source on
   every page load, and it made these two surfaces the only ones
   on the site running on a different provider from everything
   else. Both are gone.

   No tick streaming: the free feed is REST, so quotes refresh on
   a poll like they do everywhere else in Flux. `setKey` and
   friends are kept as no-ops so nothing that called them breaks.
   ============================================================ */
(function(){
  "use strict";
  var S = window.DSHStore;
  if(!S){ return; }

  var PROJECT  = "https://pyzcwddyagodmtjuvwdn.supabase.co";
  var ANON     = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var ENDPOINT = PROJECT + "/functions/v1/quotes";
  var EVERY    = 10000;   // poll cadence (ms), matches flux-feed.js
  var MAXSYMS  = 240;

  var timer = null, statusCb = null, misses = 0, stopped = true;
  var status = "sim";     // sim | connecting | live | error
  var source = null;      // yahoo | stooq | <licensed provider>

  function setStatus(s, msg){ status = s; if(statusCb) try{ statusCb(s, msg); }catch(e){} }

  function symbols(){
    var syms = S.knownSymbols() || [];
    return syms.slice(0, MAXSYMS);
  }

  function poll(){
    var syms = symbols();
    if(!syms.length){ schedule(); return; }
    fetch(ENDPOINT + "?symbols=" + encodeURIComponent(syms.join(",")), {
      headers: { apikey: ANON, authorization: "Bearer " + ANON }
    })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var q = j && j.ok && j.quotes;
        if(!q || !Object.keys(q).length) throw new Error("empty");
        var n = 0;
        for(var t in q){
          if(!Object.prototype.hasOwnProperty.call(q, t)) continue;
          var px = q[t] && q[t].last;
          if(px > 0){ S.setPrice(t, px); n++; }
        }
        if(!n) throw new Error("no prices");
        misses = 0;
        source = j.source || null;
        S.setLive(true);
        if(status !== "live") setStatus("live");
        schedule();
      })
      .catch(function(){
        misses++;
        // One bad poll is a blip; a run of them is an outage. Say so rather
        // than leaving a stale price on screen looking current.
        if(misses >= 3){
          S.setLive(false);
          setStatus("sim", "Live feed unavailable, using simulation");
        }
        schedule();
      });
  }

  function schedule(){
    clearTimeout(timer);
    if(stopped) return;
    // back off while the feed is down so a dead endpoint is not hammered
    timer = setTimeout(poll, misses >= 3 ? Math.min(EVERY * 6, 60000) : EVERY);
  }

  var API = {
    provider: "flux-quotes",
    status:  function(){ return status; },
    source:  function(){ return source; },
    /* The feed needs no credential now. Kept truthful for callers that ask,
       and so the UI can stop offering a key box. */
    hasKey:  function(){ return true; },
    keyless: true,
    onStatus: function(cb){ statusCb = cb; cb(status); },

    connect: function(){
      if(!stopped) return;
      stopped = false; misses = 0;
      setStatus("connecting");
      poll();
    },
    disconnect: function(){
      stopped = true;
      clearTimeout(timer);
      S.setLive(false);
      setStatus("sim");
    },
    /* No-ops: there is no key to set or clear any more. */
    setKey:   function(){ this.connect(); },
    clearKey: function(){ this.disconnect(); },

    init: function(){ this.connect(); }
  };

  window.DSHFeed = API;
})();
