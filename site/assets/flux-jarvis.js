/* ============================================================
   FLUX — JARVIS engine
   A living arc-reactor orb + a grounded conversational assistant
   + a live valuation model + voice control.

   Everything is grounded in the site's real data layer:
     FLUX.PRICES / priceOf / prevClose / NAMES
     FLUX.Kronos.forecast / signal / rank   (predicted returns)
     FluxSupa.autopilot()                    (live paper fund)
     FLUX.Book                               (the user's paper account)

   No external dependency. If a Supabase `ai-chat` edge function is
   deployed (with an API key), free-form questions are upgraded to a
   full LLM; otherwise the grounded engine answers on its own.

   Nothing here is investment advice. All figures are simulated /
   model estimates and are labelled as such.
   ============================================================ */
(function () {
  "use strict";
  var F = window.FLUX || (window.FLUX = {});
  var J = (window.JARVIS = window.JARVIS || {});
  window.FLUXI = J; // Fluxi — the assistant's name
  J.name = "Fluxi";

  /* ------------------------------------------------------------
     1)  THE ORB — an Iron-Man style arc reactor rendered on a
         canvas: a pulsing core, concentric rotating rings ("chains"),
         an orbiting node network, all reactive to an energy level
         that spikes while the AI is thinking or speaking.
     ------------------------------------------------------------ */
  J.Orb = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, R = 0;
    var energy = 0.15;          // current energy 0..1
    var target = 0.15;          // eased toward
    var t = 0, raf = null, alive = true;
    var CY = "76,215,246";      // neon cyan
    var GR = "74,225,118";      // green

    // orbiting nodes (the "network / chains")
    var nodes = [];
    for (var i = 0; i < 22; i++) {
      nodes.push({
        a: Math.random() * Math.PI * 2,
        r: 0.42 + Math.random() * 0.5,     // fraction of R
        sp: (Math.random() * 0.4 + 0.15) * (Math.random() < 0.5 ? 1 : -1),
        sz: Math.random() * 1.8 + 1
      });
    }

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.42;
    }

    function ring(radius, width, alpha, dash, rot, color) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.lineWidth = width;
      ctx.strokeStyle = "rgba(" + (color || CY) + "," + alpha + ")";
      if (dash) ctx.setLineDash(dash);
      ctx.shadowColor = "rgba(" + (color || CY) + ",0.9)";
      ctx.shadowBlur = 12 * (0.4 + energy);
      ctx.stroke();
      ctx.restore();
    }

    // tick marks around a ring (mechanical "chain" look)
    function ticks(radius, count, len, alpha, rot) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.strokeStyle = "rgba(" + CY + "," + alpha + ")";
      ctx.lineWidth = 1.4;
      for (var k = 0; k < count; k++) {
        var a = (k / count) * Math.PI * 2;
        var x1 = Math.cos(a) * radius, y1 = Math.sin(a) * radius;
        var x2 = Math.cos(a) * (radius + len), y2 = Math.sin(a) * (radius + len);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
    }

    function frame() {
      if (!alive) return;
      t += 0.016;
      energy += (target - energy) * 0.08;
      target += (0.15 - target) * 0.02;       // decay back to idle
      var e = energy, pulse = 1 + Math.sin(t * 2.2) * 0.03 * (0.5 + e);

      ctx.clearRect(0, 0, W, H);

      // glow halo
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
      g.addColorStop(0, "rgba(" + CY + "," + (0.20 + e * 0.35) + ")");
      g.addColorStop(0.5, "rgba(" + CY + "," + (0.05 + e * 0.1) + ")");
      g.addColorStop(1, "rgba(2,6,23,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // outer rings / chains
      ring(R * 1.02 * pulse, 1.5, 0.25 + e * 0.3, [2, 10], t * 0.25, CY);
      ticks(R * 0.98 * pulse, 60, 6 + e * 6, 0.18 + e * 0.25, -t * 0.18);
      ring(R * 0.86 * pulse, 2.2, 0.35 + e * 0.4, null, -t * 0.4, CY);
      ring(R * 0.72 * pulse, 1.2, 0.22, [1, 6], t * 0.7, CY);
      ticks(R * 0.60 * pulse, 36, 5, 0.16 + e * 0.2, t * 0.5);
      ring(R * 0.48 * pulse, 2.6, 0.4 + e * 0.4, null, t * 0.9, e > 0.5 ? GR : CY);

      // node network (orbiting particles + connective chains)
      var pts = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.a += n.sp * 0.01 * (0.6 + e * 1.6);
        var rad = R * n.r * pulse;
        var x = cx + Math.cos(n.a) * rad, y = cy + Math.sin(n.a) * rad;
        pts.push({ x: x, y: y, sz: n.sz });
      }
      ctx.strokeStyle = "rgba(" + CY + "," + (0.05 + e * 0.12) + ")";
      ctx.lineWidth = 0.7;
      for (var a2 = 0; a2 < pts.length; a2++) {
        for (var b = a2 + 1; b < pts.length; b++) {
          var dx = pts[a2].x - pts[b].x, dy = pts[a2].y - pts[b].y;
          var d = dx * dx + dy * dy;
          if (d < (R * 0.5) * (R * 0.5)) {
            ctx.beginPath(); ctx.moveTo(pts[a2].x, pts[a2].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
          }
        }
      }
      for (var p = 0; p < pts.length; p++) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + CY + "," + (0.6 + e * 0.4) + ")";
        ctx.shadowColor = "rgba(" + CY + ",1)"; ctx.shadowBlur = 8;
        ctx.arc(pts[p].x, pts[p].y, pts[p].sz, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;

      // core
      var coreR = R * (0.30 + e * 0.06) * pulse;
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, "rgba(230,253,255," + (0.85 + e * 0.15) + ")");
      cg.addColorStop(0.4, "rgba(" + CY + "," + (0.6 + e * 0.3) + ")");
      cg.addColorStop(1, "rgba(" + CY + ",0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();

      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    resize();
    if (!(F.reduced && F.reduced())) raf = requestAnimationFrame(frame);
    else { // static single frame for reduced-motion
      resize(); frame(); alive = false; if (raf) cancelAnimationFrame(raf);
    }

    return {
      // pulse the orb (0..1). thinking/speaking call this repeatedly.
      pulse: function (v) { target = Math.max(target, Math.min(1, v)); },
      setEnergy: function (v) { target = Math.min(1, Math.max(0, v)); },
      idle: function () { target = 0.15; },
      destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener("resize", resize); }
    };
  };

  /* ------------------------------------------------------------
     2)  VALUATION MODEL — ranks the universe into under- / over-
         valued using Kronos's predicted return (the model's view of
         where price is heading vs where it is now). Model estimate,
         not advice.
     ------------------------------------------------------------ */
  function pct(x) { return (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%"; }
  function money(x) { return "$" + (+x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  J.valuation = function () {
    var K = F.Kronos;
    var universe = F.PRICES ? Object.keys(F.PRICES) : [];
    var rows = universe.map(function (t) {
      var f = K ? K.forecast(t) : null;
      var price = (F.priceOf && F.priceOf(t)) || (f && f.last) || 0;
      var edge = f ? f.predReturn : 0;              // model view of fair value gap
      return {
        ticker: t, name: (F.NAMES && F.NAMES[t]) || t,
        price: price, fair: f ? f.predClose : price,
        edge: edge, upside: edge, conf: f ? f.confidence : 0,
        action: f ? (edge > 0.02 ? "BUY" : edge < -0.02 ? "SELL" : "HOLD") : "HOLD",
        real: f ? !!f.real : false
      };
    }).filter(function (r) { return r.price > 0; });

    rows.sort(function (a, b) { return b.edge - a.edge; });
    var under = rows.filter(function (r) { return r.edge > 0.015; }).slice(0, 6);
    var over = rows.filter(function (r) { return r.edge < -0.015; }).sort(function (a, b) { return a.edge - b.edge; }).slice(0, 6);
    return { all: rows, under: under, over: over };
  };

  /* ------------------------------------------------------------
     3)  LIVE BRIEF — composes a market brief from real signals.
     ------------------------------------------------------------ */
  J.brief = function () {
    var v = J.valuation();
    var bull = v.under.length, bear = v.over.length;
    var tone = bull > bear + 1 ? "risk-on" : bear > bull + 1 ? "risk-off" : "balanced";
    var top = v.under[0], wk = v.over[0];
    var lines = [];
    lines.push("Market read: " + tone + ". The model sees " + bull + " names with upside and " + bear + " stretched.");
    if (top) lines.push("Most undervalued: " + top.ticker + " (" + top.name + ") — model fair value " + money(top.fair) + " vs " + money(top.price) + ", " + pct(top.upside) + " edge.");
    if (wk) lines.push("Most overvalued: " + wk.ticker + " — model sees " + pct(wk.upside) + " downside from " + money(wk.price) + ".");
    lines.push("This is a simulated model estimate, not advice.");
    return { tone: tone, text: lines.join(" "), bullets: lines, val: v };
  };

  /* ------------------------------------------------------------
     3.5) MEMORY & LEARNING — Fluxi learns two ways:
        • from humans: facts you teach it ("remember I hold NVDA",
          "my rule is max 8% per name") + 👍/👎 feedback on answers.
        • from itself: it journals every signal it gives, later scores
          those calls against real price moves, tracks its hit-rate,
          and distills "lessons" it can cite. It can also research a
          name on demand and save the finding as a learned note.
        Persisted to localStorage now, and mirrored to Supabase
        (fluxi_memory) when signed in so it follows you across devices.
        Honest by design: this is pattern memory + self-scoring, not a
        promise of profit.
     ------------------------------------------------------------ */
  var MEM_KEY = "fluxi_mem_v1";
  var Mem = { facts: [], lessons: [], journal: [], stats: { taught: 0, up: 0, down: 0, calls: 0, hits: 0, scored: 0 } };

  function memLoad() {
    try { var raw = localStorage.getItem(MEM_KEY); if (raw) { var m = JSON.parse(raw); if (m && m.facts) Mem = m; } } catch (e) {}
    // pull server copy if signed in (merges, server wins on facts)
    try {
      var S = window.FluxSupa;
      if (S && S.loadMemory) S.loadMemory().then(function (srv) {
        if (srv && srv.facts) { Mem = mergeMem(Mem, srv); memSave(true); if (J.onLearn) J.onLearn(); }
      });
    } catch (e) {}
  }
  function mergeMem(a, b) {
    var seen = {}, facts = [];
    (b.facts || []).concat(a.facts || []).forEach(function (f) { var k = (f.text || "").toLowerCase(); if (k && !seen[k]) { seen[k] = 1; facts.push(f); } });
    return { facts: facts.slice(0, 100), lessons: (b.lessons || a.lessons || []).slice(0, 60),
      journal: (a.journal || []).slice(-200), stats: b.stats || a.stats || Mem.stats };
  }
  function memSave(skipServer) {
    try { localStorage.setItem(MEM_KEY, JSON.stringify(Mem)); } catch (e) {}
    if (!skipServer) { try { var S = window.FluxSupa; if (S && S.saveMemory && S._user) S.saveMemory(Mem); } catch (e) {} }
  }

  J.remember = function (fact) {
    fact = (fact || "").trim(); if (!fact) return false;
    var k = fact.toLowerCase();
    if (Mem.facts.some(function (f) { return f.text.toLowerCase() === k; })) return false;
    Mem.facts.unshift({ text: fact, at: Date.now() }); Mem.facts = Mem.facts.slice(0, 100);
    Mem.stats.taught++; memSave(); if (J.onLearn) J.onLearn(); return true;
  };
  J.forget = function (needle) {
    needle = (needle || "").toLowerCase(); var before = Mem.facts.length;
    Mem.facts = Mem.facts.filter(function (f) { return f.text.toLowerCase().indexOf(needle) === -1; });
    memSave(); if (J.onLearn) J.onLearn(); return before - Mem.facts.length;
  };
  J.facts = function () { return Mem.facts.slice(); };
  J.lessons = function () { return Mem.lessons.slice(); };
  J.memStats = function () { return Mem.stats; };
  J.feedback = function (good, aboutText) {
    if (good) Mem.stats.up++; else Mem.stats.down++;
    // a thumbs-down becomes a lesson to be more careful on that topic
    if (!good && aboutText) J.addLesson("A user pushed back on: \"" + aboutText.slice(0, 80) + "\" — weight that read more cautiously.", "human");
    memSave(); if (J.onLearn) J.onLearn();
  };
  J.addLesson = function (text, src) {
    if (!text) return; var k = text.toLowerCase();
    if (Mem.lessons.some(function (l) { return l.text.toLowerCase() === k; })) return;
    Mem.lessons.unshift({ text: text, src: src || "self", at: Date.now() }); Mem.lessons = Mem.lessons.slice(0, 60);
    memSave(); if (J.onLearn) J.onLearn();
  };

  // journal a signal Fluxi gives, so it can score itself later
  function journalSignal(t, predReturn, price) {
    Mem.journal.push({ t: t, er: predReturn, p0: price, at: Date.now(), scored: false });
    Mem.journal = Mem.journal.slice(-200); Mem.stats.calls++; memSave(true);
  }
  // self-review: grade past calls against the current price, learn from it
  J.review = function () {
    var now = Date.now(), changed = false, MIN_AGE = 90 * 1000; // grade calls >90s old (demo-fast)
    Mem.journal.forEach(function (j) {
      if (j.scored || (now - j.at) < MIN_AGE) return;
      var p = F.priceOf && F.priceOf(j.t); if (!p || !j.p0) return;
      var realized = (p - j.p0) / j.p0;
      var directionRight = (j.er >= 0 && realized >= 0) || (j.er < 0 && realized < 0);
      j.scored = true; Mem.stats.scored++; if (directionRight) Mem.stats.hits++; changed = true;
    });
    if (changed) {
      var acc = Mem.stats.scored ? Math.round(Mem.stats.hits / Mem.stats.scored * 100) : null;
      if (acc != null && Mem.stats.scored >= 5) {
        if (acc >= 60) J.addLesson("My directional calls are running " + acc + "% so far — the momentum read is holding; keep sizing to conviction.", "self");
        else if (acc <= 40) J.addLesson("My directional calls are only " + acc + "% lately — chop is high; widen the confidence bar before calling BUY/SELL.", "self");
      }
      memSave();
    }
    return Mem.stats;
  };

  // research a name on demand -> a saved learned note
  J.research = function (t) {
    var K = F.Kronos; if (!K || !t) return null;
    var f = K.forecast(t), s = K.signal(t);
    if (!f) return null;
    var name = (F.NAMES && F.NAMES[t]) || t, fu = fundOf(t), rp = rangePos(t);
    var price = (F.priceOf && F.priceOf(t)) || f.last;
    var L = [];
    L.push("📋 " + t + " — " + name + (fu && fu.sec ? " · " + fu.sec : ""));
    L.push("Price " + money(price) + (fu && capStr(fu.mc) ? " · " + capStr(fu.mc) + " market cap" : ""));
    var val = [];
    if (fu && fu.pe != null) val.push("P/E " + fu.pe + (fu.pe > 60 ? " (rich, growth-priced)" : fu.pe < 20 ? " (reasonable)" : " (fair)"));
    if (fu && fu.hi && fu.lo) val.push("52-wk " + money(fu.lo) + "–" + money(fu.hi) + (rp != null ? " (" + rp + "% of range)" : ""));
    if (val.length) L.push("Valuation: " + val.join(" · "));
    L.push("Model view: " + s.action + ", targeting " + money(f.predClose) + " (" + pct(f.predReturn) + ", " + Math.round(f.confidence) + "% conviction).");
    var take = s.action === "BUY"
      ? "The forecast leans higher" + (rp != null && rp <= 30 ? " and it's still low in its range — that's the kind of asymmetry I like" : "") + "."
      : s.action === "SELL"
        ? "The forecast leans lower" + (rp != null && rp >= 75 ? " and it's extended near highs — I'd tread carefully" : "") + "."
        : "It's balanced here — I'd wait for a cleaner setup.";
    L.push("My take: " + take);
    L.push("(Model estimate on simulated data — not advice.)");
    var brief = L.join("\n");
    J.addLesson(t + " researched " + new Date().toLocaleDateString() + ": " + s.action + " @ " + money(price) + " → " + money(f.predClose), "research");
    journalSignal(t, f.predReturn, f.last);
    return brief;
  };

  J.learnedSummary = function () {
    var st = Mem.stats;
    var acc = st.scored ? Math.round(st.hits / st.scored * 100) : null;
    var lines = ["Here's what I've learned so far:"];
    lines.push("• You've taught me " + Mem.facts.length + " thing" + (Mem.facts.length === 1 ? "" : "s") +
      ", and I've logged " + st.calls + " of my own calls" + (acc != null ? " (running " + acc + "% directional so far)" : "") + ".");
    if (Mem.facts.length) lines.push("What you told me: " + Mem.facts.slice(0, 5).map(function (f) { return "“" + f.text + "”"; }).join("; ") + ".");
    if (Mem.lessons.length) lines.push("Lessons I've drawn: " + Mem.lessons.slice(0, 3).map(function (l) { return l.text; }).join(" "));
    if (Mem.facts.length + Mem.lessons.length === 0) lines.push("Nothing yet — teach me with “remember …”, ask me to “research NVDA”, or thumbs-rate my answers and I'll adapt.");
    lines.push("(Pattern memory + self-scoring — not a promise of profit.)");
    return lines.join("\n");
  };

  // relevant taught facts for a topic (naive keyword recall)
  function recallFacts(q) {
    var ql = (q || "").toLowerCase();
    return Mem.facts.filter(function (f) {
      var words = f.text.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 3; });
      return words.some(function (w) { return ql.indexOf(w) !== -1; });
    }).slice(0, 3);
  }

  memLoad();

  /* ------------------------------------------------------------
     4)  GROUNDED NLU ENGINE — understands common desk questions and
         answers from real data. Falls back to the LLM (if wired) or
         a helpful capability prompt.
     ------------------------------------------------------------ */
  var TICKERS = function () { return F.PRICES ? Object.keys(F.PRICES) : []; };

  function findTicker(q) {
    var up = " " + q.toUpperCase() + " ";
    var list = TICKERS();
    // direct symbol match
    for (var i = 0; i < list.length; i++) {
      var re = new RegExp("[^A-Z]" + list[i] + "[^A-Z]");
      if (re.test(up)) return list[i];
    }
    // company name match
    if (F.NAMES) {
      var ql = q.toLowerCase();
      for (var k in F.NAMES) {
        var nm = (F.NAMES[k] || "").toLowerCase().split(" ")[0];
        if (nm && nm.length > 2 && ql.indexOf(nm) !== -1) return k;
      }
    }
    return null;
  }

  function has(q, words) {
    for (var i = 0; i < words.length; i++) if (q.indexOf(words[i]) !== -1) return true;
    return false;
  }

  function fundOf(t) { return (F.FUND && F.FUND[t]) || null; }
  function capStr(mc) { return mc == null ? null : (mc >= 1000 ? "$" + (mc / 1000).toFixed(2) + "T" : "$" + mc + "B"); }
  function rangePos(t) {
    var f = fundOf(t), p = F.priceOf && F.priceOf(t);
    if (!f || !f.hi || !f.lo || !p || f.hi === f.lo) return null;
    return Math.max(0, Math.min(100, Math.round((p - f.lo) / (f.hi - f.lo) * 100)));
  }
  function fundLine(t) {
    var f = fundOf(t); if (!f) return "";
    var bits = [];
    if (f.pe != null) bits.push("P/E " + f.pe);
    var c = capStr(f.mc); if (c) bits.push(c + " cap");
    var rp = rangePos(t); if (rp != null) bits.push(rp + "% of its 52-wk range");
    if (f.sec) bits.push(f.sec);
    return bits.join(" · ");
  }

  function priceAnswer(t) {
    var p = F.priceOf && F.priceOf(t), prev = F.prevClose && F.prevClose(t);
    var chg = prev ? (p - prev) / prev : 0;
    var move = !prev ? "" : Math.abs(chg) < 0.001 ? ", flat on the day" : ", " + pct(chg) + " on the day";
    var fl = fundLine(t);
    return t + " (" + ((F.NAMES && F.NAMES[t]) || t) + ") is trading " + money(p) + move + "." +
      (fl ? "\n" + fl + "." : "");
  }

  function signalAnswer(t) {
    var K = F.Kronos; if (!K) return "The forecast engine isn't loaded yet.";
    var s = K.signal(t), f = K.forecast(t);
    if (f) journalSignal(t, f.predReturn, f.last);   // learn from this call later
    var f2 = fundOf(t), rp = rangePos(t);
    // broker-style read
    var lead = s.action === "BUY" ? "I like the setup here" : s.action === "SELL" ? "I'd be cautious here" : "It's a coin-flip right now";
    var out = t + " — " + lead + ". My model reads " + s.action + ", predicting " + pct(s.predReturn) +
      " over the next few sessions to a target around " + money(f ? f.predClose : 0) + " (" + Math.round(s.confidence) + "% conviction).";
    // fundamental colour a broker would add
    var notes = [];
    if (rp != null) notes.push(rp <= 25 ? "It's near the low end of its 52-week range — value territory if the story holds" :
      rp >= 80 ? "It's stretched near 52-week highs, so I'd respect the risk" : "It's mid-range, room either way");
    if (f2 && f2.pe != null) notes.push(f2.pe > 60 ? "P/E of " + f2.pe + " is rich — priced for growth" : f2.pe < 20 ? "P/E of " + f2.pe + " is reasonable" : "P/E of " + f2.pe + " is fair");
    if (notes.length) out += " " + notes.join("; ") + ".";
    out += " Model estimate, not advice — you call it. Want me to place a paper trade?";
    return out;
  }

  function valuationAnswer(kind) {
    var v = J.valuation();
    var rows = kind === "over" ? v.over : v.under;
    if (!rows.length) return "Nothing is crossing the model's " + (kind === "over" ? "overvalued" : "undervalued") + " threshold right now.";
    var label = kind === "over" ? "Most overvalued (model sees downside):" : "Most undervalued (model sees upside):";
    var body = rows.map(function (r, i) {
      return (i + 1) + ". " + r.ticker + " — " + money(r.price) + " → fair " + money(r.fair) + " (" + pct(r.upside) + ", " + Math.round(r.conf) + "% conf)";
    }).join("\n");
    return label + "\n" + body + "\nModel estimates on a simulated feed — not advice.";
  }

  function fundAnswer() {
    // best-effort live fund; resolves async
    return new Promise(function (resolve) {
      var S = window.FluxSupa;
      if (S && S.autopilot) {
        Promise.resolve(S.autopilot()).then(function (fund) {
          if (fund && (fund.equity != null || fund.positions)) {
            var eq = fund.equity != null ? fund.equity : (fund.cash || 0);
            var pnl = fund.pnl != null ? fund.pnl : (fund.day_change != null ? fund.day_change : null);
            var pos = (fund.positions && fund.positions.length) || 0;
            resolve("The Flux Autopilot fund is at " + money(eq) +
              (pnl != null ? " (" + (pnl >= 0 ? "+" : "") + money(pnl) + " P&L)" : "") +
              " across " + pos + " positions. It trades a live $10k simulated account and posts its reasoning. Simulated — not real money.");
          } else { resolve(fundStatic()); }
        }).catch(function () { resolve(fundStatic()); });
      } else { resolve(fundStatic()); }
    });
  }
  function fundStatic() {
    return "The Flux Autopilot runs a live $10,000 simulated paper fund, scanning and trading on Kronos signals and posting hourly/daily reports. Open the Autopilot page to watch it. Simulated — not real money.";
  }

  function riskAnswer() {
    var taught = recallFacts("risk hold own rule position");
    var pre = taught.length ? "Going off what you told me (" + taught.map(function (f) { return "“" + f.text + "”"; }).join("; ") + "): " : "";
    var B = F.Book && F.Book.get ? F.Book.get() : null;
    if (B && B.positions && Object.keys(B.positions).length) {
      var syms = Object.keys(B.positions);
      return pre + "Your paper book holds " + syms.length + " names: " + syms.join(", ") +
        ". Watch concentration — if they move together, one bad print hits them all. Want a Kronos read on any of them?";
    }
    return pre + "Concentration and correlation are the usual risks — too much in names that move together. Load up a paper book on the terminal and I'll watch it in real time.";
  }

  function moversAnswer() {
    var list = TICKERS().map(function (t) {
      var p = F.priceOf && F.priceOf(t), pr = F.prevClose && F.prevClose(t);
      return { t: t, chg: pr ? (p - pr) / pr : 0 };
    }).filter(function (r) { return r.chg; });
    list.sort(function (a, b) { return b.chg - a.chg; });
    var up = list.slice(0, 3).map(function (r) { return r.t + " " + pct(r.chg); });
    var dn = list.slice(-3).reverse().map(function (r) { return r.t + " " + pct(r.chg); });
    return "Top movers (simulated): ▲ " + up.join(", ") + "  ▼ " + dn.join(", ") + ".";
  }

  var CAP = "I'm Fluxi — your AI desk, and I learn as we go. Ask me things like:\n• \"What's NVDA at?\"\n• \"Is AMD undervalued?\"\n• \"Show me the most overvalued stocks\"\n• \"Give me a market brief\"\n• \"How's the fund doing?\"\n• \"What's my biggest risk?\"\nTeach me anything: \"remember I hold NVDA\" or \"my rule is max 8% per name.\" Ask me to \"research TSLA\" and I'll save what I find. Say \"what have you learned?\" anytime.\nEverything I show is simulated / a model estimate — never investment advice.";

  // Try the optional LLM edge function for free-form questions.
  function llm(q) {
    var S = window.FluxSupa;
    if (!S || !S.aiChat) return Promise.resolve(null);
    var ctx = { brief: safe(function () { return J.brief().text; }), valuation: safe(function () { var v = J.valuation(); return { under: v.under.map(short), over: v.over.map(short) }; }) };
    return Promise.resolve(S.aiChat(q, ctx)).catch(function () { return null; });
  }
  function short(r) { return { ticker: r.ticker, price: r.price, fair: r.fair, edge: r.edge }; }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  /* ---- TRADE hand-off: parse "buy 10 NVDA" / "sell $2k TSLA" ---- */
  function parseTrade(q) {
    var ql = q.toLowerCase();
    // don't treat advice questions as orders
    if (/\b(should|would|could|can i|do i|is it|worth|think|what if)\b/.test(ql)) return null;
    var sideM = ql.match(/\b(buy|sell|short|go long|long)\b/);
    if (!sideM) return null;
    var side = /sell|short/.test(sideM[1]) ? "sell" : "buy";
    var t = findTicker(q); if (!t) return { side: side, ticker: null, qty: null, need: "ticker" };
    // notional ($) or share count
    var mNotional = ql.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k|m)?/);
    var mShares = ql.match(/\b([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:shares?|sh)?\b/);
    var price = (F.priceOf && F.priceOf(t)) || 0;
    var qty = null, notional = null;
    if (mNotional) {
      notional = parseFloat(mNotional[1].replace(/,/g, "")) * (mNotional[2] === "k" ? 1e3 : mNotional[2] === "m" ? 1e6 : 1);
      qty = price ? Math.floor(notional / price) : null;
    } else if (mShares && mShares[1]) {
      qty = Math.floor(parseFloat(mShares[1].replace(/,/g, "")) * (mShares[2] === "k" ? 1e3 : 1));
    }
    if (!qty || qty < 1) return { side: side, ticker: t, qty: null, price: price, need: "qty" };
    return { side: side, ticker: t, qty: qty, price: price, cost: +(qty * price).toFixed(2) };
  }

  // Execute a confirmed paper trade against the local $100k book.
  J.executeTrade = function (a) {
    if (!a || !a.ticker || !a.qty) return { ok: false, msg: "Nothing to place." };
    if (!F.Book || !F.Book.place) return { ok: false, msg: "The paper book isn't loaded." };
    var res = F.Book.place({ side: a.side, ticker: a.ticker, qty: a.qty, type: "market" });
    // learn from the user's actual action
    if (res.ok) J.remember(a.side === "buy" ? ("I bought " + a.qty + " " + a.ticker) : ("I sold " + a.qty + " " + a.ticker));
    return res;
  };

  // Main entry — returns a Promise<{text, kind}>
  J.ask = function (input) {
    var q = (input || "").trim();
    var ql = q.toLowerCase();
    if (!q) return Promise.resolve({ text: CAP, kind: "help" });

    // greetings / identity / help
    if (/^(hi|hey|hello|yo|sup|jarvis|fluxi|flux)\b/.test(ql) && ql.length < 24)
      return Promise.resolve({ text: "Fluxi online. Six engines scanning, and I remember what you teach me. What are we looking at?", kind: "greet" });
    if (has(ql, ["your name", "who are you", "what are you", "what's your name", "whats your name"]))
      return Promise.resolve({ text: "I'm Fluxi — your AI trading desk. I read live signals, rank under/overvalued names, run the fund, and I learn from you and from how my own calls play out. Not a financial advisor — a research desk.", kind: "id" });
    if (has(ql, ["what can you", "help", "commands", "what do you do"]))
      return Promise.resolve({ text: CAP, kind: "help" });

    // ---- LEARNING: teach me / forget / what have you learned / research ----
    var teach = q.match(/^\s*(?:remember|note|keep in mind|don'?t forget|fyi|my rule is|my rules are|i hold|i own|i'm holding|im holding)\b[:,]?\s*(.*)$/i);
    if (teach) {
      var fact = teach[1] && teach[1].trim() ? teach[1].trim() : q.trim();
      // if they said "I hold NVDA" keep the whole phrase
      if (/^(i hold|i own|i'm holding|im holding|my rule)/i.test(q)) fact = q.trim();
      var ok = J.remember(fact);
      return Promise.resolve({ text: ok ? "Got it — I'll remember that: “" + fact + "”. It'll shape how I read your book." : "I already had that noted.", kind: "learn" });
    }
    if (has(ql, ["forget "])) {
      var n = J.forget(q.replace(/.*forget/i, "").trim());
      return Promise.resolve({ text: n ? "Done — dropped " + n + " note" + (n === 1 ? "" : "s") + "." : "I didn't have anything matching that.", kind: "learn" });
    }
    if (has(ql, ["what have you learned", "what did you learn", "what do you know", "your memory", "what did i teach", "show your memory", "what you know about me"]))
      return Promise.resolve({ text: J.learnedSummary(), kind: "learned" });
    var res = q.match(/\bresearch\s+([A-Za-z.]{1,6})\b/i);
    if (res) {
      var rt = findTicker(res[1]) || res[1].toUpperCase();
      var note = J.research(rt);
      return Promise.resolve({ text: note ? note + "\n\n(Saved to memory — I'll grade this call against what price actually does.)" : "I couldn't model " + rt + " — is it in my universe? Try a name like NVDA, TSLA or COIN.", kind: "research", ticker: rt });
    }

    // trade command -> confirm card (paper). "buy 10 NVDA", "sell $2k TSLA".
    // Checked before the ticker/advice intents so an explicit order wins.
    var tr = parseTrade(q);
    if (tr) {
      if (tr.need === "ticker") return Promise.resolve({ text: "Which name do you want to " + tr.side + "? e.g. \"" + tr.side + " 10 NVDA\".", kind: "chat" });
      if (tr.need === "qty") return Promise.resolve({ text: "How many shares of " + tr.ticker + " (at " + money(tr.price) + ")? Say a number or a dollar amount — e.g. \"" + tr.side + " 10 " + tr.ticker + "\" or \"" + tr.side + " $2000 " + tr.ticker + "\".", kind: "chat" });
      var verb = tr.side === "buy" ? "Buy" : "Sell";
      return Promise.resolve({
        text: verb + " " + tr.qty + " " + tr.ticker + " @ ~" + money(tr.price) + " ≈ " + money(tr.cost) +
          " on your paper account. Confirm?\n(Simulated $100k book. For a real brokerage, connect it on the Portfolio page.)",
        kind: "trade", action: tr
      });
    }

    // ticker-specific FIRST when a symbol is named (so "is NVDA undervalued?"
    // answers about NVDA, not the global list). Global lists handled below.
    var t0 = findTicker(q);
    if (t0) {
      if (has(ql, ["buy", "sell", "should i", "worth", "think", "signal", "forecast", "target",
                   "undervalued", "overvalued", "cheap", "expensive", "call", "prediction", "outlook", "bullish", "bearish"]))
        return Promise.resolve({ text: signalAnswer(t0), kind: "signal", ticker: t0 });
      if (has(ql, ["price", " at", "quote", "cost", "trading", "how much"]))
        return Promise.resolve({ text: priceAnswer(t0), kind: "price", ticker: t0 });
      return Promise.resolve({ text: priceAnswer(t0) + "\n" + signalAnswer(t0), kind: "signal", ticker: t0 });
    }

    // valuation (universe-wide — no specific ticker named)
    if (has(ql, ["undervalued", "cheap", "bargain", "oversold", "best buys", "top buys", "bullish"]))
      return Promise.resolve({ text: valuationAnswer("under"), kind: "valuation" });
    if (has(ql, ["overvalued", "expensive", "overbought", "shorts", "short ", "bearish", "avoid"]))
      return Promise.resolve({ text: valuationAnswer("over"), kind: "valuation" });

    // brief / market
    if (has(ql, ["brief", "summary", "what's happening", "whats happening", "market", "today", "overview", "rundown"]))
      return Promise.resolve({ text: J.brief().text, kind: "brief" });

    // fund / autopilot
    if (has(ql, ["fund", "autopilot", "auto pilot", "the desk trade", "how is it doing"]))
      return fundAnswer().then(function (txt) { return { text: txt, kind: "fund" }; });

    // risk
    if (has(ql, ["risk", "exposure", "concentration", "hedge"]))
      return Promise.resolve({ text: riskAnswer(), kind: "risk" });

    // movers
    if (has(ql, ["movers", "gainers", "losers", "moving", "up today", "down today"]))
      return Promise.resolve({ text: moversAnswer(), kind: "movers" });

    // free-form -> LLM if available, else capability prompt
    return llm(q).then(function (ans) {
      if (ans && ans.text) return { text: ans.text, kind: "llm" };
      if (ans && typeof ans === "string") return { text: ans, kind: "llm" };
      return { text: "I don't have that wired to real data yet, so I won't guess. " + CAP, kind: "fallback" };
    });
  };

  /* ------------------------------------------------------------
     5)  VOICE — speech recognition (listen) + synthesis (speak),
         using the browser's built-in Web Speech API. Free, no key.
     ------------------------------------------------------------ */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  J.voiceSupported = !!SR;
  J.ttsSupported = !!window.speechSynthesis;
  var rec = null, listening = false, voice = null;

  function pickVoice() {
    if (!J.ttsSupported) return;
    var vs = window.speechSynthesis.getVoices() || [];
    // prefer a crisp English male-ish/neutral voice for the "JARVIS" feel
    voice = vs.filter(function (v) { return /en(-|_)?(GB|US)/i.test(v.lang); })
      .sort(function (a, b) { return (/Daniel|Google UK|Arthur|male/i.test(b.name) ? 1 : 0) - (/Daniel|Google UK|Arthur|male/i.test(a.name) ? 1 : 0); })[0] || vs[0] || null;
  }
  if (J.ttsSupported) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  J.speak = function (text) {
    if (!J.ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      // strip the bullet/newline formatting for speech; keep it short-ish
      var say = text.replace(/[•▲▼]/g, "").replace(/\n+/g, ". ").slice(0, 380);
      var u = new SpeechSynthesisUtterance(say);
      if (voice) u.voice = voice;
      u.rate = 1.02; u.pitch = 0.92; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  };
  J.stopSpeaking = function () { try { window.speechSynthesis.cancel(); } catch (e) {} };

  // onResult(transcript, isFinal); onState(state) where state in start|end|error
  J.listen = function (onResult, onState) {
    if (!SR) { onState && onState("error"); return false; }
    if (listening) { J.stopListen(); return false; }
    rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = function () { listening = true; onState && onState("start"); };
    rec.onend = function () { listening = false; onState && onState("end"); };
    rec.onerror = function (e) { listening = false; onState && onState("error", e && e.error); };
    rec.onresult = function (e) {
      var txt = "", fin = false;
      for (var i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
        if (e.results[i].isFinal) fin = true;
      }
      onResult && onResult(txt.trim(), fin);
    };
    try { rec.start(); } catch (e) { listening = false; onState && onState("error"); return false; }
    return true;
  };
  J.stopListen = function () { try { rec && rec.stop(); } catch (e) {} listening = false; };
  J.isListening = function () { return listening; };
})();
