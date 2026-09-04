---
name: Flux — The Trading Floor
description: A deep slate trading floor lit from above, with gold card stock as the one paper artifact and motion that shows the desk working.
colors:
  blotter: "#0d1220"
  blotter-2: "#141b2d"
  blotter-3: "#1c243a"
  well: "#080c16"
  rail: "#070a12"
  card-buy: "#f0b93f"
  card-sell: "#f0654a"
  paper: "#f2eee4"
  ink: "#120d05"
  gold: "#f5b93c"
  gold-deep: "#c8912a"
  floor: "#7aa7ff"
  clearing: "#3ddc97"
  stamp: "#ff6f52"
  stamp-deep: "#c8402a"
  card-buy-lift: "#ffc95a"
  card-sell-lift: "#ff7f63"
  chrome: "#2b3550"
  chrome-hi: "#3b486b"
  gold-soft: "#ffd479"
  veil: "rgba(13,18,32,.72)"
  clearing-tint: "#6fe3b0"
  stamp-tint: "#ffab98"
  stamp-ok-paper: "#1c5233"
  stamp-cut-paper: "#5a3d02"
  stamp-no-paper: "#7a1d0e"
  stamp-ok-dark: "#6fe3b0"
  stamp-no-dark: "#ff8f78"
  text: "#f2f5fb"
  text-dim: "#a8b4cd"
  text-faint: "#8d9ab6"
  line: "rgba(160,180,220,.16)"
  line-2: "rgba(160,180,220,.09)"
  line-3: "rgba(160,180,220,.05)"
  # --- the front room (daylight). Same names, [data-surface="market"] values.
  # Kept under market-* keys so the two rooms can be told apart mechanically.
  market-blotter: "#f1f3f8"
  market-blotter-2: "#ffffff"
  market-blotter-3: "#f7f8fc"
  market-well: "#e6eaf2"
  market-rail: "#f8f9fc"
  market-veil: "rgba(248,249,252,.88)"
  market-paper: "#ffffff"
  market-ink: "#0b0d12"
  market-text: "#0b0d12"
  market-text-dim: "#4b5361"
  market-text-faint: "#5e6775"
  market-line: "rgba(11,13,18,.15)"
  market-line-2: "rgba(11,13,18,.085)"
  market-line-3: "rgba(11,13,18,.045)"
  market-gold: "#8a5a05"
  market-clearing: "#07734e"
  market-stamp: "#b32d10"
  market-floor: "#2748b8"
  market-chrome: "#bcc3d0"
  market-chrome-hi: "#9ea7b8"
  # the action pair. Ink pill in daylight, mint in the pit.
  act: "#0b0d12"
  act-ink: "#ffffff"
  act-pit: "#3ddc97"
  act-ink-pit: "#04150d"
  # white as a literal: the close band's type, and the daylight window wash
  on-ink: "#ffffff"
  on-ink-dim: "rgba(255,255,255,.72)"
  on-ink-faint: "rgba(255,255,255,.62)"
  on-ink-rule: "rgba(255,255,255,.14)"
  daylight-wash: "rgba(255,255,255,.92)"
typography:
  claim:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 1.15rem + 3.1vw, 3.4rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.032em"
  display:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3.6vw, 4.2rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.85rem, 1.3rem + 2.1vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.18rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Public Sans, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  lede:
    fontFamily: "Public Sans, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.02rem, 0.98rem + 0.35vw, 1.15rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.13em"
  data:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
    fontFeature: "tabular-nums"
  disclosure:
    fontFamily: "Public Sans, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.005em"
  caption:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.02em"
  bodySmall:
    fontFamily: "Public Sans, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  subtitle:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  sectionTitle:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  pageTitle:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  amount:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "2.7rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  figure:
    fontFamily: "Azeret Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  instrument:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.4rem, 1.6rem + 2.6vw, 3.6rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.045em"
  stationTitle:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.028em"
  # --- the front room runs a larger, airier scale than the pit. A marketing
  # surface has room to breathe; a workstation does not. Two steps only —
  # section heads reuse `headline`, so daylight adds a claim and a figure.
  marketDisplay:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.4rem, 1.1rem + 5.2vw, 5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.045em"
  marketFigure:
    fontFamily: "Archivo, Archivo Expanded, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.6rem, 1.1rem + 1.4vw, 2.3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
