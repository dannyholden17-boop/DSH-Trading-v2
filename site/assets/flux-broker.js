/* ============================================================
   FLUX — brokerage connection (bring your own broker)

   Lets a member run the Flux terminal against their OWN brokerage
   account instead of the paper book. Talks to the `broker` Edge
   Function, which is a stateless proxy: it uses the credentials for
   one upstream call and never stores or logs them.

   Where the keys live: this browser only (localStorage), exactly like
   the Anthropic BYOK key. They are sent to the proxy on each request
   because a browser can't call a brokerage API directly. Nothing is
   written to the Flux database.

   Providers: Alpaca today (paper + live). Alpaca paper keys are the
   safe default — real-money mode has to be chosen explicitly.
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var URL_ = "https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/broker";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var LS = "flux_broker";
  var TTL = 12 * 1000;            // snapshots are cheap but not free
  var snap = null, snapAt = 0, inflight = null;

  function read(){
    try{ var raw = localStorage.getItem(LS); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function write(v){
    try{ if(v) localStorage.setItem(LS, JSON.stringify(v)); else localStorage.removeItem(LS); }catch(e){}
  }
  function fire(){
    try{ window.dispatchEvent(new CustomEvent("flux-broker", { detail:{ connected: B.connected() } })); }catch(e){}
  }

  function call(action, extra){
    var c = read();
    if(!c || !c.key || !c.secret) return Promise.reject(new Error("No brokerage connected."));
    var body = {
      provider: c.provider || "alpaca",
      action: action,
      key: c.key, secret: c.secret, paper: c.paper !== false
    };
    if(extra) for(var k in extra) if(Object.prototype.hasOwnProperty.call(extra,k)) body[k] = extra[k];
    return fetch(URL_, {
      method: "POST",
      headers: { "Content-Type":"application/json", apikey: KEY_, authorization: "Bearer " + KEY_ },
      body: JSON.stringify(body)
    }).catch(function(){ throw new Error("Couldn't reach the Flux brokerage service, check your connection."); })
      .then(function(r){ return r.json().catch(function(){ return { error:"bad response" }; }); })
      .then(function(d){
        if(!d || d.error) throw new Error((d && (d.message || d.error)) || "Brokerage request failed.");
        return d;
      });
  }

  var B = F.Broker = {
    /* ---- connection state ---- */
    get: function(){
      var c = read();
      if(!c) return null;
      return { provider: c.provider || "alpaca", paper: c.paper !== false, keyTail: String(c.key||"").slice(-4), label: c.label || "" };
    },
    connected: function(){ var c = read(); return !!(c && c.key && c.secret); },
    live: function(){ var c = read(); return !!(c && c.key && c.paper === false); },
    provider: function(){ var c = read(); return c ? (c.provider || "alpaca") : null; },

    /* Verify before saving, so a bad key never gets stored as "connected". */
    connect: function(o){
      o = o || {};
      var cand = {
        provider: (o.provider || "alpaca").toLowerCase(),
        key: String(o.key||"").trim(),
        secret: String(o.secret||"").trim(),
        paper: o.paper !== false,
        label: o.label || ""
      };
      if(!cand.key || !cand.secret) return Promise.reject(new Error("Both the key and the secret are needed."));
      return fetch(URL_, {
        method:"POST",
        headers:{ "Content-Type":"application/json", apikey: KEY_, authorization:"Bearer " + KEY_ },
        body: JSON.stringify({ provider:cand.provider, action:"verify", key:cand.key, secret:cand.secret, paper:cand.paper })
      }).catch(function(){ throw new Error("Couldn't reach the Flux brokerage service, check your connection."); })
        .then(function(r){ return r.json().catch(function(){ return { error:"bad response" }; }); })
        .then(function(d){
          if(!d || d.error || !d.ok) throw new Error((d && (d.message || d.error)) || "Could not reach that account.");
          write(cand);
          snap = d; snapAt = Date.now();
          fire();
          return d.account;
        });
    },
    disconnect: function(){ write(null); snap = null; snapAt = 0; fire(); },

    /* ---- data (always the broker's own numbers) ---- */
    snapshot: function(force){
      if(!B.connected()) return Promise.resolve(null);
      if(!force && snap && (Date.now()-snapAt) < TTL) return Promise.resolve(snap);
      if(inflight) return inflight;
      inflight = call("snapshot").then(function(d){
        snap = d; snapAt = Date.now(); inflight = null;
        try{ window.dispatchEvent(new CustomEvent("flux-broker-data", { detail:d })); }catch(e){}
        return d;
      }).catch(function(e){ inflight = null; throw e; });
      return inflight;
    },
    cached: function(){ return snap; },
    account:   function(){ return B.snapshot().then(function(d){ return d ? d.account : null; }); },
    positions: function(){ return B.snapshot().then(function(d){ return d ? (d.positions||[]) : []; }); },
    orders:    function(){ return B.snapshot().then(function(d){ return d ? (d.orders||[]) : []; }); },

    /* ---- trading (real orders at the user's broker) ---- */
    place: function(order){
      return call("place", { order: order }).then(function(d){
        snapAt = 0;                       // next read must come from the broker
        return d.order;
      });
    },
    cancel: function(id){
      return call("cancel", { id: id }).then(function(d){ snapAt = 0; return d; });
    },

    /* poll while the terminal is in brokerage mode */
    poll: function(ms){
      ms = ms || 20000;
      if(B._timer) clearInterval(B._timer);
      B._timer = setInterval(function(){
        if(B.connected() && !document.hidden) B.snapshot(true).catch(function(){});
      }, ms);
      return B._timer;
    },
    stopPoll: function(){ if(B._timer){ clearInterval(B._timer); B._timer = null; } }
  };

  window.FLUXBroker = B;
})();
