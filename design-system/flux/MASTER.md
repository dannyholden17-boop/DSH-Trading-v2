# Design System Master File

> **AUTHORITY.** `DESIGN.md` at the repository root is the record for this project.
> It is derived from the shipped artifact, not from a generator, and the design
> hook checks every commit against it. Where this file and `DESIGN.md` disagree,
> `DESIGN.md` wins.
>
> What this file is for: the UX rules, the motion tier, the anti-pattern list and
> the pre-delivery checklist from ui-ux-pro-max. The palette and type tables below
> have been rewritten to the values Flux actually ships so the two never fight.
>
> **LOGIC:** When building a specific page, first check `design-system/flux/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.

---
**Project:** Flux
**Generated:** 2026-09-03 00:36:20
**Category:** Financial Dashboard
**Design Dials:** Variance 6/10 (Balanced / Modern) | Motion 8/10 (Complex) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Floor (page ground) | `#0d1220` | `--blotter` |
| Surface | `#141b2d` | `--blotter-2` |
| Surface raised | `#1c243a` | `--blotter-3` |
| Well (inputs, tracks) | `#080c16` | `--well` |
| Rail (nav, tape) | `#070a12` | `--rail` |
| Accent / CTA | `#f5b93c` | `--gold` |
| On accent | `#120d05` | `--ink` |
| Buy ticket (card stock) | `#f0b93f` | `--card-buy` |
| Sell ticket (card stock) | `#f0654a` | `--card-sell` |
| Carbon copy (paper) | `#f2eee4` | `--paper` |
| Positive / approved | `#3ddc97` | `--clearing` |
| Negative / rejected | `#ff6f52` | `--stamp` |
| Routing / secondary | `#7aa7ff` | `--floor` |
| Foreground | `#f2f5fb` | `--text` |
| Muted foreground | `#a8b4cd` | `--text-dim` |
| Faint foreground | `#8d9ab6` | `--text-faint` |
| Border | `rgba(160,180,220,.16)` | `--line` |

**Color Notes:** Deep slate floor lit from above; gold is the single pointing accent, and card stock (gold / vermillion) is reserved for the order ticket. Green and vermillion are semantic (approved / rejected), never decorative.

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** dark, cinematic, technical, precision, clean, premium, developer, professional, high-end utility
- **Google Fonts:** [Inter + Inter](https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0F172A;
  border: 2px solid #0F172A;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #020617;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0F172A;
  outline: none;
  box-shadow: 0 0 0 3px #0F172A20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dark Mode (OLED)

**Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient

**Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light

**Key Effects:** Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Page Pattern

**Pattern Name:** Enterprise Gateway

- **Conversion Strategy:** Path selection (I am a...). Mega menu navigation. Trust signals prominent. Provide pause/stop for video and rotating logos; stop on focus and reduced motion. Logo carousel controls must be keyboard operable; pause moving media offscreen/hidden and render a static final state under reduced motion.
- **CTA Placement:** Contact Sales (Primary) + Login (Secondary)
- **Section Order:** Hero (Video/Mission) > Solutions by Industry > Solutions by Role > Client Logos > Contact Sales

---

## Motion

> Implemented in vanilla CSS + IntersectionObserver, not GSAP: the site has no
> build step. One curve `--ease` (cubic-bezier(.22,1,.36,1)) and four speeds —
> `--t-tap` 120ms, `--t-hover` 200ms, `--t-enter` 480ms, `--t-stage` 700ms.


**Page Transition** (Complex) — Trigger: route change | Duration: 500-800ms | Easing: `expo.inOut`

```js
const state = Flip.getState('.hero-image'); navigate(); Flip.from(state, { duration: 0.6, ease: 'expo.inOut', absolute: true, zIndex: 100 });
```

**Framework notes:** Requires the GSAP Flip plugin; the 'from' and 'to' route must render the same element with a shared data-flip-id; Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Verify the shared element exists in both DOM states before calling Flip.from to avoid a silent no-op
- ❌ Don't use shared-element transitions across more than one element pair per navigation; compounding Flips are hard to time correctly
- ⚡ Flip recalculates layout (FLIP technique) so test on low-end devices for jank

---

## Anti-Patterns (Do NOT Use)

- ❌ Light mode default
- ❌ Slow rendering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
