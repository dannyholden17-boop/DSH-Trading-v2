# Brokerage connect (bring your own broker)

The terminal's **Brokerage** toggle is real now. A member pastes their own broker
API keys into the Account card and every account-derived panel — equity, day P/L,
cash, buying power, positions, orders, and the order ticket — switches to the
**broker's own numbers**. Paper values are never shown in that mode.

```
browser (keys in localStorage)  ──►  Edge Function `broker`  ──►  broker REST API
        flux-broker.js                (stateless proxy)            (Alpaca today)
```

## Why a proxy at all

A browser can't call a brokerage API directly — no CORS, and a secret pinned to a
web origin isn't a secret. `supabase/functions/broker/index.ts` is a **stateless**
relay: it uses the credentials for exactly one upstream call and never stores,
caches or logs them. Nothing about a member's broker is written to the Flux
database.

## Alpaca (implemented)

1. Sign up at <https://alpaca.markets> (free).
2. **Paper trading → API keys → Generate.** You get a key id (`PK…`) and a secret.
   The secret is shown once.
3. In the terminal: Account card → **Brokerage** → paste both → Connect.

Paper is the default. To trade real money, switch the segment to **Live money**
before connecting and use live keys; the terminal then labels the account
`LIVE MONEY`, and every order asks for confirmation naming the symbol, quantity
and that it is real.

Actions the function supports: `verify`, `account`, `positions`, `orders`,
`snapshot` (all three in one round trip — what the terminal polls every 20s),
`place`, `cancel`.

Market/limit orders are supported today (`time_in_force: day`); the payload
builder already handles `stop` and `stop_limit` when the ticket grows those types.

## SnapTrade (not wired)

SnapTrade is the better long-term answer for "connect the brokerage you already
have" — one integration covering Robinhood, Schwab, Fidelity, IBKR, Webull and
others. It is **not** a paste-your-key integration:

* it needs partner credentials (`clientId` + `consumerKey`) issued to DSH Trading,
* every request is HMAC-signed server-side,
* users are registered through SnapTrade's own connection portal and Flux stores
  a `userSecret` per member.

So it belongs behind server-side config, not a form field. `broker` returns a
clear `501 snaptrade_not_configured` for that provider rather than pretending.
When the partner credentials exist, add them as Edge Function secrets
(`SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`), implement the signed calls in
the same file behind `provider === "snaptrade"`, and return the same normalised
shapes — the client and every panel already speak that shape and need no changes.

## Response shapes (what the terminal paints)

```jsonc
account   { equity, cash, buying_power, day_pl, day_pl_pct, currency,
            status, account_number, pattern_day_trader, trading_blocked }
positions [{ ticker, qty, side, avg, price, mkt, pl, plPct, dayPl }]
orders    [{ id, ticker, side, qty, price, type, status, tif, ts, filled }]
```

## Safety notes

* Live mode is opt-in twice: once when connecting, once per order.
* "Reset account" only ever touches the paper book; in Brokerage mode it refuses.
* Disconnecting clears the keys from the browser. There is nothing to clear
  server-side, by design.
* Flux places an order only when the member presses the button. Nothing in
  Autopilot trades a connected brokerage account.