rounded:
  # the pit cuts its corners; daylight prints and rounds them. No pill:
  # the references used black pill CTAs, but the standing brief rules them
  # out, and a squared button sits closer to the ticket world anyway.
  cut: "2px"
  sm: "4px"
  lg: "6px"
  market-sm: "10px"
  market-lg: "22px"
spacing:
  hair: "9px"
  xs: "10px"
  sm: "14px"
  md: "18px"
  lg: "20px"
  xl: "34px"
  gutter: "clamp(20px, 5vw, 56px)"
  section: "clamp(56px, 7vw, 104px)"
components:
  floor-station:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "1px solid rgba(21,16,10,.2)"
    rounded: "{rounded.sm}"
    padding: "14px 15px 16px"
    shadow: "{shadows.lift-2}"
    note: "One desk in the live loop, as a carbon copy that collects its stamp. Rotated a fraction off square; the running stage squares up and lifts."
  floor-panel:
    backgroundColor: "{colors.blotter-2}"
    border: "1px solid {colors.line-2}"
    shadow: "{shadows.lift-1}"
    headerBackground: "{colors.blotter-3}"
    headerTypography: "{typography.label}"
    note: "A board panel on the floor: names, the desk's conclusion, or the wire."
  floor-rating:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
    border: "1px solid {colors.line}"
    variants: "buy uses {colors.clearing}, sell uses {colors.stamp}, unrated stays {colors.text-faint}"
    note: "The tape's own read on a name, quoted not computed."
  button-primary:
    backgroundColor: "{colors.card-buy}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "13px 24px"
  button-primary-hover:
    backgroundColor: "{colors.card-buy-lift}"
    textColor: "{colors.ink}"
  button-sell:
    backgroundColor: "{colors.card-sell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "13px 24px"
  button-sell-hover:
    backgroundColor: "{colors.card-sell-lift}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "13px 24px"
  button-ghost-hover:
    backgroundColor: "rgba(245,185,60,.08)"
    textColor: "{colors.gold}"
  card:
    backgroundColor: "{colors.blotter-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "20px 22px"
  ticket:
    backgroundColor: "{colors.card-buy}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut}"
    padding: "20px 20px 6px 34px"
  ticket-sell:
    backgroundColor: "{colors.card-sell}"
    textColor: "{colors.ink}"
  pill:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.text-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.cut}"
    padding: "5px 11px"
  badge:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut}"
    padding: "4px 8px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-deep}"
    rounded: "{rounded.cut}"
    padding: "7px 13px"
  input-search:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "15px 17px"
---

# Design System: Flux — The Blotter

## Overview

**Creative North Star: "The Blotter"**

A trade is a document that collects a stamp at every desk it passes through. The site is
built as that document, not as a dashboard about it. The ground is a warm graphite desk
pad; saturated card-stock fields are laid on it and own whole regions rather than acting
as accents; a chain of custody runs down the right edge of the primary artifact and fills
in, stamp by stamp. Everything else — grids, dockets, rosters, the news wire — is a ruled
form, not a deck of icon cards.

Density is high and comfortable at once. Reading surfaces breathe (68ch ledes, 70ch
disclosures, generous section rhythm); machine surfaces compress (9px gutters in the
workstation, 11px stencilled field keys, tabular figures everywhere a number is a fact).
The world is drawn with hairlines, punched holes, dashed clip rails and carbon rules
instead of glows, gradients or glass. It refuses the glowing-chart hero the category
ships: the aurora, orb, shader, sheen and gradient-text devices that preceded this world
are retired to explicit no-ops (`site/assets/flux.css:565-571`) rather than left alive.

**The desk has two rooms, and they are lit from the use scene, not from category habit.**

The *back room* is the pit: near-black, dense, mint on the bid, every pixel carrying a
number. It is where the work happens and where a member sits for hours, so it stays dark —
warm grounds, red channel above green above blue on every ground token, so the ochre and
vermillion card stock reads as paper on a desk rather than as a neon panel on black glass.
This is the default: `:root` is the pit, and `color-scheme:dark` is declared there
(`site/assets/flux.css:18`).

The *front room* is daylight: cool paper, ink, air, and one black action. It is where
somebody who has never heard of Flux decides whether to trust it — a two-minute read in an
office, not an eight-hour shift — and a dark marketing page reads as a costume rather than
as a workplace. Marketing surfaces declare `data-surface="market"` on `<html>`
(`flux.css` §20) and every token re-resolves.

Both rooms speak the same token names, so a room is one attribute and everything inside it
re-lights. That is what lets a full-bleed workstation band drop into a daylight page
without a second stylesheet: `<section data-surface="app">` inside a market page is the
pit, and it is how the product shows itself on the home page.

