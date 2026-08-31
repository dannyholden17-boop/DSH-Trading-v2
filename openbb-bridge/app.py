#!/usr/bin/env python3
"""
OpenBB → Flux bridge.

OpenBB is a Python research platform (fundamentals, analyst estimates, macro,
SEC filings) — it can't run in a browser or in a Deno Edge Function, so it lives
here, in a small HTTP service you deploy once. The Flux site never talks to it
directly: the `research` Edge Function proxies and caches it.

    OpenBB (Python)  ──►  this service  ──►  Edge Function `research`  ──►  Flux site
                            (FastAPI)          (proxy + cache)             (terminal, research)

Everything exposed here uses OpenBB providers that need **no API key**:
    yfinance          equity fundamentals, key metrics, profile, analyst consensus
    federal_reserve   treasury rates / yield curve, effective fed funds rate
    oecd              CPI and unemployment
    sec               company filings

Optional keys (set them and OpenBB picks them up automatically) unlock better
sources — e.g. OPENBB_FRED_API_KEY, OPENBB_FMP_API_KEY.

--------------------------------------------------------------------------------
RUN

    pip install -r requirements.txt
    export BRIDGE_TOKEN="a-long-random-string"     # required in production
    uvicorn app:app --host 0.0.0.0 --port 8000

Then point the Edge Function at it:

    supabase secrets set OPENBB_BRIDGE_URL="https://your-host"
    supabase secrets set OPENBB_BRIDGE_TOKEN="the same random string"

The first OpenBB import takes a few seconds; the service warms it at startup.
--------------------------------------------------------------------------------
"""
import os
import time
import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("openbb-bridge")
logging.basicConfig(level=logging.INFO)

BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "").strip()
CACHE_TTL = int(os.environ.get("CACHE_TTL", "1800"))          # 30 min
MACRO_TTL = int(os.environ.get("MACRO_TTL", "21600"))         # 6 h

app = FastAPI(title="OpenBB → Flux bridge", version="1.0.0")

# --------------------------------------------------------------------------- #
# tiny TTL cache — one process, no dependencies
# --------------------------------------------------------------------------- #
_cache: Dict[str, tuple] = {}


def cached(key: str, ttl: int, fn):
    hit = _cache.get(key)
    if hit and (time.time() - hit[0]) < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


# --------------------------------------------------------------------------- #
# OpenBB is imported lazily so the process starts (and /health answers) even if
# the import is slow or an extension is missing.
# --------------------------------------------------------------------------- #
_obb = None


def obb():
    global _obb
    if _obb is None:
        from openbb import obb as _o  # noqa: WPS433 (deliberate lazy import)
        _obb = _o
    return _obb


def rows(result) -> List[Dict[str, Any]]:
    """OBBject -> plain list of dicts, JSON-safe."""
    out = []
    for r in (getattr(result, "results", None) or []):
        d = r.model_dump() if hasattr(r, "model_dump") else dict(r)
        out.append({k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in d.items()})
    return out


def first(result) -> Optional[Dict[str, Any]]:
    r = rows(result)
    return r[0] if r else None


def pick(d: Optional[Dict[str, Any]], *names):
    """First non-null of the given field names — tolerant of provider drift."""
    if not d:
        return None
    for n in names:
        v = d.get(n)
        if v is not None:
            return v
    return None


def ok(payload: Dict[str, Any]):
    return {"ok": True, "source": "openbb", **payload}


def clean(msg) -> str:
    """OpenBB errors arrive multi-line; make them one readable sentence."""
    return " ".join(str(msg).split())[:400]


def fail(msg, status: int = 502):
    return JSONResponse({"ok": False, "error": clean(msg)}, status_code=status)


