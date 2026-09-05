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
    {id:"Record",    ic:"⧗", tasks:["checking resolve dates","grading a due call","posting the miss","updating the scoreboard"]},
  ];
  /* ---- findings + inner monologue ----------------------------------------

     DSH.FINDINGS held twelve invented market events, and DSH.THOUGHTS the
     narration to match: an NVDA call sweep with a made-up premium figure, a
     TSLA 8-K cutting delivery guidance, BTC through $72k, and — worst of the
     set — "Ran the breakout over 5 years: 71% win-rate, avg +3.9% / -1.8%,
     edge stable." That is a performance claim, printed on the same product
     that says in as many words that Flux does not backtest.

     They rendered on app.html under "Alpha Signals" with a live tag, and on
     desktop.html as the desk's running commentary. Both are now empty: the
     panels that consumed them show an empty state until a real source fills
     them. The bindings stay so every consumer keeps its shape.  */
  DSH.FINDINGS = [];
  DSH.THOUGHTS = [];

  /* The honest empty state for any panel that renders findings. */
  DSH.noFindings = function(what){
    return '<div class="empty" style="padding:20px"><div class="bg">\u25CE</div>' +
      (what || 'Nothing on the record yet.') +
      ' Flux shows a signal only when a live source produces one.</div>';
  };

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
        <button class="act">The record</button>
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