Which room a page belongs to is decided by what the visitor is doing, never by the page's
topic. Persuade → front room. Operate → back room. `download.html` is in the back room
because the page *is* a product shot; `brokerage.html` is in the front room because it is a
decision.

**Key Characteristics:**
- Warm graphite grounds, never blue-black
- Saturated card stock (ochre buy, vermillion sell) owning whole regions
- One motion idiom: the stamp landing
- Cut corners (2–4px), never pill-rounded surfaces
- Mono for machine facts, display for badges and tickers, sans for reading
- Offset-and-blur lift, never a halo

## Colors

A pit-floor palette: warm graphite desk, two saturated card stocks, and a three-state pit
signal system of gold, blue and green against a vermillion refusal.

### Primary
- **Jacket Gold** (`{colors.gold}`): the accent that carries the brand mark, active nav,
  focus rings, caret, selection, filing numbers, roster indices, day-sheet figures, and
  every hover tint (`rgba(232,179,60,.06)` on rows, `.10` on search results). It is the
  one color allowed to point.
- **Buy Ochre** (`{colors.card-buy}`): card stock, not an accent. It fills the whole order
  ticket and the primary button; text on it is always ink (9.7:1, `flux.css:191`).
- **Sell Vermillion** (`{colors.card-sell}`): the same role for a disposal — the sell
  ticket and the sell button.

### Secondary
- **Pit-Jacket Blue** (`{colors.floor}`): the routing color. It owns where a filing is
  going and what an engine emits — filing routes (`.fg-rt`) and roster outputs (`.rs-o`).
  It never becomes a general-purpose accent.
- **Clearing Green** (`{colors.clearing}`): bid, up, approved, live. Price rises, the live
  recording dot, the default status dot.
- **Stamp Vermillion** (`{colors.stamp}`): offer, down, rejected. Price falls and negative
  states. **Stamp Ink Deep** (`{colors.stamp-deep}`) is the resting ink of a stamp glyph.

### Tertiary
- **Carbon Copy Paper** (`{colors.paper}`): the light card stock — the copy of the filing,
  and the ticker's symbol color.
- **Pen Ink** (`{colors.ink}`): what a pen leaves on card stock. The only text color used
  on ochre, vermillion or gold fills.

### Neutral
- **Blotter** (`{colors.blotter}`) — the pad itself; page background.
- **Blotter 2 / Blotter 3** (`{colors.blotter-2}` / `{colors.blotter-3}`) — a document on
  the pad, and a document on a document. Cards, panels, toasts.
- **Well** (`{colors.well}`) — recessed: inputs, tracks, table group rows.
- **Rail** (`{colors.rail}`) — the clip rail: nav, tape, footer, chrome, scrollbar track.
- **Text / Dim / Faint** (`{colors.text}` 14.9:1, `{colors.text-dim}` 7.1:1,
  `{colors.text-faint}` 5.0:1). Faint is the floor and nothing goes below it
  (`flux.css:41-43`).
- **Line / Line 2 / Line 3** — hairlines at 14%, 7% and 4% of paper white. Structure is
  drawn with these, not with fills.

### The front room's palette

Same names, daylight values (`flux.css` §20, `[data-surface="market"]`). Every one is
measured against the ground it actually sits on, composited, not against a nominal white.

- **Paper** `#f1f3f8` — the ground, and it is *derived*, not picked. The pit's type colour
  is `#f2f5fb`; dim it a shade and it becomes the front room's paper. **One room's ink is
  the other room's paper.** That is why this ground is cool: a warm cream would belong to a
  different world than the slate pit, and warm off-white is the reflex surface every
  generated "tasteful" page reaches for. Panels are `#ffffff`, wells `#e6eaf2`, the nav
  rail `#f8f9fc`.
- **Ink** `#0b0d12` — text at 17.9:1, and **the action**. `--act` is ink and `--act-ink` is
  white, so a primary button is a black **squared** button, never a pill. This is the resolution of the brand-amber vs
  semantic-green collision: in daylight the amber stays *data* and never becomes a button.
- **Text dim** `#4b5361` (6.9:1) and **text faint** `#5e6775` (5.1:1 on paper, 4.6:1 in a
  well). Faint is the floor in this room too.
- **Label Amber** `#8a5a05` (5.3:1) is the only amber allowed to be *text*.
  `--gold-soft` `#f5b93c` is the same amber as a *field* and never carries type except ink.