@app.middleware("http")
async def auth(request: Request, call_next):
    if BRIDGE_TOKEN and request.url.path != "/health":
        sent = request.headers.get("authorization", "")
        if sent != "Bearer " + BRIDGE_TOKEN:
            return JSONResponse({"ok": False, "error": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.on_event("startup")
def warm():
    try:
        obb()
        log.info("OpenBB loaded")
    except Exception as e:  # noqa: BLE001
        log.warning("OpenBB not loaded at startup: %s", e)


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #
@app.get("/health")
def health():
    try:
        providers = sorted(obb().coverage.providers.keys())
        return {"ok": True, "openbb": True, "providers": providers, "token": bool(BRIDGE_TOKEN)}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "openbb": False, "error": clean(e)[:300]}


@app.get("/fundamentals")
def fundamentals(symbol: str = Query(..., min_length=1, max_length=12)):
    """Key metrics + company profile for one symbol (yfinance, no key needed)."""
    sym = symbol.upper().strip()

    def load():
        o = obb()
        m = first(o.equity.fundamental.metrics(symbol=sym, provider="yfinance"))
        p = first(o.equity.profile(symbol=sym, provider="yfinance"))
        return {
            "symbol": sym,
            "name": pick(p, "name", "legal_name"),
            "sector": pick(p, "sector"),
            "industry": pick(p, "industry_category", "industry_group"),
            "employees": pick(p, "employees"),
            "description": pick(p, "short_description"),
            "website": pick(p, "company_url"),
            "exchange": pick(p, "stock_exchange"),
            "market_cap": pick(m, "market_cap") or pick(p, "market_cap"),
            "beta": pick(m, "beta") or pick(p, "beta"),
            "pe": pick(m, "pe_ratio"),
            "forward_pe": pick(m, "forward_pe"),
            "peg": pick(m, "peg_ratio_ttm", "peg_ratio"),
            "price_to_book": pick(m, "price_to_book"),
            "eps_ttm": pick(m, "eps_ttm"),
            "eps_forward": pick(m, "eps_forward"),
            "revenue_growth": pick(m, "revenue_growth"),
            "earnings_growth": pick(m, "earnings_growth"),
            "gross_margin": pick(m, "gross_margin"),
            "operating_margin": pick(m, "operating_margin"),
            "profit_margin": pick(m, "profit_margin"),
            "ebitda_margin": pick(m, "ebitda_margin"),
            "return_on_equity": pick(m, "return_on_equity"),
            "return_on_assets": pick(m, "return_on_assets"),
            "debt_to_equity": pick(m, "debt_to_equity"),
            "current_ratio": pick(m, "current_ratio"),
            "quick_ratio": pick(m, "quick_ratio"),
            "dividend_yield": pick(m, "dividend_yield"),
            "payout_ratio": pick(m, "payout_ratio"),
            "book_value": pick(m, "book_value"),
            "cash_per_share": pick(m, "cash_per_share"),
            "enterprise_value": pick(m, "enterprise_value"),
            "ev_to_ebitda": pick(m, "enterprise_to_ebitda"),
            "shares_outstanding": pick(p, "shares_outstanding"),
            "shares_float": pick(p, "shares_float"),
            "price_return_1y": pick(m, "price_return_1y"),
        }

    try:
        return ok({"fundamentals": cached("fund:" + sym, CACHE_TTL, load)})
    except Exception as e:  # noqa: BLE001
        return fail(e)


@app.get("/estimates")
def estimates(symbol: str = Query(..., min_length=1, max_length=12)):
    """Wall-street price-target consensus and recommendation."""
    sym = symbol.upper().strip()

    def load():
        c = first(obb().equity.estimates.consensus(symbol=sym, provider="yfinance"))
        return {
            "symbol": sym,
            "target": pick(c, "target_consensus", "target_median"),
            "target_high": pick(c, "target_high"),
            "target_low": pick(c, "target_low"),
            "target_median": pick(c, "target_median"),
            "current_price": pick(c, "current_price"),
            "analysts": pick(c, "number_of_analysts"),
            "recommendation": pick(c, "recommendation"),
            "recommendation_mean": pick(c, "recommendation_mean"),
        }

    try:
        return ok({"estimates": cached("est:" + sym, CACHE_TTL, load)})
    except Exception as e:  # noqa: BLE001
        return fail(e)


@app.get("/filings")
def filings(symbol: str = Query(..., min_length=1, max_length=12), limit: int = 8):
    """Recent SEC filings for a symbol (10-K, 10-Q, 8-K, insider forms…)."""
    sym = symbol.upper().strip()
    lim = max(1, min(30, limit))

    def load():
        r = rows(obb().equity.fundamental.filings(symbol=sym, provider="sec"))
        out = []
        for f in r[:lim]:
            out.append({
                "type": pick(f, "report_type", "filing_type", "type"),
                "date": pick(f, "filing_date", "date", "accepted_date"),
                "title": pick(f, "report_title", "primary_doc_description", "description"),
                "url": pick(f, "report_url", "filing_url", "url", "link"),
            })
        return out

    try:
        return ok({"filings": cached("fil:" + sym + ":" + str(lim), CACHE_TTL, load)})
    except Exception as e:  # noqa: BLE001
        return fail(e)


@app.get("/macro")
def macro():
    """The macro backdrop: the curve, the policy rate, inflation, unemployment."""

    def load():
        o = obb()
        out: Dict[str, Any] = {}

        # Treasury curve (Federal Reserve H.15) — latest row
        try:
            t = rows(o.fixedincome.government.treasury_rates(provider="federal_reserve"))
            if t:
                last = t[-1]
                out["curve"] = {
                    "date": last.get("date"),
                    "m3": last.get("month_3"),
                    "y2": last.get("year_2"),
                    "y5": last.get("year_5"),
                    "y10": last.get("year_10"),
                    "y30": last.get("year_30"),
                }
                y2, y10 = last.get("year_2"), last.get("year_10")
                if y2 is not None and y10 is not None:
                    out["curve"]["spread_10y_2y"] = round(float(y10) - float(y2), 3)
                    out["curve"]["inverted"] = float(y10) < float(y2)
        except Exception as e:  # noqa: BLE001
            out["curve_error"] = clean(e)[:180]

        # Effective fed funds rate — latest print
        try:
            e = rows(o.fixedincome.rate.effr(provider="federal_reserve"))
            if e:
                out["policy_rate"] = {"date": e[-1].get("date"), "value": pick(e[-1], "rate", "value")}
        except Exception as ex:  # noqa: BLE001
            out["policy_rate_error"] = clean(ex)[:180]

        # US CPI, year-over-year
        try:
            c = rows(o.economy.cpi(country="united_states", transform="yoy", provider="oecd"))
            if c:
                out["cpi_yoy"] = {"date": c[-1].get("date"), "value": pick(c[-1], "value")}
        except Exception as ex:  # noqa: BLE001
            out["cpi_error"] = clean(ex)[:180]

        # US unemployment rate
        try:
            u = rows(o.economy.unemployment(country="united_states", provider="oecd"))
            if u:
                out["unemployment"] = {"date": u[-1].get("date"), "value": pick(u[-1], "value")}
        except Exception as ex:  # noqa: BLE001
            out["unemployment_error"] = clean(ex)[:180]

        out["as_of"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return out

    try:
        m = cached("macro", MACRO_TTL, load)
        # if every series failed there is nothing to show — say so rather than
        # returning an "ok" object full of error strings
        if not any(k in m for k in ("curve", "policy_rate", "cpi_yoy", "unemployment")):
            _cache.pop("macro", None)
            return fail("no macro series available: " + "; ".join(
                str(v) for k, v in m.items() if k.endswith("_error")))
        return ok({"macro": m})
    except Exception as e:  # noqa: BLE001
        return fail(e)


@app.get("/movers")
def movers(kind: str = "gainers", limit: int = 10):
    """Market movers straight from OpenBB's discovery module."""
    k = kind.lower().strip()
    fns = {"gainers": "gainers", "losers": "losers", "active": "active"}
    if k not in fns:
        raise HTTPException(status_code=400, detail="kind must be gainers, losers or active")
    lim = max(1, min(50, limit))

    def load():
        fn = getattr(obb().equity.discovery, fns[k])
        return [
            {
                "symbol": pick(r, "symbol"),
                "name": pick(r, "name"),
                "price": pick(r, "price"),
                "change": pick(r, "change"),
                "percent": pick(r, "percent_change", "change_percent"),
                "volume": pick(r, "volume"),
            }
            for r in rows(fn(provider="yfinance"))[:lim]
        ]

    try:
        return ok({"kind": k, "movers": cached("mov:" + k + ":" + str(lim), 600, load)})
    except Exception as e:  # noqa: BLE001
        return fail(e)
