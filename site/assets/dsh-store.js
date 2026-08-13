/* ============================================================
   DSH Sentinel — state layer
   A persistent, event-driven store backed by localStorage.
   Powers every working feature: flags, paper positions,
   watchlist, activity log, and a live-ticking price engine.
   Falls back to in-memory if storage is unavailable.
   ============================================================ */
(function(){
  "use strict";
  const KEY = "dsh.state.v3";

  // Seed prices for every symbol the desk knows about.
  const BASE_PRICES = {
    NVDA:185.42, AMD:172.90, TSLA:241.18, AAPL:226.40, MSFT:430.12,
    SMCI:902.55, META:508.10, COIN:245.20, PLTR:42.80, AMZN:201.34,
    GOOG:176.50, SPY:561.20, QQQ:486.30, MARA:18.40, NFLX:632.10
  };

  function nowISO(){ return new Date().toISOString(); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function defaults(){
    const prices = {};
    Object.keys(BASE_PRICES).forEach(s => prices[s] = BASE_PRICES[s]);
    return {
      cash: 100000,
      startEquity: 100000,
      watchlist: ["NVDA","AMD","TSLA","SMCI","META"],
      flags: [],       // {id, sym, sev, engine, mv, insight, conf, ts}
      positions: [],   // {id, sym, side, qty, entry, ts, status:'open'|'closed', exit?, closedTs?}
      activity: [],    // {id, ts, kind, text, sym?}
      prices,
      dismissed: [],   // finding signatures the user dismissed this session
      orders: [],      // open orders: {id, ts, sym, side, type:'limit'|'stop', qty, px, tif}
      fills: [],       // order history: {id, ts, sym, side, type, qty, px, note}
      alerts: []       // {id, ts, sym, dir:'above'|'below', px, triggered:false, triggeredTs?}
    };
  }

  let storageOK = true;
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      // ensure new fields exist across versions
      const d = defaults();
      return Object.assign(d, s, { prices: Object.assign(d.prices, s.prices||{}) });
    }catch(e){ storageOK = false; return null; }
  }
  function persist(){
    if(!storageOK) return;
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }
    catch(e){ storageOK = false; }
  }

  let state = load() || defaults();
  const listeners = new Set();
  function emit(evt){ listeners.forEach(fn => { try{ fn(evt, state); }catch(e){} }); }

  /* -------- price engine -------- */
  let live = false;               // true when a real feed is driving prices
  let lastPersist = 0;
  function priceOf(sym){
    if(state.prices[sym] == null) state.prices[sym] = BASE_PRICES[sym] || (50 + Math.random()*200);
    return state.prices[sym];
  }
  function tick(){
    if(live) return;              // a real feed is in control; don't simulate
    // gentle random walk on every known price
    Object.keys(state.prices).forEach(s=>{
      const p = state.prices[s];
      const vol = p * 0.0015;                // ~0.15% per tick
      const drift = (Math.random()-0.5) * 2 * vol;
      state.prices[s] = Math.max(0.5, +(p + drift).toFixed(2));
    });
    checkOrdersAndAlerts();
    persist();
    emit("prices");
  }

  /* -------- order engine: fill open orders / trigger alerts on price -------- */
  function fillOrder(o, px){
    state.orders = state.orders.filter(x=>x.id!==o.id);
    const pos = { id:uid(), ts:nowISO(), sym:o.sym, side:o.side, qty:o.qty, entry:px, status:"open" };
    state.positions.unshift(pos);
    if(o.side==="buy") state.cash -= px*o.qty;
    state.fills.unshift({ id:uid(), ts:nowISO(), sym:o.sym, side:o.side, type:o.type, qty:o.qty, px:px, note:o.type+" filled" });
    log("trade", o.type.toUpperCase()+" "+o.side+" filled: "+o.qty+" "+o.sym+" @ $"+px.toFixed(2), o.sym);
    emit("positions"); emit("orders"); emit("activity");
  }
  function checkOrdersAndAlerts(){
    // open orders
    state.orders.slice().forEach(o=>{
      const px = priceOf(o.sym);
      const buy = o.side==="buy";
      if(o.type==="limit" && ((buy && px<=o.px) || (!buy && px>=o.px))) fillOrder(o, o.px);
      else if(o.type==="stop" && ((buy && px>=o.px) || (!buy && px<=o.px))) fillOrder(o, px);
    });
    // alerts
    state.alerts.forEach(a=>{
      if(a.triggered) return;
      const px = priceOf(a.sym);
      if((a.dir==="above" && px>=a.px) || (a.dir==="below" && px<=a.px)){
        a.triggered = true; a.triggeredTs = nowISO();
        log("alert", a.sym+" crossed "+(a.dir==="above"?"above":"below")+" $"+a.px.toFixed(2), a.sym);
        emit("alert-fired"); emit("alerts"); emit("activity");
      }
    });
  }
  // A real feed calls this with each new print. Persist is throttled so a
  // fast tape doesn't hammer localStorage; prices always emit immediately.
  function setPrice(sym, px){
    if(!(px > 0)) return;
    state.prices[sym] = +px;
    checkOrdersAndAlerts();
    const now = Date.now();
    if(now - lastPersist > 2000){ lastPersist = now; persist(); }
    emit("prices");
  }

  /* -------- portfolio math -------- */
  function positionPnl(pos){
    const cur = pos.status === "closed" ? pos.exit : priceOf(pos.sym);
    const dir = pos.side === "buy" ? 1 : -1;
    const pnl = (cur - pos.entry) * pos.qty * dir;
    const cost = pos.entry * pos.qty;
    return { cur, pnl, cost, pct: cost ? (pnl/cost)*100 : 0 };
  }
  function portfolio(){
    const open = state.positions.filter(p=>p.status==="open");
    let invested = 0, openPnl = 0, marketValue = 0;
    open.forEach(p=>{
      const m = positionPnl(p);
      invested += m.cost; openPnl += m.pnl; marketValue += m.cur * p.qty;
    });
    const realized = state.positions.filter(p=>p.status==="closed")
      .reduce((a,p)=>a + positionPnl(p).pnl, 0);
    const equity = state.cash + marketValue;
    return { open, invested, openPnl, realized, marketValue, equity,
             cash: state.cash, totalPnl: equity - state.startEquity };
  }

  /* -------- activity -------- */
  function log(kind, text, sym){
    state.activity.unshift({ id:uid(), ts:nowISO(), kind, text, sym });
    if(state.activity.length > 200) state.activity.length = 200;
  }

  /* -------- public API -------- */
  const API = {
    BASE_PRICES,
    subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
    state(){ return state; },
    price: priceOf,
    setPrice: setPrice,
    startPriceEngine(ms){ setInterval(tick, ms||3000); },
    setLive(b){ live = !!b; emit("feed"); },
    isLive(){ return live; },
    knownSymbols(){ return Object.keys(state.prices); },
    fmt$(n){ return (n<0?"-":"") + "$" + Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); },
    fmtSigned(n){ return (n>=0?"+":"-") + "$" + Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); },

    /* watchlist */
    isWatched(sym){ return state.watchlist.includes(sym); },
    toggleWatch(sym){
      const i = state.watchlist.indexOf(sym);
      if(i>=0){ state.watchlist.splice(i,1); log("watch","Removed "+sym+" from watchlist", sym); }
      else { state.watchlist.unshift(sym); log("watch","Added "+sym+" to watchlist", sym); }
      priceOf(sym); persist(); emit("watchlist"); emit("activity");
      return this.isWatched(sym);
    },

    /* flags */
    isFlagged(sym){ return state.flags.some(f=>f.sym===sym); },
    flag(f){
      var sym = f && (f.sym || f.t);
      if(!sym) return false;
      if(state.flags.some(x=>x.sym===sym)){ return false; }
      state.flags.unshift({ id:uid(), ts:nowISO(), sym:sym, sev:f.s||f.sev||"info",
        engine:f.e||f.engine||"", mv:f.mv||"", insight:f.i||f.insight||"", conf:f.c||f.conf||0 });
      priceOf(sym); log("flag","Flagged "+sym+" ("+(f.e||f.engine||"")+")", sym);
      persist(); emit("flags"); emit("activity"); return true;
    },
    unflag(sym){
      state.flags = state.flags.filter(f=>f.sym!==sym);
      log("flag","Unflagged "+sym, sym); persist(); emit("flags"); emit("activity");
    },

    /* paper trades */
    openPosition({sym, side, qty}){
      const entry = priceOf(sym);
      const cost = entry * qty;
      const pos = { id:uid(), ts:nowISO(), sym, side, qty, entry, status:"open" };
      state.positions.unshift(pos);
      if(side==="buy") state.cash -= cost;
      state.fills.unshift({ id:uid(), ts:nowISO(), sym, side, type:"market", qty, px:entry, note:"market filled" });
      log("trade", (side==="buy"?"Bought ":"Sold short ") + qty + " " + sym + " @ " + this.fmt$(entry), sym);
      persist(); emit("positions"); emit("orders"); emit("activity"); return pos;
    },

    /* advanced orders */
    placeOrder({sym, side, type, qty, px, tif}){
      priceOf(sym);
      if(type==="market") return this.openPosition({sym, side, qty});
      const o = { id:uid(), ts:nowISO(), sym, side, type, qty, px:+px, tif:tif||"Day" };
      state.orders.unshift(o);
      log("order", type.toUpperCase()+" "+side+" placed: "+qty+" "+sym+" @ $"+(+px).toFixed(2)+" ("+o.tif+")", sym);
      persist(); emit("orders"); emit("activity"); return o;
    },
    cancelOrder(id){
      const o = state.orders.find(x=>x.id===id); if(!o) return;
      state.orders = state.orders.filter(x=>x.id!==id);
      state.fills.unshift({ id:uid(), ts:nowISO(), sym:o.sym, side:o.side, type:o.type, qty:o.qty, px:o.px, note:"canceled" });
      log("order","Canceled "+o.type+" "+o.side+" "+o.qty+" "+o.sym, o.sym);
      persist(); emit("orders"); emit("activity");
    },

    /* price alerts */
    addAlert(sym, dir, px){
      priceOf(sym);
      const a = { id:uid(), ts:nowISO(), sym, dir, px:+px, triggered:false };
      state.alerts.unshift(a);
      log("alert","Alert set: "+sym+" "+dir+" $"+(+px).toFixed(2), sym);
      persist(); emit("alerts"); emit("activity"); return a;
    },
    removeAlert(id){
      state.alerts = state.alerts.filter(a=>a.id!==id);
      persist(); emit("alerts");
    },
    closePosition(id){
      const pos = state.positions.find(p=>p.id===id);
      if(!pos || pos.status==="closed") return;
      const m = positionPnl(pos);
      pos.status="closed"; pos.exit=m.cur; pos.closedTs=nowISO();
      if(pos.side==="buy") state.cash += m.cur * pos.qty;
      else state.cash += (pos.entry - m.cur) * pos.qty + pos.entry*pos.qty; // return short proceeds +/- pnl
      log("trade","Closed "+pos.qty+" "+pos.sym+" @ "+this.fmt$(m.cur)+"  ("+(m.pnl>=0?"+":"")+this.fmt$(m.pnl).replace("$","$")+")", pos.sym);
      persist(); emit("positions"); emit("activity");
    },
    positionPnl, portfolio,

    /* dismissed findings (session feed) */
    dismiss(sig){ if(!state.dismissed.includes(sig)) state.dismissed.push(sig); log("dismiss","Dismissed a signal"); persist(); emit("activity"); },
    isDismissed(sig){ return state.dismissed.includes(sig); },

    /* reset for demos */
    reset(){ state = defaults(); persist(); emit("reset"); emit("prices"); },

    log(kind,text,sym){ log(kind,text,sym); persist(); emit("activity"); }
  };

  window.DSHStore = API;
})();