- **Clearing** `#07734e` (5.3:1), **Stamp** `#b32d10` (5.7:1), **Floor** `#2748b8` (6.9:1).
- **Never a warm cream ground.** `#f4f2ed` was the first answer here and it was wrong for
  exactly the reason the detector names it: it is the safe warm off-white, reached for by
  reflex rather than derived from this product's own palette.
- Radii open up — `--radius:10px`, `--radius-lg:22px`, buttons are pills — because card
  stock is cut but a marketing surface is printed. Shadows lose the inset highlight and
  gain a real offset with a soft blur; there is no glow in daylight.

### Named Rules

**The Warm-Ground Rule.** Every ground has R > G > B. A ground that is blue-black is not
this world's ground; if a surface needs to recede, drop to `{colors.well}` or
`{colors.rail}`, never toward navy.

**The Card-Stock Rule.** Ochre and vermillion are fields, not accents. They fill a whole
document (ticket, primary action) or they are not used. Text on them is always
`{colors.ink}`; a card-stock surface never carries dim grey type.

**The Split-Ink Rule.** Stamp inks are chosen by the ground under them. On paper or ochre:
`{colors.stamp-ok-paper}` / `{colors.stamp-cut-paper}` / `{colors.stamp-no-paper}`. On the
dark ledger (`.dk-row`, `.dk-ledger`): `{colors.stamp-ok-dark}` / `{colors.gold}` /
`{colors.stamp-no-dark}`. Both sets clear WCAG AA against their own ground
(`flux.css:240-248`). Never take a paper ink onto the blotter or the reverse.

**The Routing-Blue Rule.** `{colors.floor}` means "where this goes / what this emitted."
It is not decoration and it is not a second accent; if a value is not a route or an
engine output, it is not blue.

## Typography

**Display Font:** Archivo (with Archivo Expanded, then system sans)
**Body Font:** Public Sans
**Label/Mono Font:** Azeret Mono

All three are self-hosted from `site/assets/fonts.css` — 26 `@font-face` rules over six
woff2 files (latin and latin-ext subsets, `font-display:swap`), so a production page makes
no third-party font request. The direction contract first named Martian Mono; Azeret Mono
was substituted at build time for the same squared, grid-drawn ledger character under a
licence that permits self-hosting, and the contract records the substitution.

**Character:** Archivo at 800–900 with tight negative tracking gives the badge-and-ticker
voice of a jacket acronym; Public Sans keeps long-form argument plainly readable at 16/1.6;
Azeret Mono, always tabular, is reserved for anything a machine produced — prices, ticket
numbers, timestamps, routes, field keys.

### Hierarchy
- **Display** (Archivo 900, `clamp(2.5rem,1.6rem + 3.6vw,4.2rem)`, line-height 1,
  −0.035em): the page claim; one per page. The ticket symbol (`.tkt-sym`) is the same
  register at `clamp(2.4rem,1.6rem + 2.6vw,3.6rem)`, line-height 0.92.
- **Headline** (Archivo 800, `clamp(1.85rem,1.3rem + 2.1vw,2.8rem)`, −0.03em): section
  heads.
- **Title** (Archivo 700, 1.18rem, −0.015em): card and filing heads. Filing titles run
  1.45rem; step and feature heads run 1.0–1.08rem.
- **Body** (Public Sans 400, 16px/1.6): all prose. Ledes cap at 68ch, ticket headlines at
  52ch, the footer disclaimer at 74ch.
- **Label** (Azeret Mono 600, 11px, +0.13em, uppercase): the stencilled field key
  (`.field-k`), footer column heads, docket and day-sheet headers (0.76–0.78rem at
  +0.14em/+0.15em).
- **Data** (Azeret Mono 600–700, tabular, −0.02em): every price, quantity, score, count
  and identifier. Day-sheet figures run 1.5rem in gold; ticket fields 0.98rem in ink.
- **Disclosure** (Public Sans 400, 12.5px/1.55, sentence case, max 70ch): long legal runs.

**The front room runs a larger scale.** A marketing surface has room to breathe and a
workstation does not, so daylight adds exactly two steps and reuses the rest:
*marketDisplay* `clamp(2.4rem, 1.1rem + 5.2vw, 5rem)` for the page claim, and
*marketFigure* `clamp(1.6rem, 1.1rem + 1.4vw, 2.3rem)` for the big read-off numbers in a
strip. Section heads use the same **Headline** step as the pit — there is no separate
daylight section head, and adding one would be drift, not design.

