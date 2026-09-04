# Flux — DSH Sentinel

**The autonomous trading desk. Six engines that never sleep.**

> UI: **Obsidian Flux** — a liquid-glass design system (deep obsidian, electric
> cyan + vivid violet, Inter + JetBrains Mono) with a Webull-grade pro terminal.

DSH Sentinel is an autonomous AI trading-desk concept: six background engines
scan the market around the clock, an AI core reasons over the noise, and only
the moves worth acting on reach you — with the research already done.

This repository holds the **product**: a high-end marketing site, a working
product-app prototype, a shared design system, and the supporting design &
planning material.

---

## ▶ The product (`site/`)

A cohesive, production-quality front end built on one design system.

| File | What it is |
|------|-----------|
| **`site/index.html`** | The marketing / landing page — hero with a live demo, the six-engine story, how it works, features, pricing, FAQ, CTA. This is the page you sell. |
| **`site/app.html`** | The product — the Flux app: neural AI core, alpha signals, ask-Flux bar, watchlist, live portfolio (P&L, allocation), alerts, and a pro terminal (candlesticks, DOM ladder, time & sales) on every symbol. |
| **`site/assets/dsh.js`** | Shared signal/engine data and helpers. |
| **`site/assets/dsh-store.js`** | Persistent state: flags, paper positions, watchlist, activity, price engine. |
| **`site/assets/dsh-feed.js`** | Live market data adapter (Finnhub REST + WebSocket) with simulation fallback. |

**To view:** open `site/index.html` in any browser. No build step, no
dependencies, works offline. Click **Open app** to reach the cockpit; both
pages support light and dark themes (toggle in the top bar).

**Live preview:** the site auto-deploys to GitHub Pages on every push to
`main` (enable it once under *Settings → Pages → Source: GitHub Actions*).
Self-contained hosted demos are also published here:
- Landing — https://claude.ai/code/artifact/78218c43-3271-45b5-8d83-fe04fde639e6
- Product app — https://claude.ai/code/artifact/ad7354a8-933c-4ea9-8933-7f492048a5aa

### Design system at a glance
- **Identity:** premium fintech — deep blue-black cockpit, a bioluminescent
  mint→violet brand gradient, semantic green/red/amber for market state.
- **Type:** a display face for headlines, a clean sans for body, and monospace
  for data/telemetry, all on a fluid type scale.
- **Themes:** fully designed light *and* dark, driven entirely by CSS tokens.
- **Responsive & accessible:** fluid layouts, visible focus states, and
  `prefers-reduced-motion` respected throughout.

---

## The thinking behind it

- **`obsidian-vault/`** — the whole project as a linked Obsidian vault: the
  Sentinel concept, the six engines, the architecture, and the roadmap, plus a
  `.base` engine registry and a `.canvas` system map.
- **`docs/`** — the roadmap and the live-trading blueprint.

## Early exploration (archive)

The original mockups that led here, kept for reference:

- **`design-concepts/`** — Aurora, Aurora v2, and the Conversational Cockpit.
- **`dsh-living-bot.html`** — the first Sentinel prototype.
- **`dsh-all-work.html`** — a combined single-file view of the early work.

---

## Status & disclaimer

This is a **product prototype**. The live data in the app is a realistic
simulation used to demonstrate the experience; wiring it to real market data
and a broker is the next phase (see `obsidian-vault/Architecture`).

DSH Sentinel is research and automation tooling, **not investment advice**.
Trading involves risk of loss, including loss of principal. Backtested and
illustrative results do not guarantee future outcomes.
