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

  F.CY="#e8b33c"; F.VI="#6f9ad6"; F.EM="#56b97f"; F.CR="#e8674a"; F.AM="#e8b33c";

  /* ---- shared demo signals ---- */
  F.SIGNALS=[
    {t:"NVDA",e:"Options",lbl:"Unusual Flow",mv:"+2.1%",u:1,c:88,
     i:"Call sweep, 14,200 contracts at the $185 strike, 3DTE, all at ask (~$4.6M premium)."},
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
    {ic:"⌖",id:"Scanner",d:"Sweeps the desk's 114-name universe for breakouts, volume spikes, gaps and squeeze conditions.",c:"15s",o:"breakouts"},
    {ic:"◈",id:"Catalyst",d:"Parses filings, earnings and the news wire, and estimates the historical drift.",c:"30s",o:"events"},
    {ic:"⟁",id:"Options",d:"Tracks unusual options activity, sweeps, open-interest shifts, skew and gamma.",c:"10s",o:"flow"},
    {ic:"△",id:"Technicals",d:"Computes indicators across timeframes: crosses, divergences, VWAP and key levels.",c:"20s",o:"levels"},
    {ic:"⊘",id:"Risk",d:"Watches your book, drawdown, correlation, stops and exposure, and gates orders.",c:"5s",o:"guardrails"},
    {ic:"⧗",id:"Backtest",d:"Replays every flagged setup across years of history to prove the edge is real.",c:"on-demand",o:"validation"}
  ];

  /* The models actually in the loop. Named for what runs, not for what
     would sound impressive — the previous list (PriceNet/LSTM v4,
     AlphaRank/"five years of outcomes", NewsSense/FinBERT) described
     nothing that exists. */
  F.MODELS=[
    {n:"The analysts",m:"Claude Haiku 4.5",d:"Three of them, one lens each. Read a name and file a dated prediction with the evidence behind it."},
    {n:"The traders",m:"Claude Haiku 4.5",d:"The analysts' boss. Read every filing against that analyst's own record and pass on only what they would take."},
    {n:"The executive",m:"Claude Opus 5",d:"Rules on what survives: approve, cut the size, or refuse, with the reason on the record."},
    {n:"Kronos",m:"in-browser approximation",d:"A short-horizon price shape. Runs client-side today, so its forecasts are marked as approximate rather than as a trained model's output."},
    {n:"DSA",m:"deterministic composite",d:"Scores momentum, range, drawdown and value into one number. Arithmetic, not a model; every component is shown."}
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

    /* the More menu: click, Escape, click-away, and arrow keys */
    var more=$(".nav-more"),btn=$(".nav-more-btn",more||document);
    if(more&&btn){
      if($$(".nav-menu a.on",more).length)more.setAttribute("data-has-current","1");
      var setOpen=function(v){
        more.classList.toggle("open",v);
        btn.setAttribute("aria-expanded",v?"true":"false");
      };
      btn.addEventListener("click",function(e){
        e.stopPropagation();setOpen(!more.classList.contains("open"));
      });
      document.addEventListener("click",function(e){
        if(!more.contains(e.target))setOpen(false);
      });
      document.addEventListener("keydown",function(e){
        if(e.key==="Escape"&&more.classList.contains("open")){setOpen(false);btn.focus();}
      });
      more.addEventListener("keydown",function(e){
        if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;
        var items=$$(".nav-menu a",more);
        if(!items.length)return;
        e.preventDefault();
        if(!more.classList.contains("open")){setOpen(true);items[0].focus();return;}
        var i=items.indexOf(document.activeElement);
        items[(i+(e.key==="ArrowDown"?1:items.length-1)+items.length)%items.length].focus();
      });
    }
  };

  /* ---- reveal ---- */
  F.initReveal=function(root){
    var els=$$(".reveal",root||document).filter(function(e){return !e.classList.contains("in")});
    if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});return;}
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    els.forEach(function(e,i){e.style.transitionDelay=(Math.min(i%5,4)*60)+"ms";io.observe(e);});
  };

  /* Staggered groups: the container is observed, the children arrive in order. */
  F.initStagger=function(root){
    var els=$$(".stagger",root||document).filter(function(e){return !e.classList.contains("in")});
    if(!els.length)return;
    if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});return;}
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
    },{threshold:.1,rootMargin:"0px 0px -6% 0px"});
    els.forEach(function(e){io.observe(e);});
  };

  /* Count a figure up to its value once, when it first comes into view.
     Used for live counts, so the number arriving reads as the desk working. */
  F.countTo=function(el,value,opts){
    if(!el)return;
    opts=opts||{};
    var to=Number(value);
    if(!isFinite(to)){el.textContent=value==null?"—":String(value);return;}
    if(F.reduced&&F.reduced()){el.textContent=to.toLocaleString();return;}
    var from=Number(String(el.textContent||"").replace(/[^0-9.-]/g,""))||0;
    if(from===to){return;}
    var t0=null,dur=opts.duration||900;
    function step(ts){
      if(t0===null)t0=ts;
      var p=Math.min((ts-t0)/dur,1),e=1-Math.pow(1-p,3);
      el.textContent=Math.round(from+(to-from)*e).toLocaleString();
      if(p<1){requestAnimationFrame(step);return;}
      el.textContent=to.toLocaleString();
      el.classList.remove("ticked");void el.offsetWidth;el.classList.add("ticked");
    }
    requestAnimationFrame(step);
  };

  /* The desk's record, when there is no record yet.

     These bands read real counts off the desk. Before the first round
     completes there is nothing to read, and four em-dashes under a
     caption calling them "illustrative" is both ugly and untrue: they
     are the real figures, and the real figures are none. So the band
     says that in a sentence and gets out of the way. */
  F.deskStatsEmpty=function(container, caption){
    if(!container) return false;
    var cells = container.querySelectorAll(".stat, .qs, .ap-qs");
    if(!cells.length) return false;
    var filled = 0;
    cells.forEach(function(c){
      var t = (c.textContent||"").replace(/[\s\u2014-]/g, "");
      // a cell counts as filled only if it carries a digit
      if(/[0-9]/.test(t)) filled++;
    });
    if(filled) return false;
    container.innerHTML =
      '<p class="deskempty">The desk has not filed a round yet, so there is nothing to count. ' +
      'These figures come off the record itself and stay blank until it exists.</p>';
    if(caption) caption.remove();
    return true;
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
    n=n||40;
    // Anchor to the real price + real day direction when seedStr is a ticker.
    var tk=(seedStr||"").toUpperCase();
    var isTk=F.PRICES&&F.PRICES[tk];
    var realPx=isTk?F.priceOf(tk):180, realPrev=isTk?F.prevClose(tk):realPx;
    var dayUp=realPx>=realPrev; if(up===undefined||up===null) up=dayUp;
    var vol=isTk?Math.max(0.006,Math.abs(realPx-realPrev)/(realPrev||1)+0.007):0.018;
    var step=realPx*vol;
    var price=realPx*(1-(dayUp?1:-1)*vol*n*0.14),cs=[];   // start, then shift so last=real
    for(var i=0;i<n;i++){var o=price,cl=Math.max(0.01,o+(rr()-(up===false?.56:.44))*step),
      hi=Math.max(o,cl)+rr()*step*0.5,lo=Math.min(o,cl)-rr()*step*0.5;
      cs.push({o:o,h:hi,l:lo,c:cl});price=cl;}
    var shift=realPx-cs[n-1].c;   // pin the last close to the real price
    for(i=0;i<n;i++){cs[i].o+=shift;cs[i].h+=shift;cs[i].l+=shift;cs[i].c+=shift;}
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
    c.strokeStyle="rgba(232,179,60,.5)";c.setLineDash([3,3]);
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
  /* ---- toast notifications ---- */
  F.toast=function(html,opts){
    opts=opts||{};
    var host=$(".fx-toasts");
    if(!host){ host=document.createElement("div"); host.className="fx-toasts"; host.setAttribute("aria-live","polite"); document.body.appendChild(host); }
    var t=document.createElement("div"); t.className="fx-toast";
    t.innerHTML='<span class="ic">'+(opts.icon||'<i class="ic-i i-bell" aria-hidden="true"></i>')+'</span><div class="tx">'+html+'</div><button class="x" aria-label="Dismiss"><i class="ic-i i-close" aria-hidden="true"></i></button>';
    var kill=function(){ t.classList.add("out"); setTimeout(function(){ t.remove(); }, 320); };
    t.querySelector(".x").onclick=kill;
    host.appendChild(t);
    if(opts.ttl!==0) setTimeout(kill, opts.ttl||7000);
    return t;
  };

  /* ---- price-alert checker: fires alerts + toasts when a level is crossed ---- */
  F.initAlerts=function(){
    if(F._alertsRunning||!F.Alerts||!F.Alerts.check) return; F._alertsRunning=true;
    var run=function(){
      try{
        var fired=F.Alerts.check();
        if(fired&&fired.length){
          fired.forEach(function(al){
            var dir=al.op==="above"?"rose above":"dropped below";
            F.toast("<b>"+al.ticker+"</b> "+dir+" $"+(+al.price).toFixed(2)+", now $"+(+al.firedPrice).toFixed(2)+".",{icon:al.op==="above"?"<i class='ic-i i-trend-up' aria-hidden='true'></i>":"<i class='ic-i i-trend-down' aria-hidden='true'></i>",ttl:9000});
          });
        }
      }catch(e){}
    };
    run();
    setInterval(run, 12000);
    // also re-check whenever the server pushes fresh prices
    window.addEventListener("flux-prices", run);
  };

  /* ---- global ticker search: press "/" to open, type, Enter to open terminal ---- */
  F.initSearch=function(){
    if(F._searchRunning) return; F._searchRunning=true;
    var ov=document.createElement("div"); ov.className="fx-search"; ov.setAttribute("aria-hidden","true");
    ov.innerHTML='<div class="fx-search-box"><input type="text" placeholder="Search a ticker or company…" aria-label="Search ticker" autocomplete="off">'+
      '<div class="fx-search-list"></div><div class="fx-search-hint">↑↓ to move · Enter to open · Esc to close</div></div>';
    document.body.appendChild(ov);
    var inp=ov.querySelector("input"), list=ov.querySelector(".fx-search-list"), sel=0, rows=[];
    function universe(){ return F.PRICES?Object.keys(F.PRICES):[]; }
    function render(q){
      q=(q||"").trim().toUpperCase();
      rows=universe().filter(function(t){ var nm=(F.NAMES&&F.NAMES[t]||"").toUpperCase(); return !q||t.indexOf(q)===0||t.indexOf(q)>=0||nm.indexOf(q)>=0; })
        .slice(0,8);
      sel=0;
      list.innerHTML=rows.map(function(t,i){
        var p=F.priceOf?F.priceOf(t):null, pr=F.prevClose?F.prevClose(t):null, chg=pr?(p-pr)/pr*100:0;
        return '<div class="it'+(i===0?" sel":"")+'" data-t="'+t+'"><span class="sy">'+t+'</span>'+
          '<span class="nm">'+((F.NAMES&&F.NAMES[t])||"")+'</span>'+
          '<span class="pr '+(chg>=0?"up":"down")+'">'+(p!=null?"$"+p.toFixed(2):"")+' '+(pr?(chg>=0?"+":"")+chg.toFixed(1)+"%":"")+'</span></div>';
      }).join("")||'<div class="fx-search-hint" style="border:none">No match.</div>';
    }
    function open(){ ov.classList.add("on"); inp.value=""; render(""); setTimeout(function(){inp.focus();},30); }
    function close(){ ov.classList.remove("on"); }
    function goTo(t){ if(t){ close(); location.href="./terminal.html?symbol="+t; } }
    inp.addEventListener("input",function(){ render(inp.value); });
    inp.addEventListener("keydown",function(e){
      if(e.key==="ArrowDown"){ e.preventDefault(); sel=Math.min(sel+1,rows.length-1); }
      else if(e.key==="ArrowUp"){ e.preventDefault(); sel=Math.max(sel-1,0); }
      else if(e.key==="Enter"){ e.preventDefault(); goTo(rows[sel]); return; }
      else if(e.key==="Escape"){ close(); return; }
      else return;
      Array.prototype.forEach.call(list.children,function(el,i){ el.classList.toggle("sel",i===sel); });
    });
    list.addEventListener("click",function(e){ var it=e.target.closest(".it"); if(it) goTo(it.getAttribute("data-t")); });
    ov.addEventListener("click",function(e){ if(e.target===ov) close(); });
    document.addEventListener("keydown",function(e){
      var el=document.activeElement, typing=el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);
      if(e.key==="/"&&!typing&&!ov.classList.contains("on")){ e.preventDefault(); open(); }
    });
  };

  F.initFX=function(){
    var body=document.body;
    F.initAlerts();
    F.initSearch();
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
        bar.style.transform="scaleX("+Math.min(1,d.scrollTop/max).toFixed(4)+")";
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
  // Real market snapshot (seeded from live quotes). F.LIVE overrides when the
  // server has fresher prices. Prices are a real snapshot, not a live stream.
  F.PRICES={NVDA:215.38,AMD:472.50,TSLA:363.92,AAPL:309.69,MSFT:483.25,SMCI:37.23,
    COIN:189.30,PLTR:179.80,AMZN:259.59,META:552.95,GOOGL:345.10,NFLX:79.63,AVGO:368.90,
    SPY:767.00,QQQ:714.25,MU:963.20,ARM:243.20,INTC:89.86,MARA:11.34,SOFI:18.99,
    DELL:440.77,CRM:209.21,ORCL:146.69,UBER:78.80};
  // Real prior-session closes (for accurate % change / momentum).
  F.PREV={NVDA:216.85,AMD:469.46,TSLA:345.13,AAPL:311.30,MSFT:481.15,SMCI:36.50,
    COIN:172.35,PLTR:173.96,AMZN:260.11,META:545.83,GOOGL:340.67,NFLX:80.14,AVGO:364.03,
    SPY:762.60,QQQ:710.93,MU:974.33,ARM:250.72,INTC:92.13,MARA:11.15,SOFI:17.92,
    DELL:434.78,CRM:205.43,ORCL:142.07,UBER:78.55};
  F.NAMES={NVDA:"NVIDIA",AMD:"Advanced Micro Devices",TSLA:"Tesla",AAPL:"Apple",MSFT:"Microsoft",
    SMCI:"Super Micro Computer",COIN:"Coinbase",PLTR:"Palantir",AMZN:"Amazon",META:"Meta Platforms",
    GOOGL:"Alphabet",NFLX:"Netflix",AVGO:"Broadcom",SPY:"SPDR S&P 500 ETF",QQQ:"Invesco QQQ",
    MU:"Micron Technology",ARM:"Arm Holdings",INTC:"Intel",MARA:"MARA Holdings",SOFI:"SoFi Technologies",
    DELL:"Dell Technologies",CRM:"Salesforce",ORCL:"Oracle",UBER:"Uber"};
  // Real fundamentals: pe (P/E, null=n/a), mc (market cap $B), hi/lo (52-week), sec (sector).
  F.FUND={
    NVDA:{pe:32.9,mc:5283,hi:236.54,lo:164.07,sec:"Semiconductors"},
    AMD:{pe:121.5,mc:773,hi:584.73,lo:149.22,sec:"Semiconductors"},
    TSLA:{pe:337.1,mc:1433,hi:498.83,lo:297.38,sec:"Autos"},
    AAPL:{pe:35.5,mc:4516,hi:344.57,lo:224.69,sec:"Consumer Tech"},
    MSFT:{pe:26.9,mc:3589,hi:553.72,lo:349.20,sec:"Software"},
    SMCI:{pe:11.4,mc:24,hi:58.78,lo:19.48,sec:"Hardware"},
    COIN:{pe:null,mc:49,hi:402.16,lo:139.11,sec:"Fintech"},
    PLTR:{pe:153.8,mc:432,hi:207.52,lo:106.37,sec:"Software"},
    AMZN:{pe:20.8,mc:2790,hi:287.20,lo:196.00,sec:"E-commerce"},
    META:{pe:20.7,mc:1401,hi:790.80,lo:520.26,sec:"Internet"},
    GOOGL:{pe:17.3,mc:4218,hi:408.61,lo:201.30,sec:"Internet"},
    NFLX:{pe:25.1,mc:332,hi:126.71,lo:65.08,sec:"Media"},
    AVGO:{pe:61.3,mc:1753,hi:495.00,lo:287.17,sec:"Semiconductors"},
    SPY:{pe:null,mc:null,hi:767.00,lo:600.00,sec:"ETF · S&P 500"},
    QQQ:{pe:null,mc:null,hi:714.25,lo:560.00,sec:"ETF · Nasdaq 100"},
    MU:{pe:21.9,mc:1092,hi:1255.00,lo:114.25,sec:"Semiconductors"},
    ARM:{pe:249.6,mc:260,hi:452.70,lo:100.02,sec:"Semiconductors"},
    INTC:{pe:null,mc:473,hi:142.35,lo:23.65,sec:"Semiconductors"},
    MARA:{pe:null,mc:4.4,hi:23.45,lo:6.66,sec:"Crypto"},
    SOFI:{pe:39.9,mc:24,hi:32.73,lo:14.88,sec:"Fintech"},
    DELL:{pe:35.1,mc:286,hi:514.00,lo:110.22,sec:"Hardware"},
    CRM:{pe:24.2,mc:171,hi:269.11,lo:146.32,sec:"Software"},
    ORCL:{pe:25.1,mc:422,hi:345.72,lo:114.50,sec:"Software"},
    UBER:{pe:17.3,mc:161,hi:101.99,lo:65.41,sec:"Transportation"}
  };
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
    if(F.PREV&&F.PREV[t])return +F.PREV[t];
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
      // broadcast so every open surface (terminal, dashboard, activity, account) refreshes
      try{ window.dispatchEvent(new CustomEvent("flux-book-updated",{detail:ord})); }catch(e){}
      // toast a confirmation unless the caller opts out (o.silent) — e.g. the terminal shows its own banner
      if(!o.silent && F.toast){ try{ F.toast((o.side==="buy"?"Bought ":"Sold ")+qty+" <b>"+t+"</b> @ $"+px.toFixed(2)+".",{icon:'<i class="ic-i i-check" aria-hidden="true"></i>',ttl:5000}); }catch(e){} }
      return{ok:true,msg:(o.side==="buy"?"Bought ":"Sold ")+qty+" "+t+" @ $"+px.toFixed(2),order:ord,book:b};
    },
    positionsList:function(){
      var b=this.get(),out=[];
      for(var t in b.positions){var p=b.positions[t],px=F.priceOf(t)||p.avg;
        out.push({ticker:t,qty:p.qty,avg:p.avg,price:px,mkt:+(p.qty*px).toFixed(2),
          pl:+((px-p.avg)*p.qty).toFixed(2),plpct:p.avg?+(((px-p.avg)/p.avg)*100).toFixed(2):0});}
      return out.sort(function(a,c){return c.mkt-a.mkt});
    },
    equity:function(){var b=this.get(),v=b.cash;for(var t in b.positions)v+=b.positions[t].qty*(F.priceOf(t)||b.positions[t].avg);return +v.toFixed(2);},
    // performance since the account started (paper track record)
    perf:function(){
      var b=this.get(),eq=this.equity(),start=b.start||100000;
      var ret=start?(eq-start)/start:0;
      // record an equity snapshot (throttled to ~1/min) so a curve accrues
      b.eqHist=b.eqHist||[];
      var now=Date.now(),lastH=b.eqHist[b.eqHist.length-1];
      if(!lastH||now-lastH.ts>60000){ b.eqHist.push({ts:now,eq:eq}); if(b.eqHist.length>500)b.eqHist=b.eqHist.slice(-500); this.save(b); }
      return {equity:eq,start:start,ret:ret,pl:+(eq-start).toFixed(2),hist:b.eqHist};
    },
    // close a full position at market (offsetting sell) — used by portfolio/terminal "Close" buttons
    close:function(t){t=(t||"").toUpperCase();var b=this.get(),p=b.positions[t];
      if(!p||p.qty<1)return{ok:false,msg:"No open "+t+" position."};
      return this.place({side:"sell",ticker:t,qty:p.qty,type:"market"});},
    // flatten every open position at market
    closeAll:function(){var b=this.get(),res=[],ts=Object.keys(b.positions);
      for(var i=0;i<ts.length;i++){res.push(this.close(ts[i]));}
      return{ok:true,closed:res.length,results:res};},
    // add paper buying power (demo "deposit")
    deposit:function(amt){amt=Math.max(0,+amt||0);var b=this.get();b.cash=+(b.cash+amt).toFixed(2);b.start=+((b.start||100000)+amt).toFixed(2);this.save(b);
      try{window.dispatchEvent(new CustomEvent("flux-book-updated",{detail:{deposit:amt}}));}catch(e){}
      if(F.toast){try{F.toast("<i class='ic-i i-doc' aria-hidden='true'></i> Added $"+amt.toLocaleString()+" paper buying power.",{icon:"<i class='ic-i i-doc' aria-hidden='true'></i>"});}catch(e){}}
      return b;}
  };
  window.FLUXBook=F.Book;

  /* ---- CSV export (pure client-side, no backend) ---- */
  F.exportCSV=function(filename,rows){
    if(!rows||!rows.length){if(F.toast)F.toast("Nothing to export yet.");return;}
    var cols=Object.keys(rows[0]);
    var esc=function(v){v=(v==null?"":String(v));return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    var csv=cols.join(",")+"\n"+rows.map(function(r){return cols.map(function(c){return esc(r[c]);}).join(",");}).join("\n");
    try{
      var blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download=filename||"flux-export.csv";
      document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},100);
      if(F.toast)F.toast("<i class='ic-i i-down' aria-hidden='true'></i> Exported "+rows.length+" rows.",{icon:"<i class='ic-i i-down' aria-hidden='true'></i>"});
    }catch(e){}
  };

  /* ---- Black-Scholes options engine (pure math — powers the simulated options chain) ---- */
  // normal CDF via Abramowitz-Stegun; annualized IV assumptions per ticker (fallbacks by beta feel)
  F.IV={NVDA:.52,AMD:.58,TSLA:.65,AAPL:.28,MSFT:.26,SMCI:.85,COIN:.80,PLTR:.62,AMZN:.34,META:.36,
    GOOGL:.31,NFLX:.42,AVGO:.44,SPY:.15,QQQ:.20,MU:.55,ARM:.60,INTC:.48,MARA:.95,SOFI:.66,
    DELL:.46,CRM:.36,ORCL:.38,UBER:.44};
  F.BS=(function(){
    function ncdf(x){var t=1/(1+.2316419*Math.abs(x));
      var d=.3989423*Math.exp(-x*x/2);
      var p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
      return x>0?1-p:p;}
    function npdf(x){return .3989422804014327*Math.exp(-x*x/2);}
    function d1(S,K,T,r,v){return (Math.log(S/K)+(r+v*v/2)*T)/(v*Math.sqrt(T));}
    return {
      // price of a call/put
      price:function(type,S,K,T,r,v){if(T<=0)return Math.max(0,type==="put"?K-S:S-K);
        var a=d1(S,K,T,r,v),b=a-v*Math.sqrt(T);
        return type==="put"
          ? +(K*Math.exp(-r*T)*ncdf(-b)-S*ncdf(-a)).toFixed(2)
          : +(S*ncdf(a)-K*Math.exp(-r*T)*ncdf(b)).toFixed(2);},
      greeks:function(type,S,K,T,r,v){if(T<=0)T=1/365;
        var a=d1(S,K,T,r,v),b=a-v*Math.sqrt(T),nd=npdf(a),st=Math.sqrt(T);
        var delta=type==="put"?ncdf(a)-1:ncdf(a);
        var gamma=nd/(S*v*st);
        var vega=S*nd*st/100;                         // per 1 vol point
        var theta=(-(S*nd*v)/(2*st) - (type==="put"?-1:1)*r*K*Math.exp(-r*T)*ncdf((type==="put"?-b:b)))/365;
        return {delta:+delta.toFixed(3),gamma:+gamma.toFixed(4),theta:+theta.toFixed(3),vega:+vega.toFixed(3)};}
    };
  })();
  // build a simulated chain: several expiries, strikes bracketing spot, BS-priced with greeks
  F.optionChain=function(t,expDays){
    t=(t||"").toUpperCase();var S=F.priceOf(t);if(S==null)return null;
    var v=F.IV[t]||.45,r=.045;
    var step=S<20?0.5:S<50?1:S<150?2.5:S<400?5:10;
    var atm=Math.round(S/step)*step,rows=[];
    for(var i=-6;i<=6;i++){
      var K=+(atm+i*step).toFixed(2);if(K<=0)continue;
      var T=(expDays||30)/365;
      rows.push({strike:K,
        call:F.BS.price("call",S,K,T,r,v),put:F.BS.price("put",S,K,T,r,v),
        callGk:F.BS.greeks("call",S,K,T,r,v),putGk:F.BS.greeks("put",S,K,T,r,v),
        atm:Math.abs(K-S)<step/2});
    }
    return {ticker:t,spot:S,iv:v,expDays:expDays||30,step:step,rows:rows};
  };
  // simulated options paper blotter (separate from equity book)
  F.OptBook={
    KEY:"flux_option_orders",
    get:function(){var a;try{a=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}return Array.isArray(a)?a:[];},
    save:function(a){try{localStorage.setItem(this.KEY,JSON.stringify(a))}catch(e){}},
    place:function(o){var a=this.get();
      var ord={id:Date.now(),ts:Date.now(),ticker:(o.ticker||"").toUpperCase(),side:o.side||"buy",
        right:o.right||"call",strike:+o.strike,exp:o.exp||"30d",qty:Math.max(1,+o.qty||1),
        premium:+o.premium,cost:+((+o.premium)*100*Math.max(1,+o.qty||1)).toFixed(2),status:"filled"};
      a.unshift(ord);if(a.length>60)a.length=60;this.save(a);
      try{window.dispatchEvent(new CustomEvent("flux-book-updated",{detail:ord}));}catch(e){}
      if(F.toast){try{F.toast((ord.side==="buy"?"Bought ":"Sold ")+ord.qty+" "+ord.ticker+" $"+ord.strike+" "+ord.right.toUpperCase()+" @ $"+ord.premium.toFixed(2),{icon:'<i class="ic-i i-check" aria-hidden="true"></i>'});}catch(e){}}
      return{ok:true,order:ord};}
  };
  window.FLUXOpt=F.OptBook;

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
          '<a class="btn btn-primary btn-sm" href="./desk.html">Open the desk</a>';
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

  /* ------------------------------------------------------------
     TICKER TAPE — a thin, always-on marquee of live prices at the
     very top of every page. Muted, monospace, green/red for
     direction only; pauses on hover. Prices are simulated / live.
     ------------------------------------------------------------ */
  F.initTicker=function(){
    if(document.getElementById("fluxTicker"))return;         // once per page
    if(!F.PRICES||!Object.keys(F.PRICES).length)return;      // needs the universe
    var PREF=["AAPL","NVDA","MSFT","AMZN","GOOGL","META","TSLA","AMD","AVGO","NFLX",
              "JPM","V","MA","COST","ORCL","CRM","PLTR","COIN","HOOD","SMCI","MRVL",
              "UBER","DIS","XOM","JNJ","WMT","MRK","BA"];
    var list=PREF.filter(function(t){return F.PRICES[t];});
    Object.keys(F.PRICES).forEach(function(t){ if(list.length<26 && list.indexOf(t)<0) list.push(t); });
    list=list.slice(0,26);
    if(!list.length)return;

    function itemHTML(t){
      return '<span class="tk-item" data-t="'+t+'"><b class="tk-sym">'+t+'</b>'+
             '<span class="tk-px"></span><span class="tk-chg"></span></span>';
    }
    var seq=list.map(itemHTML).join("");
    var bar=document.createElement("div");
    bar.id="fluxTicker"; bar.className="ticker"; bar.setAttribute("aria-hidden","true");
    // two copies of the sequence -> seamless -50% loop
    bar.innerHTML='<div class="tk-track">'+seq+seq+'</div>';
    document.body.insertBefore(bar, document.body.firstChild);

    function paint(){
      var items=bar.querySelectorAll(".tk-item");
      for(var i=0;i<items.length;i++){
        var el=items[i], t=el.getAttribute("data-t");
        var p=F.priceOf?F.priceOf(t):null, pv=F.prevClose?F.prevClose(t):null;
        if(p==null)continue;
        var chg=pv?(p-pv)/pv*100:0;
        var px=el.querySelector(".tk-px"), cg=el.querySelector(".tk-chg");
        px.textContent="$"+p.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
        cg.textContent=(chg>=0?"+":"")+chg.toFixed(2)+"%";
        cg.className="tk-chg "+(chg>=0?"tk-up":"tk-dn");
      }
    }
    paint();
    setInterval(paint, 15000);
    window.addEventListener("flux-prices", paint);
  };

  document.addEventListener("DOMContentLoaded",function(){
    F.initNav();F.initReveal();F.initStagger();F.initCounters();F.initFX();F.initAuth();F.initTicker();
  });
})();
