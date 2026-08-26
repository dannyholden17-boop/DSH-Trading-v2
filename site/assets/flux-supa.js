/* ============================================================
   FLUX — Supabase backend layer (real auth + persistence)
   Loaded (defer) BEFORE flux-site.js on every page.
   - Loads the Supabase JS SDK from CDN.
   - Real auth: email/password, Google OAuth, magic link.
   - Persists the paper account (cash / positions / orders) per user.
   - Exposes window.FluxSupa and keeps window.__fluxUser in sync so the
     synchronous nav/guard in flux-site.js reflect the real session.
   ============================================================ */
(function(){
  "use strict";
  var URL_ = "https://pyzcwddyagodmtjuvwdn.supabase.co";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var SDK  = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var SKEY = "sb-pyzcwddyagodmtjuvwdn-auth-token";

  var S = { client:null, _user:null, loaded:false };

  function mapUser(u){
    if(!u) return null;
    var md = u.user_metadata || {};
    return { id:u.id, email:u.email||"", name: md.full_name || md.name || (u.email? u.email.split("@")[0] : "Trader") };
  }
  // Synchronously read a persisted session so guard()/nav work on first paint.
  function readLocalUser(){
    try{
      var raw = localStorage.getItem(SKEY); if(!raw) return null;
      var j = JSON.parse(raw);
      var u = (j && j.user) || (j && j.currentSession && j.currentSession.user) || (j && j.access_token && j.user) || null;
      return u ? mapUser(u) : null;
    }catch(e){ return null; }
  }
  S._user = readLocalUser();
  window.__fluxUser = S._user;
  S.user = function(){ return S._user; };

  var readyResolve;
  S.ready = new Promise(function(res){ readyResolve = res; });

  function boot(){
    if(!window.supabase || !window.supabase.createClient){ readyResolve(false); return; }
    try{
      S.client = window.supabase.createClient(URL_, KEY_, {
        auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce", storageKey:SKEY }
      });
    }catch(e){ readyResolve(false); return; }
    S.loaded = true;
    S.syncPrices(); S.syncForecasts();
    setInterval(function(){ S.syncPrices(); }, 20000);
    setInterval(function(){ S.syncForecasts(); }, 60000);
    // After an OAuth / magic-link redirect, clean the URL and reload once so the
    // page (re)renders with the established session on first paint.
    function cleanLandingIfNeeded(){
      if(S._user && /[?&]code=|access_token=/.test(location.search + location.hash)){
        try{ history.replaceState(null, "", location.pathname); }catch(e){}
        location.reload();
      }
    }
    S.client.auth.onAuthStateChange(function(_e, sess){
      S._user = sess ? mapUser(sess.user) : null; window.__fluxUser = S._user;
      if(window.FLUX && window.FLUX.initAuth){ try{ window.FLUX.initAuth(); }catch(e){} }
      if(S._user){ S.wrapBook(); S.hydrate(); S.subscription(); S.checkAdmin(); S.wrapWatch(); S.hydrateWatch(); cleanLandingIfNeeded(); }
      try{ window.dispatchEvent(new Event("flux-auth")); }catch(e){}
    });
    S.client.auth.getSession().then(function(r){
      var sess = r && r.data && r.data.session;
      S._user = sess ? mapUser(sess.user) : null; window.__fluxUser = S._user;
      if(window.FLUX && window.FLUX.initAuth){ try{ window.FLUX.initAuth(); }catch(e){} }
      if(S._user){ S.wrapBook(); S.hydrate(); S.subscription(); S.checkAdmin(); S.wrapWatch(); S.hydrateWatch(); }
      try{ window.dispatchEvent(new Event("flux-auth")); }catch(e){}
      readyResolve(true);
    }).catch(function(){ readyResolve(true); });
  }

  var sc = document.createElement("script");
  sc.src = SDK; sc.async = true; sc.onload = boot; sc.onerror = function(){ readyResolve(false); };
  (document.head || document.documentElement).appendChild(sc);

  // ---- redirect target for OAuth / magic link ----
  function redir(){ return location.origin + location.pathname.replace(/[^\/]*$/, "") + "dashboard.html"; }
  S.redir = redir;

  // ---- auth API (all return the SDK promise) ----
  S.signUpEmail = function(email, pw, name){
    return S.client.auth.signUp({ email:email, password:pw, options:{ data:{ full_name:name||"" }, emailRedirectTo:redir() } });
  };
  S.signInEmail = function(email, pw){ return S.client.auth.signInWithPassword({ email:email, password:pw }); };
  S.signInMagic = function(email){ return S.client.auth.signInWithOtp({ email:email, options:{ emailRedirectTo:redir() } }); };
  // Send a password-reset email. User clicks the link and lands back to set a new password.
  S.resetPassword = function(email){
    if(!S.client) return Promise.reject(new Error("not ready"));
    return S.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname.replace(/[^\/]*$/, "") + "signin.html?reset=1" });
  };
  S.signInGoogle = function(){ return S.client.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:redir() } }); };
  S.signOut = function(){ try{ return S.client ? S.client.auth.signOut() : Promise.resolve(); }catch(e){ return Promise.resolve(); } };

  // ---- persistence: hydrate the paper account into the FLUXBook shape ----
  S.hydrate = function(){
    if(!S.client || !S._user) return Promise.resolve(false);
    var uid = S._user.id;
    return Promise.all([
      S.client.from("paper_accounts").select("cash,start").eq("user_id", uid).maybeSingle(),
      S.client.from("positions").select("ticker,qty,avg").eq("user_id", uid),
      S.client.from("orders").select("side,ticker,qty,price,type,ts,status").eq("user_id", uid).order("ts",{ascending:false}).limit(60)
    ]).then(function(res){
      var acct = (res[0] && res[0].data) || { cash:100000, start:100000 };
      var pos = {}; ((res[1] && res[1].data) || []).forEach(function(p){ pos[p.ticker] = { qty:Number(p.qty), avg:Number(p.avg) }; });
      var orders = ((res[2] && res[2].data) || []).map(function(o,i){
        return { id:i+1, ts:Date.parse(o.ts)||0, side:o.side, ticker:o.ticker, qty:Number(o.qty), price:Number(o.price), type:o.type, status:o.status };
      });
      var book = { v:1, cash:Number(acct.cash), start:Number(acct.start), positions:pos, orders:orders };
      try{ localStorage.setItem("flux_book", JSON.stringify(book)); }catch(e){}
      try{ window.dispatchEvent(new Event("flux-book-updated")); }catch(e){}
      return true;
    }).catch(function(){ return false; });
  };

  // Wrap FLUXBook.place so orders persist to the server, then re-sync from truth.
  S.wrapBook = function(){
    if(!window.FLUXBook || window.FLUXBook.__wrapped) return;
    var orig = window.FLUXBook.place.bind(window.FLUXBook);
    window.FLUXBook.place = function(o){
      var r = orig(o); // optimistic local fill for instant UI
      if(r && r.ok && S.client && S._user && r.order){
        S.client.rpc("place_order", {
          p_ticker: (o.ticker||"").toUpperCase(), p_side:o.side,
          p_qty: Math.floor(+o.qty||0), p_price: r.order.price, p_type: o.type||"market"
        }).then(function(){ S.hydrate(); }).catch(function(){});
      }
      return r;
    };
    var origReset = window.FLUXBook.reset.bind(window.FLUXBook);
    window.FLUXBook.reset = function(){
      var b = origReset();
      if(S.client && S._user){
        S.client.from("positions").delete().eq("user_id", S._user.id).then(function(){});
        S.client.from("orders").delete().eq("user_id", S._user.id).then(function(){});
        S.client.from("paper_accounts").upsert({ user_id:S._user.id, cash:100000, start:100000, updated_at:new Date().toISOString() }).then(function(){});
      }
      return b;
    };
    window.FLUXBook.__wrapped = true;
  };

  // ---- live prices (public read) → feed FLUX.LIVE so the whole site uses real quotes ----
  S.prices = null;
  S.syncPrices = function(){
    if(!S.client) return Promise.resolve(false);
    return S.client.from("prices").select("ticker,name,base,last,prev_close").then(function(r){
      if(r && r.data && r.data.length){
        var m = {}; r.data.forEach(function(p){ m[p.ticker] = { last:Number(p.last), prev_close:Number(p.prev_close), name:p.name }; });
        S.prices = m;
        if(window.FLUX) window.FLUX.LIVE = m;
        try{ window.dispatchEvent(new Event("flux-prices")); }catch(e){}
      }
      return true;
    }).catch(function(){ return false; });
  };

  // ---- Kronos forecasts (public read) → feed FLUX.KFORECAST ----
  S.syncForecasts = function(){
    if(!S.client) return Promise.resolve(false);
    return S.client.from("forecasts").select("ticker,pred_close,pred_return,confidence,horizon,model,path").then(function(r){
      if(r && r.data && r.data.length){
        var m = {}; r.data.forEach(function(f){ m[f.ticker] = {
          pred_close:Number(f.pred_close), pred_return:Number(f.pred_return),
          confidence: f.confidence!=null?Number(f.confidence):null, horizon:f.horizon,
          model:f.model, path:f.path }; });
        if(window.FLUX) window.FLUX.KFORECAST = m;
        try{ window.dispatchEvent(new Event("flux-forecasts")); }catch(e){}
      }
      return true;
    }).catch(function(){ return false; }); // table may not exist yet — harmless
  };

  // ---- autopilot fund (public read) ----
  S.autopilot = function(){
    if(!S.client) return Promise.resolve(null);
    return Promise.all([
      S.client.from("autopilot_fund").select("*").eq("id",1).maybeSingle(),
      S.client.from("autopilot_positions").select("*"),
      S.client.from("autopilot_orders").select("*").order("ts",{ascending:false}).limit(40),
      S.client.from("autopilot_equity").select("*").order("ts",{ascending:true}).limit(400),
      S.client.from("autopilot_reports").select("*").order("ts",{ascending:false}).limit(20)
    ]).then(function(r){
      return { fund:(r[0]&&r[0].data)||null, positions:(r[1]&&r[1].data)||[], orders:(r[2]&&r[2].data)||[],
        equity:(r[3]&&r[3].data)||[], reports:(r[4]&&r[4].data)||[] };
    }).catch(function(){ return null; });
  };

  // ---- subscriptions / billing (Stripe via edge functions) ----
  S.sub = null;
  S.subscription = function(){
    if(!S.client || !S._user) return Promise.resolve(null);
    return S.client.from("subscriptions").select("plan,status,current_period_end").eq("user_id", S._user.id).maybeSingle()
      .then(function(r){ S.sub = (r && r.data) || null; if(window.FLUX) window.FLUX.SUB = S.sub;
        try{ window.dispatchEvent(new Event("flux-sub")); }catch(e){} return S.sub; })
      .catch(function(){ return null; });
  };
  S.hasActivePlan = function(){ return !!(S.sub && (S.sub.status === "active" || S.sub.status === "trialing")); };
  // Admin status is SERVER-verified (flux_is_admin RPC checks the signed-in
  // JWT's email against the DB allowlist). No emails ship in client code, and
  // the flag can't be forged — server RPCs re-check on every admin action.
  S._adm = false;
  S.checkAdmin = function(){
    if(!S.client || !S._user){ S._adm = false; return Promise.resolve(false); }
    return S.client.rpc("flux_is_admin").then(function(r){
      var was = S._adm; S._adm = (r && r.data === true);
      if(S._adm !== was){ try{ window.dispatchEvent(new Event("flux-sub")); }catch(e){} }
      return S._adm;
    }).catch(function(){ return S._adm; });
  };
  S.isAdmin = function(){ return !!S._adm; };
  // Single gate for paid / pro features: an active (or comped) plan, or an admin.
  // (Admins are also comped server-side, so hasActivePlan() covers them too.)
  S.entitled = function(){ return S.isAdmin() || S.hasActivePlan(); };
  // Start Stripe Checkout for a plan ("trader" | "desk"); redirects to Stripe.
  S.checkout = function(plan){
    if(!S.client) return Promise.reject(new Error("not ready"));
    if(!S._user){ location.href = "./signin.html?next=pricing.html"; return Promise.resolve(); }
    return S.client.functions.invoke("create-checkout", { body: { plan: plan, origin: location.origin } })
      .then(function(res){
        var url = res && res.data && res.data.url;
        if(url){ location.href = url; }
        else { throw new Error((res && res.data && res.data.error) || "Checkout unavailable — is billing configured?"); }
      });
  };

  // ---- BYOK: bring your own Anthropic key ----
  // Stored ONLY in this browser's localStorage — it is never sent to Flux's
  // servers. When set, Fluxi calls Anthropic directly from the browser on the
  // user's own credits (unlimited, always eligible for the heavy model).
  S.byok = {
    get: function(){ try{ return localStorage.getItem("flux_byok") || ""; }catch(e){ return ""; } },
    set: function(k){ try{ k=(k||"").trim(); if(k) localStorage.setItem("flux_byok", k); else localStorage.removeItem("flux_byok"); }catch(e){} },
    active: function(){ return /^sk-ant-/.test(this.get()); },
    callsToday: function(){ try{ return +(localStorage.getItem("flux_byok_calls_"+_day())||0); }catch(e){ return 0; } },
    _bump: function(){ try{ var k="flux_byok_calls_"+_day(); localStorage.setItem(k, String(1 + (+(localStorage.getItem(k)||0)))); }catch(e){} }
  };
  function _day(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  var BYOK_SYSTEM = "You are Fluxi — the AI desk assistant on the Flux paper-trading site. Warm, sharp, concise trading-desk co-pilot. You continuously scan 250+ US stocks (momentum, undervalued & overvalued, breakouts, rebounds); Kronos — a transformer trained on OHLCV candles (open model: dannyholden17-boop/Kronos) — powers your signals (>+2% BUY, <-2% SELL, else HOLD). Hold normal conversation too. HARD RULES: not a financial advisor, no investment advice; all prices/forecasts are simulated paper-trading; never promise returns; don't invent tickers/prices not in the context; keep answers tight (1-4 sentences) unless depth is asked for.";
  function byokHeavy(q){ q=(q||"").toLowerCase(); if(q.length>200) return true;
    return /\b(brief|deep dive|in.?depth|detailed|analy(ze|sis|se)|thesis|overall|thoughts on|walk me through|explain|breakdown|rundown|report|outlook|compare|comparison|vs\.?|comprehensive|thorough|write (me )?a|memo|strateg|pros and cons|elaborate|summar|research)\b/.test(q); }
  function byokChat(question, context){
    var key = S.byok.get();
    var heavy = byokHeavy(question);
    var ctx = ""; try{ ctx = JSON.stringify(context||{}).slice(0,4000); }catch(e){ ctx = "{}"; }
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: heavy ? "claude-opus-5" : "claude-haiku-4-5-20251001",
        max_tokens: heavy ? 2000 : 500,
        system: BYOK_SYSTEM,
        messages: [{ role: "user", content: "LIVE DESK CONTEXT (simulated):\n" + ctx + "\n\nUSER MESSAGE: " + String(question).slice(0,1200) }]
      })
    }).then(function(r){
      if(!r.ok) throw new Error("byok " + r.status);
      return r.json();
    }).then(function(d){
      var text = (d && d.content || []).filter(function(b){ return b.type==="text"; }).map(function(b){ return b.text; }).join("\n").trim();
      if(!text) return null;
      S.byok._bump();
      return { text: text, byok: true };
    });
  }

  // ---- AI chat (optional LLM upgrade) ----
  // BYOK key present → direct browser call to Anthropic on the user's credits.
  // Otherwise → the `ai-chat` Edge Function on the house key (rate-limited for
  // free users; unlimited for Pro). Returns {text} or null (grounded fallback).
  S.aiChat = function(question, context){
    if(S.byok.active()){
      return byokChat(question, context).catch(function(){
        // bad/expired key or network issue — fall back to the house path
        return serverChat(question, context);
      });
    }
    return serverChat(question, context);
  };
  function serverChat(question, context){
    if(!S.client) return Promise.resolve(null);
    return S.client.functions.invoke("ai-chat", { body: { question: question, context: context||{} } })
      .then(function(res){
        var d = res && res.data;
        if(d && d.text) return { text: d.text, limited: !!d.limited };
        return null;
      }).catch(function(){ return null; });
  }

  // ---- brokerage / feature waitlist ----
  S.joinWaitlist = function(email, broker, source){
    if(!S.client) return Promise.resolve({ ok:false });
    return S.client.from("waitlist").insert({ email: email, broker: broker||null, source: source||"portfolio" })
      .then(function(res){ return { ok: !res.error, error: res.error }; })
      .catch(function(e){ return { ok:false, error:e }; });
  };

  // ---- latest server-generated brief (24/7 pg_cron writes public.briefs) ----
  S.latestBrief = function(){
    if(!S.client) return Promise.resolve(null);
    return S.client.from("briefs").select("tone,headline,under,over,text,created_at")
      .order("id", { ascending: false }).limit(1).then(function(res){
        return (res && res.data && res.data[0]) || null;
      }).catch(function(){ return null; });
  };

  // ---- daily AI trade ideas (RLS-gated: anon sees only idx=1, the free teaser) ----
  // Returns { day, ideas:[...], total, signedIn }. `ideas` is what THIS viewer may see;
  // `total` (via a SECURITY DEFINER rpc) is the full count so we can show how many are locked.
  S.tradeIdeas = function(){
    if(!S.client) return Promise.resolve(null);
    return Promise.resolve(S.client.rpc("ideas_today")).then(function(meta){
      var m = meta && meta.data && meta.data[0];
      var day = m && m.day;
      var total = (m && +m.total) || 0;
      if(!day){
        // fall back to the newest day the viewer can see
        return S.client.from("trade_ideas").select("day").order("day",{ascending:false}).limit(1)
          .then(function(r){ var d = r&&r.data&&r.data[0]&&r.data[0].day; return d ? load(d, 0) : { day:null, ideas:[], total:0, signedIn:!!S._user }; });
      }
      return load(day, total);
    }).catch(function(){ return null; });
    function load(day, total){
      return S.client.from("trade_ideas")
        .select("idx,ticker,name,sector,kind,direction,price,target,conviction,horizon,headline,thesis,catalyst,risk")
        .eq("day", day).order("idx",{ascending:true})
        .then(function(res){
          var ideas = (res&&res.data)||[];
          return { day:day, ideas:ideas, total: total || ideas.length, signedIn: !!S._user };
        });
    }
  };

  // ---- Fluxi memory (per-user learning store; jsonb blob) ----
  S.loadMemory = function(){
    if(!S.client || !S._user) return Promise.resolve(null);
    return S.client.from("fluxi_memory").select("data").eq("user_id", S._user.id).maybeSingle()
      .then(function(res){ return (res && res.data && res.data.data) || null; }).catch(function(){ return null; });
  };
  S.saveMemory = function(data){
    if(!S.client || !S._user) return Promise.resolve(false);
    return S.client.from("fluxi_memory").upsert({ user_id: S._user.id, data: data, updated_at: new Date().toISOString() })
      .then(function(){ return true; }).catch(function(){ return false; });
  };

  // ---- profile ----
  S.updateName = function(name){
    if(!S.client || !S._user || !name) return Promise.resolve();
    return S.client.auth.updateUser({ data: { full_name: name } }).then(function(){
      S._user.name = name; window.__fluxUser = S._user;
      if(window.FLUX && window.FLUX.initAuth){ try{ window.FLUX.initAuth(); }catch(e){} }
      return S.client.from("profiles").update({ display_name: name }).eq("id", S._user.id);
    }).catch(function(){});
  };

  // ---- watchlist persistence (server-backed FLUXWatch) ----
  S.hydrateWatch = function(){
    if(!S.client || !S._user || !window.FLUXWatch) return Promise.resolve();
    return S.client.from("watchlist").select("ticker").eq("user_id", S._user.id).then(function(r){
      if(r && r.data && r.data.length){
        try{ localStorage.setItem("flux_watch", JSON.stringify(r.data.map(function(x){ return x.ticker; }))); }catch(e){}
        try{ window.dispatchEvent(new Event("flux-watch")); }catch(e){}
      }
    }).catch(function(){});
  };
  S.wrapWatch = function(){
    if(!window.FLUXWatch || window.FLUXWatch.__wrapped) return;
    var W = window.FLUXWatch, oa = W.add.bind(W), orm = W.remove.bind(W);
    W.add = function(t){ var r = oa(t); if(S.client && S._user) S.client.from("watchlist").upsert({ user_id:S._user.id, ticker:(t||"").toUpperCase() }).then(function(){}); return r; };
    W.remove = function(t){ var r = orm(t); if(S.client && S._user) S.client.from("watchlist").delete().eq("user_id",S._user.id).eq("ticker",(t||"").toUpperCase()).then(function(){}); return r; };
    W.__wrapped = true;
  };

  // ---- onboarding flag (stored on the profile) ----
  S.setOnboarded = function(){
    try{ localStorage.setItem("flux_onboarded","1"); }catch(e){}
    if(S.client && S._user) S.client.from("profiles").update({ onboarded: true }).eq("id", S._user.id).then(function(){}).catch(function(){});
  };
  S.isOnboarded = function(){ try{ return localStorage.getItem("flux_onboarded")==="1"; }catch(e){ return false; } };

  // ---- notification preferences (server-backed, so the scheduled jobs can act) ----
  S.getPrefs = function(){
    if(!S.client || !S._user) return Promise.resolve(null);
    return S.client.from("user_prefs").select("daily_brief,price_alerts,email").eq("user_id", S._user.id).maybeSingle()
      .then(function(r){ return (r && r.data) || null; }).catch(function(){ return null; });
  };
  S.savePrefs = function(p){
    if(!S.client || !S._user) return Promise.resolve({ ok:false });
    var row = { user_id:S._user.id, email:(S._user.email||null), updated_at:new Date().toISOString() };
    if(p && p.daily_brief != null) row.daily_brief = !!p.daily_brief;
    if(p && p.price_alerts != null) row.price_alerts = !!p.price_alerts;
    return S.client.from("user_prefs").upsert(row).then(function(r){ return { ok: !(r && r.error) }; }).catch(function(){ return { ok:false }; });
  };

  // ---- price alerts (server-backed; the email-alerts cron reads these) ----
  S.priceAlerts = function(){
    if(!S.client || !S._user) return Promise.resolve([]);
    return S.client.from("price_alerts").select("id,ticker,op,price,active,created_at,triggered_at")
      .eq("user_id", S._user.id).order("created_at",{ascending:false})
      .then(function(r){ return (r && r.data) || []; }).catch(function(){ return []; });
  };
  S.addAlert = function(ticker, op, price){
    if(!S.client || !S._user) return Promise.resolve({ ok:false, msg:"Sign in to set alerts." });
    ticker = (ticker||"").toUpperCase(); op = (op==="below")?"below":"above"; price = +price;
    if(!ticker || !(price>0)) return Promise.resolve({ ok:false, msg:"Enter a ticker and a price." });
    return S.client.from("price_alerts").insert({ user_id:S._user.id, ticker:ticker, op:op, price:price, active:true })
      .then(function(r){ S.savePrefs({ price_alerts:true }); return { ok: !(r && r.error) }; })
      .catch(function(){ return { ok:false }; });
  };
  S.removeAlert = function(id){
    if(!S.client || !S._user) return Promise.resolve({ ok:false });
    return S.client.from("price_alerts").delete().eq("user_id",S._user.id).eq("id",id)
      .then(function(r){ return { ok: !(r && r.error) }; }).catch(function(){ return { ok:false }; });
  };

  window.FluxSupa = S;
})();