### Named Rules

**The Machine-Hand Rule.** Azeret Mono means a machine produced this value. If a human
wrote it, it is Public Sans; if it is a jacket acronym or a headline, it is Archivo. A
number that can change without an edit is always mono and always tabular.

**The No-Kicker Rule.** There are no eyebrows, kickers or hats above headings. `.eyebrow`
is hard-disabled (`display:none!important`, `flux.css:150`) so unconverted markup cannot
reintroduce one. Headings carry their own weight; the label register belongs to field
keys and column heads, not to decoration above a title.

**The Disclosure Rule.** Legal and risk copy is the one place caps and 11px are wrong. Use
`.disclosure`: sentence case, 12.5px, ≤70ch, `{colors.text-dim}` (`flux.css:684-691`).
Caps, +0.1em tracking and 11px are reserved for short labels that are scanned, never for
runs that are read.

**The Flat-Emphasis Rule.** Emphasis is weight and size. Gradient text is retired to a
no-op (`.grad-text`, `.grad-anim`, `flux.css:152-153`); no text carries a gradient, a
glow or a text-shadow.

## Layout

A single centred measure of 1180px (`--maxw`) with a fluid gutter of
`clamp(20px,5vw,56px)`, collapsing to a flat 16px below 640px. Sections breathe at
`clamp(56px,7vw,104px)` (a compact `.section-sm` at `clamp(36px,5vw,64px)`).

Marketing pages compose from a small set of grids: `.grid` at a 14px gap with 2/3/4-column
variants that fold to two columns at 980px and to one at 640px, and `.split` at a 44px gap
(optionally 1.15fr/0.85fr) folding at 900px. The hero is asymmetric by contract —
1.85fr ticket beside 1fr carbon copy, folding at 1000px (`site/index.html`, `.hd-grid`).
The ticket itself is a named-area grid (`"head head" / "main chain" / "foot chain"`, chain
column 168px) that restacks the chain of custody below the body at 620px.

The workstation shells are a different density on the same tokens: `.tm-app` is a
262px / fluid / 322px three-column desk at a 9px gap, dropping the left rail under the
centre at 1080px and stacking fully at 760px, inside a 1760px cap. Desktop viewports above
1100px apply `zoom:.84` to fit the whole desk, and the chart cancels it with an exact
inverse (`zoom:1.190476`) so pointer coordinates stay true
(`site/terminal.html`, `.tm-wrap`).

