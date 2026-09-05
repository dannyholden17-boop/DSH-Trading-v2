---
title: Front-end performance
aliases:
  - Layout stability
  - CLS
tags:
  - dsh
  - flux
  - frontend
type: reference
status: fixed
---

# Front-end performance

The site read as "glitchy" — content visibly jumping shortly after each page
loaded. It was two causes, both measurable as Cumulative Layout Shift.

## 1. The ticker was inserted above the nav

`F.initTicker()` created a 30px price bar and inserted it as
`document.body.firstChild` once the universe had loaded — **above** the sticky
nav, on all 26 pages that load it. Every page therefore jumped down 30px the
moment its script ran.

> [!success] Fix
> The bar now lives in the markup as an empty
> `<div class="ticker" id="fluxTicker">`, so its height is reserved at parse
> time and `initTicker` only fills it. An empty slot on a page whose universe
> never loads is a thin rail-coloured strip, which is what the page looks like
> anyway.

## 2. The webfont swap reflowed the text

Three self-hosted families at `font-display: swap`. The fallback and the real
face had different metrics, so the swap moved copy down 26px and re-wrapped
paragraphs onto extra lines.

> [!success] Fix
> Metric-matched fallback faces in `fonts.css` — `ascent-override`,
> `descent-override` and `line-gap-override` from the real font's typo metrics
> (read with fontTools), plus a `size-adjust` measured in the browser as the
> **average advance-width ratio** against the fallback.
>
> | Family | size-adjust |
> |---|---|
> | Archivo | 98.62% |
> | Public Sans | 104.31% |
> | Azeret Mono | 107.96% |
>
> The usual shortcut for `size-adjust` is the x-height ratio. It was wrong here
> by four percent on Public Sans — enough on its own to re-wrap a paragraph.

## 3. A pane that grew as it filled

`options.html` rendered its chain table empty and filled it, growing the pane by
about seven rows and shoving the page down. `.op-scroll` now carries a
`min-height`.

## Results

| Page | Before | After |
|---|---|---|
| `options.html` | 0.384 **POOR** | 0.038 |
| `terminal.html` | 0.312 **POOR** | 0 |
| `terms.html` | 0.116 | ~0 |
| `index.html` | 0.059 | 0.002 |

> [!tip] Keeping it
> Anything inserted into the page after load must have its space reserved
> first — a container with a `min-height`, or the element itself sitting empty
> in the markup. The scratchpad script `pw/sweep.mjs` measures every page; run
> it before shipping layout changes.
