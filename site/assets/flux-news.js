/* ============================================================
   FLUX — finance news client
   Talks to the `news` Edge Function (WSJ + CNBC + MarketWatch +
   Yahoo Finance + Reuters + Bloomberg + Investing.com, merged and
   deduped) and renders compact, auto-shuffling headline widgets.
   F.News.latest(limit,q) -> Promise<[{title,url,source,published,summary}]>
   F.News.mount(el, opts) -> drop a rotating widget into an element
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var URL_ = "https://pyzcwddyagodmtjuvwdn.supabase.co/functions/v1/news";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";
  var cache = null, cacheAt = 0, inflight = null, TTL = 120000;

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

  var News = F.News = {
    ago: ago,
    color: function(src){ return SRC[src] || "var(--cyan)"; },

    latest: function(limit, q){
      limit = limit || 40;
      if(q){
        return fetch(URL_+"?limit="+limit+"&q="+encodeURIComponent(q), { headers:{ apikey:KEY_ } })
          .then(function(r){ return r.json(); }).then(function(j){ return (j&&j.items)||[]; }).catch(function(){ return []; });
      }
      var now = Date.now();
      if(cache && (now-cacheAt) < TTL) return Promise.resolve(cache.slice(0, limit));
      if(inflight) return inflight.then(function(items){ return items.slice(0, limit); });
      inflight = fetch(URL_+"?limit=50", { headers:{ apikey:KEY_ } })
        .then(function(r){ return r.json(); })
        .then(function(j){ var items=(j&&j.items)||[]; if(items.length){ cache=items; cacheAt=Date.now(); } inflight=null; return items; })
        .catch(function(){ inflight=null; return cache||[]; });
      return inflight.then(function(items){ return items.slice(0, limit); });
    },

    // Render a compact, auto-shuffling headline widget into `el`.
    // opts: { limit:6, q:"", rotate:true, interval:9000 }
    mount: function(el, opts){
      if(!el) return null;
      opts = opts || {};
      var n = opts.limit || 6, q = opts.q || "", rotate = opts.rotate !== false, iv = opts.interval || 9000;
      var all = [], start = 0;
      el.className = (el.className ? el.className+" " : "") + "fnw";
      function windowItems(){ var w=[]; if(!all.length) return w; for(var k=0;k<n;k++) w.push(all[(start+k)%all.length]); return w; }
      function render(){
        var items = all.length ? windowItems() : [];
        if(!items.length){ el.innerHTML = '<div class="fnw-empty">Loading headlines…</div>'; return; }
        el.innerHTML = items.map(function(it){
          return '<a class="fnw-item" href="'+esc(it.url)+'" target="_blank" rel="noopener">'+
            '<span class="fnw-src" style="color:'+News.color(it.source)+'">'+esc(it.source)+'</span>'+
            '<span class="fnw-ttl">'+esc(it.title)+'</span>'+
            '<span class="fnw-ago">'+News.ago(it.published)+'</span></a>';
        }).join("");
      }
      function load(){ News.latest(45, q).then(function(items){ all = items; if(start >= all.length) start = 0; render(); }); }
      render(); load();
      if(rotate){ setInterval(function(){ if(all.length > n){ start = (start + n) % all.length; render(); } }, iv); }
      setInterval(load, 180000);
      return { refresh: load };
    }
  };
  window.FLUXNews = News;
})();
