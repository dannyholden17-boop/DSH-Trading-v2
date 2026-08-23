/* ============================================================
   FLUX — shared marketing-site behavior
   Nav state, mobile menu, scroll reveals, counters, and the
   shared demo data used by the interactive sections.
   ============================================================ */
(function(){
  "use strict";
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var F=window.FLUX=window.FLUX||{};
  F.$=$; F.$$=$$;
  F.rnd=function(a){return a[Math.floor(Math.random()*a.length)]};
  F.ri=function(a,b){return Math.floor(a+Math.random()*(b-a+1))};

  F.CY="#00f2ff"; F.VI="#8b5cf6"; F.EM="#10b981"; F.CR="#ef4444"; F.AM="#f5b544";

  /* ---- shared demo signals ---- */
  F.SIGNALS=[
    {t:"NVDA",e:"Options",lbl:"Unusual Flow",mv:"+2.1%",u:1,c:88,
     i:"Call sweep — 14,200 contracts at the $185 strike, 3DTE, all at ask (~$4.6M premium)."},
    {t:"AMD",e:"Scanner",lbl:"Breakout",mv:"+3.4%",u:1,c:74,
     i:"Breaking out of a six-week base on 2.7× average volume. Cleared $172, room to $186."},
    {t:"TSLA",e:"Catalyst",lbl:"Catalyst",mv:"-1.8%",u:0,c:69,
     i:"New 8-K: guidance cut on delivery outlook. Historically a −2.3% five-day drift."},
    {t:"AAPL",e:"Technicals",lbl:"VWAP reclaim",mv:"+0.6%",u:1,c:66,
     i:"Reclaimed VWAP after the morning flush; MACD crossed bullish on the 15-minute."},
    {t:"SMCI",e:"Scanner",lbl:"Squeeze",mv:"+5.9%",u:1,c:63,
     i:"Top 1% of the universe for unusual volume. Short float 18% and rising."},
    {t:"MSFT",e:"Options",lbl:"Gamma wall",mv:"+1.2%",u:1,c:71,
     i:"Put/call skew flipped bullish into the cloud update. Gamma wall building at $430."},
    {t:"COIN",e:"Catalyst",lbl:"High-beta proxy",mv:"+4.1%",u:1,c:70,
     i:"BTC cleared $72k. COIN moves 2.4× spot on up-days like this one."},
    {t:"PLTR",e:"Technicals",lbl:"Divergence",mv:"+2.8%",u:1,c:64,
     i:"RSI divergence resolved higher; 50/200 EMA golden cross confirmed on the daily."}
  ];

  F.ENGINES=[
    {ic:"⌖",id:"Scanner",d:"Sweeps ~6,400 tickers for breakouts, volume spikes, gaps and squeeze conditions.",c:"15s",o:"breakouts"},
    {ic:"◈",id:"Catalyst",d:"Parses filings, earnings and the news wire, and estimates the historical drift.",c:"30s",o:"events"},
    {ic:"⟁",id:"Options",d:"Tracks unusual options activity — sweeps, open-interest shifts, skew and gamma.",c:"10s",o:"flow"},
    {ic:"△",id:"Technicals",d:"Computes indicators across timeframes: crosses, divergences, VWAP and key levels.",c:"20s",o:"levels"},
    {ic:"⊘",id:"Risk",d:"Watches your book — drawdown, correlation, stops and exposure — and gates orders.",c:"5s",o:"guardrails"},
    {ic:"⧗",id:"Backtest",d:"Replays every flagged setup across years of history to prove the edge is real.",c:"on-demand",o:"validation"}
  ];

  F.MODELS=[
    {n:"PriceNet",m:"LSTM v4",d:"Sequence model forecasting next-session moves across your watchlist."},
    {n:"VolRegime",m:"HMM-3",d:"Hidden-Markov classifier that labels the current volatility regime."},
    {n:"NewsSense",m:"FinBERT",d:"Sentiment model scoring every headline that crosses the wire."},
    {n:"MonteCarlo",m:"10k paths",d:"Portfolio simulation for daily VaR and drawdown probability."},
    {n:"AlphaRank",m:"GBM ensemble",d:"Re-scores every live signal against five years of outcomes."},
    {n:"Reporter",m:"Flux-LM",d:"Writes your scheduled desk reports: briefs, pulses and reviews."}
  ];

  /* ---- nav ---- */
  F.initNav=function(){
    var nav=$(".nav");
    if(nav){
      var onScroll=function(){nav.classList.toggle("scrolled",window.scrollY>12)};
      onScroll();window.addEventListener("scroll",onScroll,{passive:true});
    }
    var t=$(".nav-toggle"),links=$(".nav-links");
    if(t&&links){t.addEventListener("click",function(){links.classList.toggle("open")});}
    // mark current page
    var path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
    $$(".nav-links a").forEach(function(a){
      var href=(a.getAttribute("href")||"").split("/").pop().toLowerCase();
      if(href&&href===path)a.classList.add("on");
    });
  };

  /* ---- reveal ---- */
  F.initReveal=function(root){
    var els=$$(".reveal",root||document).filter(function(e){return !e.classList.contains("in")});
    if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});return;}
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    els.forEach(function(e,i){e.style.transitionDelay=(Math.min(i%5,4)*70)+"ms";io.observe(e);});
  };

  /* ---- counters ---- */
  F.initCounters=function(){
    var els=$$("[data-count]");
    if(!els.length)return;
    var run=function(el){
      var target=parseFloat(el.dataset.count),dec=(el.dataset.count.split(".")[1]||"").length;
      var suf=el.dataset.suffix||"",pre=el.dataset.prefix||"",t0=null;
      var step=function(ts){
        if(!t0)t0=ts;var p=Math.min((ts-t0)/1400,1),e=1-Math.pow(1-p,3);
        el.textContent=pre+(target*e).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;
        if(p<1)requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if(!("IntersectionObserver" in window)){els.forEach(run);return;}
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){run(e.target);io.unobserve(e.target);}})},{threshold:.5});
    els.forEach(function(e){io.observe(e)});
  };

  /* ---- signal row markup ---- */
  F.sigHTML=function(s){
    var col=s.u?F.EM:(s.c>=80?F.CY:F.CR);
    return '<div class="sig"><div class="av">'+s.t.slice(0,3)+'</div><div class="mid">'+
      '<div class="tk">'+s.t+' <span>'+s.mv+'</span></div><div class="lbl">'+s.lbl+'</div>'+
      '<div class="bar"><i style="width:'+s.c+'%;background:'+col+'"></i></div></div>'+
      '<div><div class="conf" style="color:'+col+'">'+s.c+'%</div><div class="cl">conf</div></div></div>';
  };

  /* ---- mini candlestick chart (shared) ---- */
  F.seed=function(str){var h=0;for(var i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))%233280;return h||7};
  F.drawCandles=function(cv,seedStr,n,up){
    if(!cv||!cv.clientWidth)return;
    var dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
    cv.width=w*dpr;cv.height=h*dpr;var c=cv.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);
    var r=F.seed(seedStr||"flux");function rr(){r=(r*9301+49297)%233280;return r/233280}
    n=n||40;var price=180,cs=[];
    for(var i=0;i<n;i++){var o=price,cl=Math.max(1,o+(rr()-(up===false?.55:.45))*3.2),
      hi=Math.max(o,cl)+rr()*1.3,lo=Math.min(o,cl)-rr()*1.3;
      cs.push({o:o,h:hi,l:lo,c:cl});price=cl;}
    var mx=-1e9,mn=1e9;cs.forEach(function(k){if(k.h>mx)mx=k.h;if(k.l<mn)mn=k.l});
    var pad=(mx-mn)*.08;mx+=pad;mn-=pad;
    var cw=w/n,bw=Math.max(2,cw*.6);
    function X(i){return i*cw+cw/2}function Y(p){return 8+(h-16)*(1-(p-mn)/(mx-mn))}
    for(var g=1;g<4;g++){c.strokeStyle="rgba(255,255,255,.05)";c.beginPath();c.moveTo(0,h*g/4);c.lineTo(w,h*g/4);c.stroke();}
    c.beginPath();
    for(i=0;i<n;i++){var s=0,cnt=0;for(var j=Math.max(0,i-7);j<=i;j++){s+=cs[j].c;cnt++;}
      var ma=s/cnt;i?c.lineTo(X(i),Y(ma)):c.moveTo(X(i),Y(ma));}
    c.strokeStyle="rgba(139,92,246,.8)";c.lineWidth=1.4;c.stroke();
    cs.forEach(function(k,i){var u=k.c>=k.o,col=u?F.EM:F.CR;c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1;
      c.beginPath();c.moveTo(X(i),Y(k.h));c.lineTo(X(i),Y(k.l));c.stroke();
      var yo=Y(k.o),yc=Y(k.c);c.fillRect(X(i)-bw/2,Math.min(yo,yc),bw,Math.max(1,Math.abs(yc-yo)));});
    var last=cs[n-1].c,yL=Y(last);
    c.strokeStyle="rgba(0,242,255,.5)";c.setLineDash([3,3]);
    c.beginPath();c.moveTo(0,yL);c.lineTo(w,yL);c.stroke();c.setLineDash([]);
  };

  /* ---- area line chart (shared) ---- */
  F.drawArea=function(cv,seedStr,n,up,color){
    if(!cv||!cv.clientWidth)return;
    var dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
    cv.width=w*dpr;cv.height=h*dpr;var c=cv.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);
    color=color||F.CY;
    var r=F.seed(seedStr||"a"),data=[],v=0;n=n||44;
    function rr(){r=(r*9301+49297)%233280;return r/233280}
    for(var i=0;i<n;i++){v+=(rr()-.5)*2+(up===false?-.15:.34);data.push(v)}
    var mn=Math.min.apply(null,data),mx=Math.max.apply(null,data),rg=(mx-mn)||1,pad=8;
    function X(i){return pad+i*(w-2*pad)/(n-1)}function Y(x){return pad+(h-2*pad)*(1-(x-mn)/rg)}
    var g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,color+"3a");g.addColorStop(1,color+"00");
    c.beginPath();c.moveTo(X(0),Y(data[0]));for(i=1;i<n;i++)c.lineTo(X(i),Y(data[i]));
    c.lineTo(X(n-1),h);c.lineTo(X(0),h);c.closePath();c.fillStyle=g;c.fill();
    c.beginPath();c.moveTo(X(0),Y(data[0]));for(i=1;i<n;i++)c.lineTo(X(i),Y(data[i]));
    c.strokeStyle=color;c.lineWidth=2.2;c.lineJoin="round";c.shadowColor=color;c.shadowBlur=10;c.stroke();c.shadowBlur=0;
    c.beginPath();c.arc(X(n-1),Y(data[n-1]),3,0,7);c.fillStyle=color;c.fill();
  };

  /* ---- FX: aurora backdrop, scroll progress, tilt, marquee ---- */
  F.reduced=function(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches};

  /* Animated "synthetic intelligence terminal" background: a dark liquid field
     with faint neon-cyan scanlines. Full-screen WebGL quad, fixed behind content.
     Silently no-ops if WebGL is unavailable (aurora fallback remains). */
  F.initShader=function(body){
    var canvas=document.createElement("canvas");
    canvas.className="fx-shader";canvas.setAttribute("aria-hidden","true");
    var gl=null;
    try{ gl=canvas.getContext("webgl")||canvas.getContext("experimental-webgl"); }catch(e){ gl=null; }
    if(!gl){ return; } // keep aurora fallback
    body.insertBefore(canvas,body.firstChild);
    var vsrc="attribute vec2 position;varying vec2 vUv;void main(){vUv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}";
    var fsrc=[
      "precision highp float;varying vec2 vUv;uniform float u_time;uniform vec2 u_res;",
      "void main(){",
      "  vec2 uv=vUv;vec2 p=-1.0+2.0*uv;p.x*=u_res.x/u_res.y;",
      "  float t=u_time*0.35;",
      "  for(float i=1.0;i<4.0;i++){",
      "    p.x+=0.28/i*sin(i*3.0*p.y+t+i*1.5);",
      "    p.y+=0.28/i*sin(i*3.0*p.x+t+i*1.2);",
      "  }",
      "  float v=0.5+0.5*sin(p.x+p.y);",
      "  vec3 base=vec3(0.008,0.024,0.055);",              // deep-midnight #020617-ish
      "  vec3 color=mix(base,vec3(0.02,0.42,0.52),v*0.30);",
      "  color+=vec3(0.02,0.71,0.83)*abs(0.006/(sin(uv.y*10.0+t)+1.12))*0.45;", // scanline glow
      "  gl_FragColor=vec4(color,1.0);",
      "}"
    ].join("\n");
    function mk(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
    var prog=gl.createProgram();
    gl.attachShader(prog,mk(gl.VERTEX_SHADER,vsrc));
    gl.attachShader(prog,mk(gl.FRAGMENT_SHADER,fsrc));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ canvas.remove(); return; }
    gl.useProgram(prog);
    var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(prog,"position");
    gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    var uT=gl.getUniformLocation(prog,"u_time"),uR=gl.getUniformLocation(prog,"u_res");
    var dpr=Math.min(window.devicePixelRatio||1,1.5),running=true;
    function size(){
      var w=Math.floor(canvas.clientWidth*dpr),h=Math.floor(canvas.clientHeight*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    }
    // pause when tab hidden to save battery
    document.addEventListener("visibilitychange",function(){running=!document.hidden;if(running)requestAnimationFrame(frame);});
    function frame(ts){
      if(!running)return;
      size();
      gl.uniform1f(uT,ts*0.001);gl.uniform2f(uR,canvas.width,canvas.height);
      gl.drawArrays(gl.TRIANGLES,0,6);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  F.initFX=function(){
    var body=document.body;
    // animated aurora backdrop (once) — fallback layer behind the shader
    if(!F.reduced()&&!$(".fx-aurora")){
      var a=document.createElement("div");a.className="fx-aurora";a.setAttribute("aria-hidden","true");
      a.innerHTML="<b></b><b></b><b></b>";body.insertBefore(a,body.firstChild);
    }
    // animated WebGL "terminal void" shader backdrop (once) — the signature backdrop
    if(!F.reduced()&&!$(".fx-shader")){ F.initShader(body); }
    // scroll progress bar (once)
    if(!$(".fx-progress")){
      var bar=document.createElement("div");bar.className="fx-progress";bar.setAttribute("aria-hidden","true");
      body.insertBefore(bar,body.firstChild);
      var onS=function(){
        var d=document.documentElement,max=(d.scrollHeight-d.clientHeight)||1;
        bar.style.width=Math.min(100,(d.scrollTop/max)*100)+"%";
      };
      onS();window.addEventListener("scroll",onS,{passive:true});window.addEventListener("resize",onS);
    }
    // seamless marquees — duplicate track content once
    $$(".marquee-track").forEach(function(t){
      if(t.getAttribute("data-dup"))return;t.setAttribute("data-dup","1");t.innerHTML=t.innerHTML+t.innerHTML;
    });
    // 3d tilt on .tilt elements
    if(!F.reduced()){
      $$(".tilt").forEach(function(el){
        el.addEventListener("mousemove",function(e){
          var r=el.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;
          el.style.setProperty("--ry",(px*10).toFixed(2)+"deg");
          el.style.setProperty("--rx",(-py*10).toFixed(2)+"deg");
        });
        el.addEventListener("mouseleave",function(){el.style.setProperty("--rx","0deg");el.style.setProperty("--ry","0deg");});
      });
    }
  };

  /* ---- Auth (client-side demo session) ---- */
  F.Auth={
    KEY:"flux_user",
    supa:function(){return !!window.FluxSupa;},
    get:function(){
      if(this.supa())return window.__fluxUser||null;            // real Supabase session
      try{return JSON.parse(localStorage.getItem(this.KEY))}catch(e){return null} // legacy demo fallback
    },
    signIn:function(name,email){ // legacy demo only (no Supabase)
      var u={name:(name||((email||"Trader").split("@")[0]||"Trader")),email:(email||""),since:Date.now()};
      try{localStorage.setItem(this.KEY,JSON.stringify(u))}catch(e){}
      return u;
    },
    signOut:function(){
      try{localStorage.removeItem(this.KEY)}catch(e){}
      if(this.supa()&&window.FluxSupa.signOut){try{return window.FluxSupa.signOut()}catch(e){}}
    },
    // true when this load is an OAuth / magic-link redirect landing (SDK still parsing the URL)
    landing:function(){return /access_token|[?&]code=/.test(location.hash+location.search);},
    guard:function(){
      if(this.landing())return true;                            // let the SDK finish establishing the session
      if(!this.get()){
        var here=(location.pathname.split("/").pop()||"dashboard.html");
        location.replace("./signin.html?next="+encodeURIComponent(here));
        return false;
      }
      return true;
    }
  };
  window.FLUXAuth=F.Auth;

  /* ---- prices + paper-trading book (client-side, simulated) ---- */
  F.PRICES={NVDA:225.38,AMD:482.89,TSLA:340.04,AAPL:305.31,MSFT:496.84,SMCI:39.16,
    COIN:153.76,PLTR:179.01,AMZN:265.16,META:594.73,GOOGL:346.42,NFLX:78.23,AVGO:417.83,
    SPY:777.77,QQQ:732.06,MU:949.89,ARM:278.45,INTC:104.63,MARA:9.22,SOFI:18.42,
    DELL:494.21,CRM:201.32,ORCL:156.30,UBER:75.87};
  F.NAMES={NVDA:"NVIDIA",AMD:"Advanced Micro Devices",TSLA:"Tesla",AAPL:"Apple",MSFT:"Microsoft",
    SMCI:"Super Micro Computer",COIN:"Coinbase",PLTR:"Palantir",AMZN:"Amazon",META:"Meta Platforms",
    GOOGL:"Alphabet",NFLX:"Netflix",AVGO:"Broadcom",SPY:"SPDR S&P 500 ETF",QQQ:"Invesco QQQ",
    MU:"Micron Technology",ARM:"Arm Holdings",INTC:"Intel",MARA:"MARA Holdings",SOFI:"SoFi Technologies",
    DELL:"Dell Technologies",CRM:"Salesforce",ORCL:"Oracle",UBER:"Uber"};
  // Live server prices override this when flux-supa.js has hydrated them.
  F.LIVE=null; // {TICKER:{last,prev_close,name}}
  F.priceOf=function(t){
    t=(t||"").toUpperCase();
    if(F.LIVE&&F.LIVE[t]&&F.LIVE[t].last)return +(+F.LIVE[t].last).toFixed(2);
    var b=F.PRICES[t];if(!b)return null;
    var min=Math.floor(Date.now()/60000),r=F.seed(t+"|"+min),f=((r%2000)/2000-0.5)*0.014;
    return +(b*(1+f)).toFixed(2);
  };
  F.prevClose=function(t){t=(t||"").toUpperCase();
    if(F.LIVE&&F.LIVE[t]&&F.LIVE[t].prev_close)return +F.LIVE[t].prev_close;
    return F.PRICES[t]||null;};
  F.Book={
    KEY:"flux_book",
    get:function(){
      var b=null;try{b=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}
      if(!b||b.v!==1){b={v:1,cash:100000,start:100000,positions:{},orders:[]};this.save(b);}
      return b;
    },
    save:function(b){try{localStorage.setItem(this.KEY,JSON.stringify(b))}catch(e){}},
    reset:function(){var b={v:1,cash:100000,start:100000,positions:{},orders:[]};this.save(b);return b;},
    place:function(o){
      var b=this.get(),t=(o.ticker||"").toUpperCase(),qty=Math.floor(+o.qty||0);
      var px=(o.type==="limit"&&+o.limit)?+(+o.limit).toFixed(2):F.priceOf(t);
      if(!t||px==null)return{ok:false,msg:"Unknown symbol."};
      if(qty<1)return{ok:false,msg:"Enter a share quantity."};
      var cost=+(qty*px).toFixed(2),pos=b.positions[t]||{qty:0,avg:0};
      if(o.side==="buy"){
        if(cost>b.cash+0.001)return{ok:false,msg:"Not enough buying power ($"+b.cash.toFixed(2)+")."};
        var nq=pos.qty+qty;pos.avg=+(((pos.qty*pos.avg)+cost)/nq).toFixed(4);pos.qty=nq;b.cash=+(b.cash-cost).toFixed(2);
      }else{
        if(qty>pos.qty)return{ok:false,msg:"You only hold "+pos.qty+" "+t+"."};
        pos.qty-=qty;b.cash=+(b.cash+cost).toFixed(2);if(pos.qty===0)pos.avg=0;
      }
      if(pos.qty>0)b.positions[t]=pos;else delete b.positions[t];
      var ord={id:b.orders.length+1,ts:Date.now(),side:o.side,ticker:t,qty:qty,price:px,type:o.type||"market",status:"filled"};
      b.orders.unshift(ord);if(b.orders.length>60)b.orders.length=60;this.save(b);
      return{ok:true,msg:(o.side==="buy"?"Bought ":"Sold ")+qty+" "+t+" @ $"+px.toFixed(2),order:ord,book:b};
    },
    positionsList:function(){
      var b=this.get(),out=[];
      for(var t in b.positions){var p=b.positions[t],px=F.priceOf(t)||p.avg;
        out.push({ticker:t,qty:p.qty,avg:p.avg,price:px,mkt:+(p.qty*px).toFixed(2),
          pl:+((px-p.avg)*p.qty).toFixed(2),plpct:p.avg?+(((px-p.avg)/p.avg)*100).toFixed(2):0});}
      return out.sort(function(a,c){return c.mkt-a.mkt});
    },
    equity:function(){var b=this.get(),v=b.cash;for(var t in b.positions)v+=b.positions[t].qty*(F.priceOf(t)||b.positions[t].avg);return +v.toFixed(2);}
  };
  window.FLUXBook=F.Book;

  /* ---- shared watchlist ---- */
  F.Watch={
    KEY:"flux_watch",
    get:function(){var a;try{a=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}
      if(!Array.isArray(a)){a=["NVDA","AMD","TSLA","AAPL"];this.save(a);}return a;},
    save:function(a){try{localStorage.setItem(this.KEY,JSON.stringify(a))}catch(e){}},
    add:function(t){t=(t||"").toUpperCase();var a=this.get();if(t&&a.indexOf(t)<0){a.unshift(t);this.save(a);}return a;},
    remove:function(t){t=(t||"").toUpperCase();var a=this.get().filter(function(x){return x!==t});this.save(a);return a;},
    toggle:function(t){return this.has(t)?this.remove(t):this.add(t);},
    has:function(t){return this.get().indexOf((t||"").toUpperCase())>=0;}
  };
  window.FLUXWatch=F.Watch;

  /* ---- price alerts ---- */
  F.Alerts={
    KEY:"flux_alerts",
    get:function(){var a;try{a=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}return Array.isArray(a)?a:[];},
    save:function(a){try{localStorage.setItem(this.KEY,JSON.stringify(a))}catch(e){}},
    add:function(t,op,price){t=(t||"").toUpperCase();price=+price;
      if(!t||!price||F.priceOf(t)==null)return null;
      var a=this.get(),al={id:Date.now()+Math.floor((Date.now()%997)),ticker:t,
        op:(op==="below"?"below":"above"),price:+price.toFixed(2),status:"armed",ts:Date.now()};
      a.unshift(al);this.save(a);return al;},
    remove:function(id){this.save(this.get().filter(function(x){return x.id!==id}));},
    clearTriggered:function(){this.save(this.get().filter(function(x){return x.status==="armed"}));},
    check:function(){
      var a=this.get(),fired=[];
      a.forEach(function(al){if(al.status!=="armed")return;var p=F.priceOf(al.ticker);if(p==null)return;
        if((al.op==="above"&&p>=al.price)||(al.op==="below"&&p<=al.price)){al.status="triggered";al.firedAt=Date.now();al.firedPrice=p;fired.push(al);}});
      if(fired.length)this.save(a);return fired;}
  };
  window.FLUXAlerts=F.Alerts;

  F.initAuth=function(){
    var u=F.Auth.get(),cta=$(".nav-cta");
    if(cta){
      if(u){
        var nm=(u.name||"Trader");
        cta.innerHTML='<a class="btn btn-ghost btn-sm" href="./dashboard.html">Dashboard</a>'+
          '<a class="btn btn-primary btn-sm" href="./account.html" title="'+nm.replace(/"/g,"")+'">'+nm.slice(0,14)+'</a>';
      }else{
        cta.innerHTML='<a class="btn btn-ghost btn-sm" href="./signin.html">Sign in</a>'+
          '<a class="btn btn-primary btn-sm" href="./dashboard.html">Launch app</a>';
      }
    }
    $$("[data-auth-name]").forEach(function(e){e.textContent=u?(u.name||"Trader"):""});
    $$("[data-auth-only]").forEach(function(e){if(!u)e.style.display="none"});
    $$("[data-guest-only]").forEach(function(e){if(u)e.style.display="none"});
    $$("[data-signout]").forEach(function(e){e.addEventListener("click",function(ev){ev.preventDefault();
      var p=F.Auth.signOut();
      if(p&&p.then){p.then(function(){location.href="./index.html";});setTimeout(function(){location.href="./index.html";},800);}
      else location.href="./index.html";
    });});
  };

  document.addEventListener("DOMContentLoaded",function(){
    F.initNav();F.initReveal();F.initCounters();F.initFX();F.initAuth();
  });
})();
