/* ============================================================
   DSH Sentinel — live market feed
   Real-time price adapter (Finnhub). When a free API key is
   present it seeds real quotes over REST and streams live
   trades over WebSocket into DSHStore. With no key, the app
   runs on the built-in simulation. Swapping providers means
   editing only this file.
   ------------------------------------------------------------
   Get a free key at https://finnhub.io/register (20 seconds),
   then paste it into the "Connect live data" panel in the app,
   or open the app with ?fhkey=YOUR_KEY in the URL.
   ============================================================ */
(function(){
  "use strict";
  var S = window.DSHStore;
  if(!S){ return; }

  var KEY_STORE = "dsh.feed.key";
  // Default free Finnhub key so the app connects live out of the box.
  // Read-only, rate-limited market data. Replace or revoke anytime at
  // finnhub.io/dashboard, or override by pasting your own in the app.
  var DEFAULT_KEY = "d9jbl11r01qq0r8lnag0d9jbl11r01qq0r8lnagg";
  var ws = null, key = null, seeded = false, statusCb = null, reconnectT = null, attempts = 0;
  var status = "sim";   // sim | connecting | live | error

  function setStatus(s, msg){ status = s; if(statusCb) try{ statusCb(s, msg); }catch(e){} }

  function symbols(){ return S.knownSymbols(); }

  /* one-shot REST seed so prices are real immediately, before the tape ticks */
  function seedQuotes(){
    var syms = symbols();
    syms.forEach(function(sym){
      fetch("https://finnhub.io/api/v1/quote?symbol="+encodeURIComponent(sym)+"&token="+encodeURIComponent(key))
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(q){ if(q && q.c > 0){ S.setPrice(sym, q.c); } })
        .catch(function(){ /* ignore individual failures */ });
    });
    seeded = true;
  }

  function openSocket(){
    try{
      ws = new WebSocket("wss://ws.finnhub.io?token=" + encodeURIComponent(key));
    }catch(e){ fail("Could not open socket"); return; }

    ws.onopen = function(){
      attempts = 0;
      setStatus("live");
      S.setLive(true);
      symbols().forEach(function(sym){
        try{ ws.send(JSON.stringify({type:"subscribe", symbol:sym})); }catch(e){}
      });
    };
    ws.onmessage = function(ev){
      var m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
      if(m.type === "trade" && m.data){
        // keep only the last print per symbol from this batch
        var last = {};
        m.data.forEach(function(t){ last[t.s] = t.p; });
        Object.keys(last).forEach(function(sym){ S.setPrice(sym, last[sym]); });
      }
    };
    ws.onerror = function(){ /* onclose will handle recovery */ };
    ws.onclose = function(){
      S.setLive(false);
      if(key){ setStatus("connecting"); scheduleReconnect(); }
      else { setStatus("sim"); }
    };
  }

  function scheduleReconnect(){
    clearTimeout(reconnectT);
    attempts++;
    if(attempts > 3){ // give up quietly and run on simulation
      S.setLive(false);
      setStatus("sim", "Live feed unavailable, using simulation");
      return;
    }
    reconnectT = setTimeout(function(){ if(key) openSocket(); }, 3000);
  }

  function fail(msg){ S.setLive(false); setStatus("sim", msg); }

  var API = {
    provider: "finnhub",
    status: function(){ return status; },
    hasKey: function(){ return !!key; },
    onStatus: function(cb){ statusCb = cb; cb(status); },

    connect: function(){
      if(!key){ setStatus("sim"); return; }
      setStatus("connecting");
      seedQuotes();
      openSocket();
    },
    disconnect: function(){
      clearTimeout(reconnectT);
      if(ws){ try{ ws.close(); }catch(e){} ws = null; }
      S.setLive(false); setStatus("sim");
    },
    setKey: function(k){
      k = (k||"").trim();
      this.disconnect();
      key = k || null;
      try{ if(key) localStorage.setItem(KEY_STORE, key); else localStorage.removeItem(KEY_STORE); }catch(e){}
      if(key) this.connect();
    },
    clearKey: function(){ this.setKey(""); },

    init: function(){
      // key priority: URL ?fhkey= , then a user-saved key, then the built-in default
      var urlKey = null;
      try{ urlKey = new URLSearchParams(location.search).get("fhkey"); }catch(e){}
      if(urlKey){ this.setKey(urlKey); return; }
      try{ key = localStorage.getItem(KEY_STORE) || null; }catch(e){}
      if(!key) key = DEFAULT_KEY || null;
      if(key) this.connect(); else setStatus("sim");
    }
  };

  window.DSHFeed = API;
})();
