/* ============================================================
   FLUX — OpenBB research client

   Fundamentals, analyst consensus, SEC filings and the macro
   backdrop, from OpenBB. OpenBB is Python, so it runs as a small
   service (openbb-bridge/) behind the `research` Edge Function;
   this file is the browser end of that.

   It is deliberately quiet: if the bridge isn't deployed the very
   first answer is {configured:false}, the client latches that and
   never calls again, and every widget that asked simply stays
   hidden. Nothing on the page breaks when OpenBB isn't there.
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var URL_ = "https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/research";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var TTL = 30 * 60 * 1000;
  var MACRO_TTL = 6 * 60 * 60 * 1000;

  var cache = {};            // key -> { t, v }
  var configured = null;     // null = unknown, false = no bridge, true = live
  var pending = {};

  function get(qs, key, ttl){
    if(configured === false) return Promise.resolve(null);
    var c = cache[key];
    if(c && Date.now()-c.t < ttl) return Promise.resolve(c.v);
    if(pending[key]) return pending[key];
    pending[key] = fetch(URL_ + "?" + qs, { headers:{ apikey:KEY_, authorization:"Bearer "+KEY_ } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        delete pending[key];
        if(d && d.configured === false){ configured = false; return null; }
        if(!d || !d.ok){ return null; }
        configured = true;
        cache[key] = { t:Date.now(), v:d };
        return d;
      })
      .catch(function(){ delete pending[key]; return null; });
    return pending[key];
  }

  var R = F.Research = {
    /* true once a real answer has come back, false if there's no bridge,
       null while we still don't know */
    ready: function(){ return configured; },

    fundamentals: function(sym){
      sym = (sym||"").toUpperCase(); if(!sym) return Promise.resolve(null);
      return get("symbol="+encodeURIComponent(sym), "f:"+sym, TTL)
        .then(function(d){ return d ? d.fundamentals : null; });
    },
    estimates: function(sym){
      sym = (sym||"").toUpperCase(); if(!sym) return Promise.resolve(null);
      return get("estimates="+encodeURIComponent(sym), "e:"+sym, TTL)
        .then(function(d){ return d ? d.estimates : null; });
    },
    filings: function(sym){
      sym = (sym||"").toUpperCase(); if(!sym) return Promise.resolve([]);
      return get("filings="+encodeURIComponent(sym), "l:"+sym, TTL)
        .then(function(d){ return (d && d.filings) || []; });
    },
    macro: function(){
      return get("macro=1", "m", MACRO_TTL).then(function(d){ return d ? d.macro : null; });
    },
    movers: function(kind){
      kind = kind || "gainers";
      return get("movers="+encodeURIComponent(kind), "v:"+kind, 10*60*1000)
        .then(function(d){ return (d && d.movers) || []; });
    },

    /* ---- formatting helpers, shared by every widget ---- */
    pct: function(x, digits){
      if(x==null || isNaN(x)) return null;
      var v = Math.abs(x) <= 1.5 ? x*100 : x;      // providers send 0.42 or 42
      return v.toFixed(digits==null?1:digits) + "%";
    },
    num: function(x, digits){
      if(x==null || isNaN(x)) return null;
      return (+x).toFixed(digits==null?2:digits);
    },
    big: function(x){
      if(x==null || isNaN(x)) return null;
      var n = +x, a = Math.abs(n);
      if(a >= 1e12) return "$"+(n/1e12).toFixed(2)+"T";
      if(a >= 1e9)  return "$"+(n/1e9).toFixed(2)+"B";
      if(a >= 1e6)  return "$"+(n/1e6).toFixed(2)+"M";
      return "$"+n.toLocaleString(undefined,{maximumFractionDigits:0});
    }
  };
  window.FLUXResearch = R;
})();
