/* ============================================================
   FLUX — the research desk (client)

   Reads the persistent research loop out of Supabase:

     3 analysts → 2 traders (their boss) → Executive

   Rounds and the executive's green-lit calls are public; the
   analysts' actual filings are for signed-in members (row-level
   security enforces both, this file just asks).
   ============================================================ */
(function(){
  "use strict";
  var F = window.FLUX = window.FLUX || {};
  var BASE = "https://pyzcwddyagodmtjuvwdn.supabase.co";
  var KEY_ = "sb_publishable_CIYiWNtbGgXDQgEj2kyvrw_AMxXwr8l";

  /* Data access goes through the Supabase SDK when it is up, so a signed-in
     member's JWT is attached and row-level security hands back the full desk.
     Before the SDK loads (or signed out) we fall back to plain REST with the
     publishable key, which returns exactly what anon is allowed to see. */
  function client(){
    var S = window.FluxSupa;
    return (S && S.client) || null;
  }
  function ready(){
    var S = window.FluxSupa;
    return (S && S.ready) ? S.ready.catch(function(){ return false; }) : Promise.resolve(false);
  }
  /* ---- how failure is reported -------------------------------------------

     Every call in this file used to end in .catch(-> []). That made an empty
     result indistinguishable from permission denied, from a network drop, and
     from the server falling over, so a page could only ever guess: the
     analysts page read "no rows" as "you are not a member" and showed a
     sign-in gate to signed-in members whose round had simply failed.

     Reads now resolve to a result object. The shape carries the reason, and
     the .rows array is always present so a caller that only wants the happy
     path can keep using it. F.Desk.ok(res) is the one-line check.        */
  var TIMEOUT = 12000;

  function res(kind, rows, detail){
    return { ok: kind === "ok", kind: kind, rows: rows || [], error: kind === "ok" ? null : (detail || kind) };
  }
  /** ok | empty | auth | denied | timeout | offline | server | bad */
  function classify(status){
    if(status === 401) return "auth";
    if(status === 403) return "denied";
    if(status === 408 || status === 504) return "timeout";
    if(status >= 500) return "server";
    return "bad";
  }
  function withTimeout(run){
    /* AbortController rather than Promise.race: racing leaves the request in
       flight, and on a slow phone that is how you end up with four of them. */
    var ac = ("AbortController" in window) ? new AbortController() : null;
    var t = setTimeout(function(){ if(ac) ac.abort(); }, TIMEOUT);
    return run(ac && ac.signal).then(
      function(v){ clearTimeout(t); return v; },
      function(e){ clearTimeout(t);
        var aborted = e && (e.name === "AbortError" || e.code === 20);
        return res(aborted ? "timeout" : "offline", [], aborted ? "timed out" : "network"); });
  }

  function restGet(path){
    return withTimeout(function(signal){
      return fetch(BASE + "/rest/v1/" + path, {
        headers: { apikey: KEY_, authorization: "Bearer " + KEY_ },
        signal: signal
      }).then(function(r){
        if(!r.ok) return res(classify(r.status), [], "HTTP " + r.status);
        return r.json().then(function(j){
          var rows = Array.isArray(j) ? j : (j == null ? [] : [j]);
          return res(rows.length ? "ok" : "empty", rows);
        }, function(){ return res("bad", [], "unparseable"); });
      });
    });
  }
  /** table query: [{select, order, asc, limit, eq:{col:val}}] */
  function q(table, o){
    o = o || {};
    return ready().then(function(){
      var c = client();
      if(!c) {
        var p = table + "?select=" + encodeURIComponent(o.select || "*");
        if(o.eq) for(var k in o.eq) if(Object.prototype.hasOwnProperty.call(o.eq,k))
          p += "&" + k + "=eq." + encodeURIComponent(o.eq[k]);
        if(o.order) p += "&order=" + o.order + "." + (o.asc ? "asc" : "desc");
        if(o.limit) p += "&limit=" + o.limit;
        return restGet(p);
      }
      var b = c.from(table).select(o.select || "*");
      if(o.eq) for(var k2 in o.eq) if(Object.prototype.hasOwnProperty.call(o.eq,k2)) b = b.eq(k2, o.eq[k2]);
      if(o.order) b = b.order(o.order, { ascending: !!o.asc });
      if(o.limit) b = b.limit(o.limit);
      return withTimeout(function(){
        return Promise.resolve(b).then(function(r){
          /* PostgREST reports a policy refusal as an error with a code, not as
             an empty set. Keeping them apart is the whole point of this file. */
          if(r && r.error){
            var code = String(r.error.code || "");
            var kind = code === "42501" ? "denied"
                     : code === "PGRST301" || code === "PGRST302" ? "auth"
                     : "server";
            return res(kind, [], r.error.message || code);
          }
          var rows = (r && r.data) || [];
          return res(rows.length ? "ok" : "empty", rows);
        });
      });
    });
  }
  function rpc(fn){
    return ready().then(function(){
      var c = client();
      if(c) return withTimeout(function(){
        return Promise.resolve(c.rpc(fn)).then(function(r){
          if(r && r.error) return res("server", [], r.error.message || "rpc failed");
          var d = r && r.data;
          return d == null ? res("empty", []) : res("ok", [d]);
        });
      });
      return withTimeout(function(signal){
        return fetch(BASE + "/rest/v1/rpc/" + fn, {
          method: "POST",
          headers: { "Content-Type":"application/json", apikey: KEY_, authorization: "Bearer " + KEY_ },
          body: "{}", signal: signal
        }).then(function(r){
          if(!r.ok) return res(classify(r.status), [], "HTTP " + r.status);
          return r.json().then(function(j){
            return j == null ? res("empty", []) : res("ok", [j]);
          }, function(){ return res("bad", [], "unparseable"); });
        });
      });
    });
  }
  /* One value out of an rpc result, or null. */
  function one(r){
    if(!r || !r.ok) return null;
    var v = r.rows[0];
    return Array.isArray(v) ? (v[0] || null) : (v == null ? null : v);
  }

  var STAGES = ["open", "analysts", "traders", "executive", "done"];
  var STAGE_LABEL = {
    open: "Scanning the tape",
    analysts: "Analysts researching",
    traders: "Traders sifting the filings",
    executive: "Executive ruling",
    done: "Round filed"
  };

  var D = F.Desk = {
    STAGES: STAGES,
    stageLabel: function(s){ return STAGE_LABEL[s] || s; },
    stageIndex: function(s){ var i = STAGES.indexOf(s); return i < 0 ? 0 : i; },

    /* Every method below resolves to the plain value or array a caller
       already expected, so existing pages are unchanged. The matching
       *Result method hands back { ok, kind, rows, error } for a caller that
       needs to tell "nothing filed" apart from "you may not read this". */
    ok: function(r){ return !!(r && r.ok); },

    /** What the desk is doing right now. */
    status: function(){ return rpc("desk_status").then(one); },

    /** One snapshot of the current round for the public floor board.
        The round and its meta are public already; the filing and ruling
        tallies are counts only — the words stay behind sign-in. */
    floor: function(){ return rpc("desk_floor").then(one); },
    floorResult: function(){
      return rpc("desk_floor").then(function(r){
        return { ok: r.ok, kind: r.kind, error: r.error, value: one(r) };
      });
    },

    /** Per-agent standing: counts, rates and averages only, never text.
        Backs the Analysts, Traders and Executive pages. */
    agents: function(){ return rpc("desk_agents").then(one); },
    agentsResult: function(){
      return rpc("desk_agents").then(function(r){
        return { ok: r.ok, kind: r.kind, error: r.error, value: one(r) };
      });
    },

    /** Recent rounds, newest first. */
    rounds: function(limit){ return this.roundsResult(limit).then(function(r){ return r.rows; }); },
    roundsResult: function(limit){
      return q("desk_rounds", { select:"id,seq,stage,status,tickers,started_at,finished_at,meta",
        order:"seq", limit: limit || 8 });
    },

    /** The executive's rulings, newest first. Signed out this returns the teasers. */
    decisions: function(limit){ return this.decisionsResult(limit).then(function(r){ return r.rows; }); },
    decisionsResult: function(limit){
      return q("desk_decisions", { order:"created_at", limit: limit || 24 });
    },

    /** Everything every agent filed in one round.
        Row-level security keeps these to signed-in members, so a signed-out
        reader gets kind:"denied" or an empty set rather than the words. */
    notes: function(roundId){ return this.notesResult(roundId).then(function(r){ return r.rows; }); },
    notesResult: function(roundId){
      return q("desk_notes", { select:"stage,agent,ticker,payload,created_at",
        eq:{ round_id: roundId }, order:"id", asc:true, limit: 200 });
    },

    /** The desk's work on one ticker, across rounds. */
    forTicker: function(t, limit){
      return q("desk_decisions", { eq:{ ticker:(t||"").toUpperCase() }, order:"created_at", limit: limit || 5 })
        .then(function(r){ return r.rows; });
    },

    /* ---- presentation helpers, shared by the page and the widgets ---- */
    verdictColor: function(v){
      if(v === "approved") return "var(--emerald)";
      if(v === "reduced")  return "#f6c453";
      return "var(--crimson)";
    },
    sideColor: function(s){
      if(s === "long")  return "var(--emerald)";
      if(s === "short" || s === "avoid") return "var(--crimson)";
      return "var(--text-dim)";
    },
    ago: function(ts){
      if(!ts) return "—";
      var s = Math.max(0, (Date.now() - Date.parse(ts)) / 1000);
      if(s < 60) return Math.round(s) + "s ago";
      if(s < 3600) return Math.round(s/60) + "m ago";
      if(s < 86400) return Math.round(s/3600) + "h ago";
      return Math.round(s/86400) + "d ago";
    },
    money: function(n){
      if(n == null || isNaN(n)) return "—";
      return "$" + (+n).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
    },

    /** Compact "the desk is working" widget for other pages. */
    mountStatus: function(el, opts){
      if(!el) return null;
      opts = opts || {};
      function paint(){
        return D.status().then(function(s){
          if(!s){ el.innerHTML = '<span class="dk-w-idle">The desk is starting up…</span>'; return; }
          var live = s.status === "running";
          var pct = Math.round(D.stageIndex(s.stage) / (STAGES.length - 1) * 100);
          el.innerHTML =
            '<div class="dk-w">' +
              '<div class="dk-w-top">' +
                '<span class="dk-w-dot' + (live ? " on" : "") + '"></span>' +
                '<b>' + (live ? D.stageLabel(s.stage) : "Round " + s.seq + " filed") + '</b>' +
                '<span class="dk-w-ago">' + D.ago(s.finished_at || s.started_at) + '</span>' +
              '</div>' +
              '<div class="dk-w-bar"><i style="transform:scaleX(' + (pct/100) + ')"></i></div>' +
              '<div class="dk-w-sub">' +
                (s.tickers || []).slice(0, 6).join(" · ") +
                (s.approved ? ' <b class="ok">' + s.approved + ' green-lit</b>' : "") +
                (s.rounds_today ? ' <span class="mut">' + s.rounds_today + ' rounds / 24h</span>' : "") +
              '</div>' +
            '</div>';
        });
      }
      paint();
      var timer = setInterval(paint, opts.every || 20000);
      return { refresh: paint, stop: function(){ clearInterval(timer); } };
    }
  };
  window.FLUXDesk = D;
})();