Spacing rhythm is coarse and repeated rather than a strict scale: 9–10px inside dense
chrome, 14px between grid cells, 18–22px inside cards, 20px of horizontal card padding
(34px on a ticket's punched left edge), 34px between docket columns.

Touch: nothing interactive drops below 24px (`flux.css:681`), `.btn-sm` grows to 12×18px
padding and open nav links to 16px on `hover:none` pointers, and form fields are forced to
16px below 640px to defeat iOS zoom.

### Named Rules

**The Extend-Never-Redefine Rule.** Page-scoped CSS extends the tokens; it never redefines
them. Where a shell needs local names (`--tm-bg`, `--tm-card`), they are aliases pointing
at the same palette values, scoped to the shell's own wrapper — not a second palette.

## Elevation & Depth

Depth is a card lying on a desk: a hard offset edge plus a tight directional blur, never a
halo and never a colored glow. Three lifts are defined and everything uses one of them.
Surfaces are additionally separated tonally (blotter → blotter-2 → blotter-3, with well and
rail cut below the pad) and by hairline, so a flat card without a shadow still reads.

### Shadow Vocabulary
- **Lift 1** (`box-shadow: 0 1px 0 rgba(0,0,0,.5), 0 2px 6px -2px rgba(0,0,0,.7)`): resting
  documents — day sheet, dockets, roster, primary button, store chips.
- **Lift 2** (`box-shadow: 0 2px 0 rgba(0,0,0,.5), 0 14px 28px -16px rgba(0,0,0,.95)`): the
  standard card at rest (`.glass`), the carbon copy, the close block, a lifted docket.
- **Lift 3** (`box-shadow: 0 4px 0 rgba(0,0,0,.5), 0 20px 38px -22px rgba(0,0,0,1)`): the
  ticket, modals, toasts, the device frame — the top of the stack.

One more depth device: the cut top edge. `.glass::after` draws a 1px horizontal gradient
highlight at 12% white across the middle 76% of the card's top edge — the desk lamp
catching a cut edge (`flux.css:170-171`).

### Named Rules

**The Offset-Not-Halo Rule.** Every shadow has a hard 1–4px offset row of pure black plus a
negatively-spread blur. No shadow is centred, none is tinted with an accent, and no element
gets a glow. Hover raises the lift one step and translates the card 2–3px; it never adds
color spread.

## Shapes

Card stock is cut, not rounded. Two radii carry the whole system: 2px (`{rounded.cut}`) for
anything that is a piece of paper or a stamped mark — tickets, badges, pills, tags, stamps,
the carbon copy, small avatars — and 4px (`{rounded.sm}`) for interface chrome that is not
paper: buttons, cards, inputs, toasts, the device frame. A 6px step exists
(`{rounded.lg}`) but is rarely reached for.

Structure is drawn, not filled. Hairline rules at three weights separate everything; the
chain of custody is divided by a 2px dashed rule in ink; an unstamped box is a dashed
outline over a 16%-black recess; the day sheet uses dotted leader rules between label and
figure; `.punched` adds a 9px filing hole inset at the top-left of any card, inset-shadowed
so it reads as punched through to the blotter. The ticket sits off-square at −0.5deg and
stamps land at −3deg; nothing else is rotated.

Icons are drawn as CSS masks at one stroke weight (1.75 on a 24-box) and inherit
`currentColor` — twelve of them in `flux.css:646-657`, plus the three-bar candlestick brand
glyph. There are no icon fonts and no emoji glyphs in the system layer.

## Components

### Buttons
- **Shape:** cut corners (4px), 1px transparent border, display face at 700/14.5px.
- **Primary — the buy ticket:** ochre card stock with ink text, 13px × 24px padding,
  Lift 1 at rest rising to Lift 2 and `#ecc069` on hover.
- **Sell:** identical geometry on vermillion card stock; used only when the action is a
  disposal.
- **Ghost — an unfiled form:** transparent, ruled with `{colors.line}`, text in
  `{colors.text}`; on hover the rule and the text go gold over a 6% gold wash.
- **Press:** every button translates down 1px on `:active` (100ms). Focus is the global
  2px gold outline at 2px offset.
- **Sizes:** `.btn-lg` 16px × 30px padding, `.btn-sm` 9px × 16px (12×18 on touch). Full
  width inside a `.btn-row` on mobile. Disabled drops to 42% opacity and loses its lift.
- **On card stock:** a button sitting on a ticket inverts — ink fill, card-stock text
  (`.tkt-foot .btn`, `flux.css:310-311`).

### Chips
- **Pill:** rail ground, hairline border, 2px corners, mono label at 11px/+0.1em uppercase
  in dim text, with an optional 6px status dot that defaults to clearing green. Variants
  recolor both text and border to blue (`.pill-violet`) or gold (`.pill-cyan`).
- **Badge:** the jacket acronym — 2–4 letters, Archivo 900 at 12px/+0.06em, gold fill, ink
  text, 2px corners.
- **Tag:** the quietest form — 10.5px mono on rail with a 7% hairline.

### Cards / Containers
- **Corner style:** 4px (2px when the card is paper).
- **Background:** `{colors.blotter-2}`, headers and footers dropped to `{colors.rail}`.
- **Border:** 1px `{colors.line}` (or the lighter `{colors.line-2}` on ruled dockets).
- **Shadow:** Lift 2 at rest for `.glass`; Lift 1 for ruled documents. `.glass-hover`
  raises to Lift 3, translates −2px and warms the border to 36% gold over 180ms.
- **Padding:** 20–22px; 16–17px in the carbon copy; 12px in workstation cards.

### Inputs / Fields
- **Style:** recessed `{colors.well}` ground, no side borders, a single hairline bottom
  rule, 15px × 17px padding, body face at 1.02rem.
- **Focus:** the global 2px gold outline; caret is gold everywhere.
- **Selection:** gold ground with ink text, no text-shadow.

### Navigation
The clip rail: a sticky 62px bar on `{colors.rail}` with a 7% bottom hairline, gaining a
shadow only once scrolled. Brand is Archivo 900 at 1.12rem beside a 26px gold masked
candlestick glyph. Links are 0.9rem/500 in dim text, rising to full text on hover; the
current page goes gold and grows a 2px gold underline flush to the bar's bottom edge.
Below 1040px the links and CTA collapse behind a 38px ruled toggle and open as a full-width
rail-colored sheet with 14px rows divided by 4% hairlines.

### The Ticket (signature)
The order ticket is the system's protagonist: a full-bleed sheet of ochre card stock
(vermillion when `.is-sell`) at Lift 3, rotated −0.5deg, punched at the top-left, laid out
as head / main+chain / foot. The head carries the org line in Archivo 900 at +0.08em and a
right-aligned mono ticket number; the main carries a field key, an oversized symbol, a
six-column rule-divided field strip in tabular mono, and a ≤52ch headline; the foot carries
the simulation line and an inverted signing button at bottom-right. Down the right edge, a
168px column divided by a 2px dashed ink rule holds the chain of custody — one
`.tkt-stage` per desk, each a mono field key over a stamp. Below 620px the chain unstacks
into a horizontal wrapping row under the body.

### The Stamp (signature)
The mark every state change makes. Archivo 900 at 13px/+0.1em uppercase inside a 2px
`currentColor` box with 2px corners, rotated −3deg at 92% opacity, inked by the split-ink
rule. An unfilled stage is `.stamp-pending`: dashed, unrotated, 50% opacity — and on card
stock it is drawn in translucent ink rather than blotter grey so it stays a pencil box, not
a grey ghost. `.stamp-box` is the dashed recess it lands in.

### Ruled Documents (signature)
Three shared document treatments replace what would otherwise be icon-card decks:
- **The day sheet** (`.daysheet`): a rail-colored uppercase mono header, then a two-column
  ruled list where each line is a label, a dotted leader, and a 1.5rem gold tabular figure.
  Values are operational facts only — never performance results.
- **The dockets** (`.filing`): a three-up grid of filing cards, each with a mono header
  carrying a gold filing number and a blue route, a 1.45rem title, body copy, and a gold
  mono footer that warms to a 6% gold wash on hover.
- **The roster** (`.roster`): six engines as a manifest — a mono index in gold, a name and
  description, a mono capability, and a right-aligned blue output, on ruled lines that
  collapse to two columns below 820px.

### The Tape
A 30px rail-colored ticker under the nav, edge-masked to transparent in the outer 4%, with
mono 12px items separated by 4% hairlines: paper-colored symbol, dim price, colored change.
It scrolls at 78s linear, pauses on hover, and stops entirely under reduced motion.

### Disclosures
`<details>` rows are borderless except for a bottom hairline; the summary is Archivo 700
with a gold masked plus-mark that rotates 45deg into a minus on open. Body copy is 0.93rem
dim at ≤70ch.

### Named Rules

**The One-Idiom Rule.** The site has exactly one authored motion: the stamp landing
(`@keyframes stampDown`, 420ms, `cubic-bezier(.16,1,.3,1)` — in from −14deg at 2.1× scale,
overshooting to −2deg at 0.94×, resting at −3deg). Everything else that moves is
information moving, not decoration: the tape and marquee scrolls, the recording blink, the
up/down price flash, and toast entry/exit. A new animation must either be one of those or
be the stamp.

**The detector's `cramped-padding` rule is disabled for this project, deliberately.** It
fires on every wrapper built to the One-Container Rule below, because that wrapper carries
the border and background with zero padding on purpose. Measured on the home page, the
nearest text to a container edge is 26.9px in the fact strip, 27px in the chain, 97px in
the opening, and 12px in the densest board row, which is inside the rule's own 12 to 16px
target. It was reporting the architecture, not a defect. Re-enable it with
`hook-admin.mjs reset` if the cell padding is ever removed.

**The One-Container Rule.** Where several facts belong together, they share **one** ruled
container divided by internal hairlines — never N separate cards. The wrapper carries the
border, the background and the radius and has zero padding; the *cells* carry the padding,
and the divisions are **real 1px borders on the cells**, never a `gap:1px` over a
line-coloured parent. The gap trick looks identical and reads to any structural check — and
to a person squinting — as N boxes on a tinted sheet, which is the thing being avoided.
The fact strip, the three-desk roll, the chain stations, the scoreboard and the connector
steps are all this one shape. This is how the references avoid a deck of cards, and it is
the rule that replaced the card grid.

Its cells must be padded, not the wrapper — measured, the tightest inset from any of these
containers' border box to its nearest text is 26px. The design detector reads the
*wrapper's* `padding:0` and reports `cramped-padding` on every one of them; that is a false
positive against this pattern and is not a licence to add padding to the wrapper, which
would double-inset every cell. The rule stays enabled project-wide because a genuinely
cramped container elsewhere should still be caught — verify by measuring the gap to the
nearest text, not by reading the wrapper's own padding.

**The Reduced-Motion Rule.** Under `prefers-reduced-motion`, the stamp still lands — it just
lands instantly. Animations collapse to 0.01ms, transitions to 60ms, reveals are forced to
their resting state, and the tape and marquee stop. State changes stay legible; only the
theatre is removed (`flux.css:87-93`).

## Do's and Don'ts

### Do:
- **Do** build on `site/assets/flux.css`. Page CSS extends the tokens and adds layout only;
  it never redefines a token value.
- **Do** keep grounds warm (R > G > B) and recede toward `{colors.well}` / `{colors.rail}`,
  never toward navy.
- **Do** fill whole regions with card stock and set every word on it in `{colors.ink}`.
- **Do** pick stamp ink by ground: the paper set on ochre and carbon, the dark set inside
  `.dk-row` / `.dk-ledger`.
- **Do** set anything machine-produced in Azeret Mono with `font-variant-numeric:tabular-nums`.
- **Do** use `.disclosure` for every long legal run: sentence case, 12.5px, ≤70ch.
- **Do** reserve `{colors.floor}` for routes and engine outputs.
- **Do** use Lift 1/2/3 as written and raise exactly one step on hover.
- **Do** cut corners at 2px for paper and 4px for chrome.
- **Do** draw new icons as `.ic-i` masks at 1.75 stroke on a 24-box, inheriting currentColor.
- **Do** keep every interactive target at or above 24px and form fields at 16px on mobile.

### Don't:
- **Don't** invent a third room, and don't mix them inside one purpose. A page belongs to
  the pit or to daylight; the only nesting allowed is a `data-surface="app"` band inside a
  market page, and that band is a product shot, never a decorative dark stripe.
- **Don't** put a light surface behind work. An Operate page — desk, terminal, portfolio,
  analysts, traders, executive — stays in the pit. It is looked at for hours.
- **Don't** ship an emoji or a bare Unicode glyph where an icon belongs. The set lives in
  flux.css as `.ic-i .i-*`: 25 marks, one stroke weight, drawn once. Inside JavaScript,
  build the markup with **single-quoted attributes** so it survives a double-quoted string,
  or better, leave the icon out of a toast entirely and let the words carry it.
- **Don't** use an em dash in anything a visitor reads. A comma, colon or semicolon says
  the same thing without the cadence tell. Code comments are exempt; they are not content.
- **Don't** round a button into a pill. The action is a squared black block.
- **Don't** write a kicker, eyebrow or label hat above a heading. `.eyebrow` is disabled
  outright and must stay disabled. When a sequence genuinely matters, fold it into the
  heading — "First, three analysts" — rather than stacking "Stage 1" above "Three analysts".
  A live state indicator (a stamp, a status chip) is not a kicker, but it belongs *after*
  the heading in DOM order so it neither reads nor announces as one.
- **Don't** use gradient text, glows, auroras, orbs, shaders, sheens or float/tilt
  decoration. They are retired to no-ops on purpose; do not revive them and do not write
  new equivalents.
- **Don't** give a shadow a color, a centred spread or a halo.
- **Don't** set caps or 11px type on anything longer than a short label.
- **Don't** put dim grey type on ochre, vermillion, gold or paper — ink only.
- **Don't** round a surface into a pill *in the pit*. Card stock is cut. In daylight the
  radii open up and buttons are pills — that is the front room's own rule, set on the
  surface, not a licence to soften the workstation.
- **Don't** use emoji or an icon font where a drawn mask icon belongs.
- **Don't** reach for `{colors.gold}` as a general highlight on a surface that already has
  a card-stock field; one voice points per region.
- **Don't** introduce a new keyframe animation for decoration.
- **Don't** write new markup against the legacy aliases (`--cyan`, `--violet`, `--emerald`,
  `--crimson`, `--amber`, `--grad`, `--glow`, `--glass`, `--glass-2`, `--surface-2`). They
  are a compatibility shim mapping old names onto the new palette
  (`flux.css:65-78`) so unconverted markup still renders correctly; they are not the
  vocabulary. New work uses `{colors.gold}`, `{colors.floor}`, `{colors.clearing}`,
  `{colors.stamp}`, `{colors.blotter-2}` and friends, and any page touched should migrate
  its remaining alias uses as it goes.
- **Don't** treat `site/app-classic.html` as a reference. It is an unlinked legacy page
  still on the old light theme and is outside this system.
