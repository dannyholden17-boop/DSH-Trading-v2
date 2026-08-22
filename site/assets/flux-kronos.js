/* ============================================================
   FLUX — Kronos strategy engine (client)
   A faithful port of the Kronos trading method:
     forecast next candles -> predicted return -> threshold signal
     (>+2% BUY, <-2% SELL, else HOLD) -> all-in & flip on reversal.
   Uses REAL Kronos forecasts when present in FLUX.KFORECAST (synced
   from the Supabase `forecasts` table by the Python bridge); otherwise
   a probabilistic Monte-Carlo candlestick forecaster (mirroring Kronos's
   multi-path sampling) approximates it so the agent works with no GPU.
   Ref: dannyholden17-boop/Kronos — run_backtest_kronos.py (threshold=0.02).
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};

  function mulberry(a){ return function(){ a|=0; a = a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function gauss(rng){ var u=1-rng(), v=rng(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
  function avg(a){ for(var i=0,s=0;i<a.length;i++)s+=a[i]; return a.length? s/a.length : 0; }

  var K = F.Kronos = {
    THRESH: 0.02,   // Kronos backtest default (2%)
    HORIZON: 5,     // forecast the next 5 candles
    SAMPLES: 24,    // Monte-Carlo paths (mirrors Kronos sample_count)
    MODEL: "Kronos-small",

    // Forecast next-candle path for a ticker.
    // Prefers a REAL Kronos forecast if the bridge has published one.
    forecast: function(t){
      t = (t||"").toUpperCase();
      var real = F.KFORECAST && F.KFORECAST[t];
      if(real && real.pred_close){
        var last0 = (F.priceOf && F.priceOf(t)) || real.last || real.pred_close;
        return {
          ticker:t, last:last0, path:(real.path||[real.pred_close]),
          predClose:+real.pred_close, predReturn: last0 ? (real.pred_close-last0)/last0 : (+real.pred_return||0),
          confidence: real.confidence!=null ? +real.confidence : 70,
          horizon: real.horizon || K.HORIZON, model: real.model || "Kronos", real:true
        };
      }
      if(!F.priceOf) return null;
      var last = F.priceOf(t), prev = (F.prevClose && F.prevClose(t)) || last;
      if(!last) return null;
      var drift = prev ? (last - prev)/prev : 0;                 // recent momentum -> drift
      var vol = Math.max(0.009, Math.abs(drift)*1.3 + 0.013);    // per-candle vol
      var rng = mulberry(F.seed ? F.seed(t + "|kronos") : 12345);
      var H = K.HORIZON, paths = [], ends = [];
      for(var s=0; s<K.SAMPLES; s++){
        var p = last, series = [];
        for(var h=0; h<H; h++){ p = p * (1 + drift*0.30 + gauss(rng)*vol); series.push(p); }
        paths.push(series); ends.push(p);
      }
      var meanEnd = avg(ends), predReturn = last ? (meanEnd-last)/last : 0;
      var upFrac = ends.filter(function(e){ return e >= last; }).length / K.SAMPLES;
      var confidence = Math.round(Math.abs(upFrac - 0.5) * 2 * 100);   // path agreement 0..100
      var meanPath = [];
      for(var hh=0; hh<H; hh++){ meanPath.push(avg(paths.map(function(pp){ return pp[hh]; }))); }
      return { ticker:t, last:last, path:meanPath, predClose:meanEnd, predReturn:predReturn,
        confidence:confidence, horizon:H, model:"Kronos-approx", real:false };
    },

    // Kronos signal: threshold on predicted return -> BUY / SELL / HOLD.
    signal: function(t){
      var f = K.forecast(t);
      if(!f) return { action:"HOLD", predReturn:0, confidence:0, model:"Kronos" };
      var a = f.predReturn > K.THRESH ? "BUY" : (f.predReturn < -K.THRESH ? "SELL" : "HOLD");
      return { action:a, predReturn:f.predReturn, confidence:f.confidence, horizon:f.horizon,
        predClose:f.predClose, last:f.last, model:f.model, real:f.real };
    },

    // Rank a universe by predicted return (desc). Returns [{ticker, predReturn, confidence, action}].
    rank: function(list){
      list = list || (F.PRICES ? Object.keys(F.PRICES) : []);
      var out = list.map(function(t){ var s = K.signal(t); return {
        ticker:t, predReturn:s.predReturn, confidence:s.confidence, action:s.action, model:s.model }; });
      out.sort(function(a,b){ return b.predReturn - a.predReturn; });
      return out;
    },

    fmtPct: function(x){ return (x>=0?"+":"") + (x*100).toFixed(2) + "%"; }
  };
  window.FLUXKronos = K;
})();
