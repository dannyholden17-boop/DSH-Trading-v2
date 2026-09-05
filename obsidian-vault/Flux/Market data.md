---
title: Market data
aliases:
  - Quotes
  - The feed
tags:
  - dsh
  - flux
  - data
type: architecture
status: live
---

# Market data

Every quote on [[Flux]] resolves through one server-side path: the `quotes`
Supabase edge function.

```
quotes()  →  licensed provider (if FLUX_QUOTES_PROVIDER set)
          →  Yahoo    (keyless, the default)
          →  Stooq    (last-resort fallback)
```

Clients poll it — `flux-feed.js` for the main site, `dsh-feed.js` for the phone
and desktop surfaces. Nothing calls a market-data API from the browser any more.

> [!info] Switching provider is one environment variable
> ```
> FLUX_QUOTES_PROVIDER = polygon | finnhub | alpaca | twelvedata
> FLUX_QUOTES_KEY      = <key>
> FLUX_QUOTES_SECRET   = <secret>   # alpaca only
> ```
> Set them in Supabase and the whole site flips over with no deploy. Unset or
> failing, it falls back to Yahoo and keeps working.

## What changed, and why

`app.html` and `desktop.html` used to be the exception: they called Finnhub
directly from the browser on a key **hardcoded in `dsh-feed.js`**, and streamed
trades over a Finnhub websocket. That published a live credential in public
source on every page load, and made two surfaces run on a different provider
from the rest of the site. Both are gone.

The cost is tick streaming on those two pages — the free feed is REST, so they
poll every ten seconds like everything else already did. The gain is that a dead
feed now says so: three consecutive failed polls flip the pill to **Sim** and
clear the live flag, rather than leaving a stale price on screen looking
current. That is [[Truthfulness constraints|rule 4]] applied to the feed.

> [!warning] Unresolved: Yahoo is not licensed for this
> The free Yahoo endpoints are undocumented and their terms do not permit
> commercial redistribution. Fine for a build; a real question for a product
> that gets sold. The licensed-provider hook above exists precisely so this can
> be answered without touching code.
