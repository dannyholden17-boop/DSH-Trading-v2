/* ============================================================
   DSH Sentinel — shared behavior
   Nav, theme toggle, scroll reveals, and the live "Sentinel"
   feed engine used by the hero demo and the full app.
   ============================================================ */
(function(){
  "use strict";
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const rnd = a => a[Math.floor(Math.random()*a.length)];
  const ri  = (a,b)=>Math.floor(a+Math.random()*(b-a+1));
  window.DSH = window.DSH || {};
  DSH.$=$; DSH.$$=$$; DSH.rnd=rnd; DSH.ri=ri;

  /* ---- nav scroll state ---- */
  const nav = $(".nav");
  if(nav){
    const onScroll = ()=>nav.classList.toggle("scrolled", window.scrollY>12);
    onScroll(); window.addEventListener("scroll", onScroll, {passive:true});
  }

  /* ---- theme toggle ---- */
  DSH.initTheme = function(){
    const btn = $("[data-theme-toggle]");
    if(!btn) return;
    let saved = null;
    try{ saved = localStorage.getItem("dsh-theme"); }catch(e){}
    if(saved) document.documentElement.setAttribute("data-theme", saved);
    const sync = ()=>{
      const explicit = document.documentElement.getAttribute("data-theme");
      const dark = explicit ? explicit==="dark"
        : matchMedia("(prefers-color-scheme:dark)").matches;
      btn.textContent = dark ? "☀" : "☾";
      btn.setAttribute("aria-label", dark?"Switch to light":"Switch to dark");
    };
    sync();
    btn.addEventListener("click", ()=>{
      const explicit = document.documentElement.getAttribute("data-theme");
      const dark = explicit ? explicit==="dark"
        : matchMedia("(prefers-color-scheme:dark)").matches;
      const next = dark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try{ localStorage.setItem("dsh-theme", next); }catch(e){}
      sync();
    });
  };

  /* ---- reveal on scroll ---- */
  DSH.initReveal = function(){
    const els = $$(".reveal");
    if(!("IntersectionObserver" in window) || !els.length){ els.forEach(e=>e.classList.add("in")); return; }
    const io = new IntersectionObserver((ents)=>{
      ents.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }});
    },{threshold:.14, rootMargin:"0px 0px -8% 0px"});
    els.forEach((e,i)=>{ e.style.transitionDelay=(Math.min(i%6,5)*60)+"ms"; io.observe(e); });
  };

  /* ---- animated number counters ---- */
  DSH.initCounters = function(){
    const els = $$("[data-count]");
    if(!els.length) return;
    const run = el=>{
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split(".")[1]||"").length;
      const suf = el.dataset.suffix||""; const pre = el.dataset.prefix||"";
      let t0=null, dur=1400;
      const step = ts=>{
        if(!t0) t0=ts; const p=Math.min((ts-t0)/dur,1);
        const e = 1-Math.pow(1-p,3);
        el.textContent = pre + (target*e).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec}) + suf;
        if(p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if(!("IntersectionObserver" in window)){ els.forEach(run); return; }
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){run(e.target);io.unobserve(e.target);}}),{threshold:.6});
    els.forEach(e=>io.observe(e));
  };

  /* ---- Sentinel data: engines + findings pool ---- */
  DSH.ENGINES = [
    {id:"Scanner",   ic:"⌖", tasks:["sweeping 6,412 tickers","ranking breakouts","gap scan · pre-market","flagging volume spikes"]},
    {id:"Catalyst",  ic:"◈", tasks:["parsing 8-K filings","scoring earnings drift","reading the news wire","FDA calendar check"]},
    {id:"Options",   ic:"⟁", tasks:["scanning sweeps","unusual OI delta","building gamma map","put/call skew"]},
    {id:"Technicals",ic:"△", tasks:["MACD cross scan","RSI divergence","VWAP reclaim check","support / resistance"]},
    {id:"Risk",      ic:"⊘", tasks:["position drawdown","correlation to SPX","stop-loss watch","exposure by sector"]},
    {id:"Backtest",  ic:"⧗", tasks:["replaying 5y history","validating setup","edge-decay check","walk-forward test"]},
  ];
  DSH.FINDINGS = [
    {t:"NVDA",e:"Options",s:"high",u:1,mv:"+2.1%",i:"Massive <b>call sweep</b>, 14,200 contracts at $185, 3DTE, all at ask (~$4.6M premium).",st:[["IV","62%"],["OI Δ","+38%"],["Vol","4.1×"]],c:88},
    {t:"AMD", e:"Scanner",s:"med",u:1,mv:"+3.4%",i:"Breaking out of a 6-week base on <b>2.7× volume</b>. Cleared $172, room to $186.",st:[["RelVol","2.7×"],["ATR","4.8"],["Base","41d"]],c:74},
    {t:"TSLA",e:"Catalyst",s:"high",u:0,mv:"-1.8%",i:"New 8-K: guidance cut on <b>delivery outlook</b>. Historically a −2.3% 5-day drift.",st:[["Drift","−2.3%"],["n","17"],["Conf","0.71"]],c:69},
    {t:"AAPL",e:"Technicals",s:"info",u:1,mv:"+0.6%",i:"<b>VWAP reclaim</b> after morning flush + MACD bull cross on the 15m. Setup hits 68%.",st:[["Hit","68%"],["R:R","1:2.4"],["Stop","$226"]],c:66},
    {t:"MSFT",e:"Options",s:"med",u:1,mv:"+1.2%",i:"Put/call skew flipped bullish into the cloud update. <b>Gamma wall</b> building at $430.",st:[["Skew","+0.8"],["Wall","$430"],["GEX","high"]],c:71},
    {t:"SMCI",e:"Scanner",s:"high",u:1,mv:"+5.9%",i:"Top <b>1%</b> of the universe for unusual volume. Squeeze: 18% short float, rising.",st:[["Short","18%"],["RelVol","6.2×"],["DTC","3.1"]],c:63},
    {t:"META",e:"Risk",s:"med",u:0,mv:"-0.9%",i:"Your position drawdown hit <b>−4.2%</b>, nearing the −5% stop. Corr to SPX up to 0.81.",st:[["DD","−4.2%"],["Stop","−5%"],["ρ","0.81"]],c:0},
    {t:"COIN",e:"Catalyst",s:"info",u:1,mv:"+4.1%",i:"BTC broke $72k — <b>high-beta proxy</b>. COIN moves 2.4× spot on up-days like this.",st:[["Beta","2.4×"],["BTC","+3.1%"],["ρ","0.88"]],c:70},
    {t:"PLTR",e:"Technicals",s:"info",u:1,mv:"+2.8%",i:"<b>RSI divergence</b> resolved up; 50/200 EMA golden cross confirmed on the daily.",st:[["RSI","61"],["Cross","gold"],["Trend","up"]],c:64},
    {t:"AMZN",e:"Backtest",s:"info",u:1,mv:"+1.0%",i:"Ran the breakout over <b>5 years</b>: 71% win-rate, avg +3.9% / −1.8%, edge stable.",st:[["Win","71%"],["Avg+","3.9%"],["Edge","stable"]],c:76},
    {t:"GOOG",e:"Options",s:"med",u:1,mv:"+1.6%",i:"Unusual <b>call ratio</b> 4.8:1 as the antitrust headline fades. Smart money leaning long.",st:[["C:P","4.8"],["Prem","$2.1M"],["DTE","9"]],c:67},
    {t:"SPY", e:"Risk",s:"info",u:0,mv:"+0.4%",i:"Breadth improving: 63% of the S&P above its 50-DMA. <b>Risk-on</b> tilt confirmed.",st:[["Breadth","63%"],["VIX","13.9"],["Tilt","on"]],c:72},
  ];
  DSH.THOUGHTS = [
    ["scan","6,412 tickers swept · 38 pass filters"],
    ["think","NVDA sweep + rising OI → conviction long, sizing 1.5%"],
    ["catalyst","TSLA 8-K parsed · matched to 17 historical analogs"],
    ["backtest","replaying AMD breakout across 1,260 sessions…"],
    ["risk","META nearing stop · drafting alert"],
    ["think","cross-checking AAPL VWAP setup vs options skew"],
    ["scan","volume anomaly · SMCI top 1% of universe"],
    ["idea","assembling 3 trade ideas for your review"],
    ["think","SPX breadth improving, tilting the book risk-on"],
    ["catalyst","BTC through $72k · re-scoring COIN & MARA"],
    ["backtest","edge on reclaim setup holds · 68% over 5y"],
    ["think","dismissing 4 low-confidence signals · noise"],
  ];
  DSH.SEV = {
    high:{cls:"tag-high",label:"high",color:"var(--bad)"},
    med :{cls:"tag-med", label:"med", color:"var(--warn)"},
    info:{cls:"tag-info",label:"info",color:"var(--mint)"},
  };

  /* Build a finding card element (compact or full) */
  DSH.card = function(f, opts={}){
    const sev = DSH.SEV[f.s];
    const el = document.createElement("article");
    el.className = "finding" + (opts.flash?" flash":"");
    el.dataset.eng = f.e;
    el.style.setProperty("--sev", sev.color);
    const stats = f.st.map(s=>`<span class="fstat mono"><b>${s[1]}</b> ${s[0]}</span>`).join("");
    el.innerHTML = `
      <div class="f-top">
        <span class="f-tkr mono">${f.t}</span>
        <span class="f-move mono ${f.u?'up':'down'}">${f.mv}</span>
        <span class="tag ${sev.cls}">${sev.label}</span>
        <span class="f-src mono"><i></i>${f.e}</span>
      </div>
      <p class="f-insight">${f.i}</p>
      <div class="f-stats">${stats}</div>
      ${f.c?`<div class="f-conf"><div class="f-bar"><i style="width:${f.c}%"></i></div><span class="mono">confidence ${f.c}%</span></div>`:""}
      ${opts.actions!==false?`<div class="f-acts">
        <button class="act act-primary">Dig in</button>
        <button class="act">Paper trade</button>
        <button class="act">Backtest</button>
        <button class="act">Watch</button>
      </div>`:""}`;
    return el;
  };

  /* Wire delegated action feedback on a feed container */
  DSH.wireActions = function(container){
    container.addEventListener("click", e=>{
      const t = e.target.closest(".act"); if(!t) return;
      const old=t.textContent;
      t.textContent = old==="Dig in"?"Opening…":old==="Watch"?"Watching ✓":old+" ✓";
      t.classList.add("act-done");
      if(old!=="Dig in") setTimeout(()=>{t.textContent=old;t.classList.remove("act-done");},1400);
    });
  };

  document.addEventListener("DOMContentLoaded",()=>{
    DSH.initTheme(); DSH.initReveal(); DSH.initCounters();
  });
})();
