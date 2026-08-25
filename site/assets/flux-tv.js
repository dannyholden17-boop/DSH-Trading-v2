/* ============================================================
   FLUX — TradingView rating client
   Talks to the `tv` Edge Function (a port of the TradingView-API
   fork's scanner core) to fetch TradingView's live price + technical
   -analysis rating for a symbol. Used as a real second opinion next
   to Fluxi's own Kronos signal. Data is TradingView's; simulated
   elsewhere on the site. Not affiliated with TradingView.
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var URL_ = "https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/tv";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var cache = {};                 // SYMBOL -> { t, data }
  var TTL = 5 * 60 * 1000;        // 5 min

  function get(url){
    return fetch(url, { headers: { apikey: KEY_, authorization: "Bearer " + KEY_ } })
      .then(function(r){ return r.json(); });
  }

  var TV = F.TV = {
    // TradingView's standard recommendation bands (score in [-1,1]).
    label: function(s){
      if(s==null || isNaN(s)) return "—";
      if(s>=0.5) return "Strong Buy";
      if(s>=0.1) return "Buy";
      if(s>-0.1) return "Neutral";
      if(s>-0.5) return "Sell";
      return "Strong Sell";
    },
    color: function(s){
      if(s==null || isNaN(s)) return "var(--text-faint)";
      if(s>=0.1) return "var(--emerald)";
      if(s>-0.1) return "var(--text-dim)";
      return "var(--crimson)";
    },

    // One symbol -> { id, symbol, price, change, score, label, ma, osc } | null
    rating: function(t){
      t = (t||"").toUpperCase(); if(!t) return Promise.resolve(null);
      var c = cache[t];
      if(c && Date.now()-c.t < TTL) return Promise.resolve(c.data);
      return get(URL_ + "?rating=" + encodeURIComponent(t))
        .then(function(d){ if(d && !d.error){ cache[t] = { t:Date.now(), data:d }; return d; } return null; })
        .catch(function(){ return null; });
    },

    // Batch -> [{...}]
    scan: function(list){
      list = (list||[]).map(function(x){ return (x||"").toUpperCase(); }).filter(Boolean);
      if(!list.length) return Promise.resolve([]);
      return get(URL_ + "?scan=" + encodeURIComponent(list.join(",")))
        .then(function(d){
          var res = (d && d.results) || [];
          res.forEach(function(x){ if(x && x.symbol) cache[x.symbol] = { t:Date.now(), data:x }; });
          return res;
        })
        .catch(function(){ return []; });
    }
  };
  window.FLUXTV = TV;
})();
