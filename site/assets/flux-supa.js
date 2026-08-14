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
      if(S._user){ S.wrapBook(); S.hydrate(); cleanLandingIfNeeded(); }
    });
    S.client.auth.getSession().then(function(r){
      var sess = r && r.data && r.data.session;
      S._user = sess ? mapUser(sess.user) : null; window.__fluxUser = S._user;
      if(window.FLUX && window.FLUX.initAuth){ try{ window.FLUX.initAuth(); }catch(e){} }
      if(S._user){ S.wrapBook(); S.hydrate(); }
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

  window.FluxSupa = S;
})();
