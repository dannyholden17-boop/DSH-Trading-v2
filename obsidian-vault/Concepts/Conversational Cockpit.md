---
title: Conversational Cockpit
aliases:
  - Cockpit
tags:
  - dsh
  - concept
  - design
type: concept
status: mockup
mockup: design-concepts/03-conversational-cockpit.html
boldness: 3
---

# Conversational Cockpit

The furthest departure from the old site. **No dashboard, no sidebar, no grid** —
just a single "Ask DSH anything" command bar. You ask a question and DSH
*assembles* a live answer: a written take, real stats, an inline chart, and
action buttons (Paper trade · Backtest · Watch) right inside the reply.

> [!abstract] The pitch
> Perplexity / ChatGPT, but for trading. The same jobs — research, trade,
> report, backtest — reached by **conversation** instead of navigation.

This is the natural front door for [[DSH Sentinel]]: the bot is already
researching in the background, and the cockpit is where you interrogate it and
act on what it found.

- **Paradigm:** conversational, answer-assembly
- **Risk:** high (but highest ceiling)
- **Mockup:** `design-concepts/03-conversational-cockpit.html`

## Why it pairs with Sentinel

- Sentinel produces [[DSH Sentinel#Findings|findings]] on its own.
- The cockpit lets you ask follow-ups against those findings in natural language.
- Every answer ends in an **action**, not just text.

## Related

- [[Aurora]] · [[Aurora v2]]
- [[DSH Sentinel]] · back to [[DSH]]
