/* ============================================================
   FLUX — finance news client
   Talks to the `news` (RSS aggregator) and `news-brief` (AI read)
   Edge Functions and renders compact, auto-shuffling headline
   widgets — global, symbol-aware, and with Fluxi's AI summary.
     F.News.latest(limit,q)      -> Promise<[{title,url,source,published,summary}]>
     F.News.brief()              -> Promise<string|null>   (AI read of the top stories)
     F.News.mount(el, opts)      -> rotating global widget
     F.News.mountSymbol(el, getSym, opts) -> news filtered to the active ticker
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var BASE = "https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var HDR = { apikey: KEY_ };
  var cache = null, cacheAt = 0, inflight = null, TTL = 120000;
  var briefCache = null, briefAt = 0, briefInflight = null, BTTL = 600000;

  var SRC = { WSJ:"#e0483b", CNBC:"#0a7bc2", Reuters:"#ff8000", Bloomberg:"#a78bfa",
              "Yahoo Finance":"#7b5cff", MarketWatch:"#12b886", "Investing.com":"#3b9dff" };

  function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function ago(ts){
    if(!ts) return "";
    var s = (Date.now()-ts)/1000;
    if(s < 60) return Math.max(1,Math.round(s))+"s";
    if(s < 3600) return Math.round(s/60)+"m";
    if(s < 86400) return Math.round(s/3600)+"h";
    return Math.round(s/86400)+"d";
  }
  function color(src){ return SRC[src] || "var(--cyan)"; }
  function itemHTML(it){
    return '<a class="fnw-item" href="'+esc(it.url)+'" target="_blank" rel="noopener">'+
      '<span class="fnw-src" style="color:'+color(it.source)+'">'+esc(it.source)+'</span>'+
      '<span class="fnw-ttl">'+esc(it.title)+'</span>'+
      '<span class="fnw-ago">'+ago(it.published)+'</span></a>';
  }
  // does a headline mention this ticker / company?
  function matchSym(it, t, name){
    var hay = " " + (it.title + " " + (it.summary||"")).toLowerCase() + " ";
    if(t && new RegExp("[^a-z]"+t.toLowerCase()+"[^a-z]").test(hay)) return true;
    if(name){
      var nm = name.toLowerCase().replace(/[.,]/g,"").split(/\s+/)[0];
      if(nm && nm.length >= 3 && hay.indexOf(nm) >= 0) return true;
    }
    return false;
  }

  var News = F.News = {
    ago: ago, color: color,

    latest: function(limit, q){
      limit = limit || 40;
      if(q){
        return fetch(BASE+"/news?limit="+limit+"&q="+encodeURIComponent(q), { headers:HDR })
          .then(function(r){ return r.json(); }).then(function(j){ return (j&&j.items)||[]; }).catch(function(){ return []; });
      }
      var now = Date.now();
      if(cache && (now-cacheAt) < TTL) return Promise.resolve(cache.slice(0, limit));
      if(inflight) return inflight.then(function(items){ return items.slice(0, limit); });
      inflight = fetch(BASE+"/news?limit=50", { headers:HDR })
        .then(function(r){ return r.json(); })
        .then(function(j){ var items=(j&&j.items)||[]; if(items.length){ cache=items; cacheAt=Date.now(); } inflight=null; return items; })
        .catch(function(){ inflight=null; return cache||[]; });
      return inflight.then(function(items){ return items.slice(0, limit); });
    },

    // AI read of the top stories (Haiku, server-cached 10 min).
    brief: function(){
      var now = Date.now();
      if(briefCache !== null && (now-briefAt) < BTTL) return Promise.resolve(briefCache);
      if(briefInflight) return briefInflight;
      briefInflight = fetch(BASE+"/news-brief", { headers:HDR })
        .then(function(r){ return r.json(); })
        .then(function(j){ briefCache = (j&&j.text)||null; briefAt = Date.now(); briefInflight = null; return briefCache; })
        .catch(function(){ briefInflight = null; return null; });
      return briefInflight;
    },

    // Rotating global widget.
    mount: function(el, opts){
      if(!el) return null;
      opts = opts || {};
      var n = opts.limit || 6, q = opts.q || "", rotate = opts.rotate !== false, iv = opts.interval || 9000;
      var all = [], start = 0;
      el.className = (el.className.indexOf("fnw")<0 ? (el.className+" fnw") : el.className);
      function windowItems(){ var w=[]; for(var k=0;k<n;k++) w.push(all[(start+k)%all.length]); return w; }
      function render(){
        var items = all.length ? windowItems() : [];
        el.innerHTML = items.length ? items.map(itemHTML).join("") : '<div class="fnw-empty">Loading headlines…</div>';
      }
      function load(){ News.latest(45, q).then(function(items){ all = items; if(start >= all.length) start = 0; render(); }); }
      render(); load();
      if(rotate){ setInterval(function(){ if(all.length > n){ start = (start + n) % all.length; render(); } }, iv); }
      setInterval(load, 180000);
      return { refresh: load };
    },

    // Symbol-aware widget: shows headlines about the active ticker, falling
    // back to general market news when there are none. getSym() -> {t, name}.
    mountSymbol: function(el, getSym, opts){
      if(!el) return null;
      opts = opts || {};
      var n = opts.limit || 6;
      var all = [];
      el.className = (el.className.indexOf("fnw")<0 ? (el.className+" fnw") : el.className);
      function render(){
        var s = getSym() || {}, t = (s.t||"").toUpperCase(), name = s.name || "";
        var hits = t ? all.filter(function(it){ return matchSym(it, t, name); }) : [];
        var scoped = hits.length >= 1;
        var items = (scoped ? hits : all).slice(0, n);
        if(opts.onScope) opts.onScope(scoped ? t : "", hits.length);
        el.innerHTML = items.length ? items.map(itemHTML).join("") : '<div class="fnw-empty">No headlines right now.</div>';
      }
      function load(){ News.latest(50).then(function(items){ all = items || []; render(); }); }
      render(); load();
      setInterval(load, 180000);
      return { update: render, refresh: load };
    }
  };
  window.FLUXNews = News;
})();
