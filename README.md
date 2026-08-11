# DSH-Trading-v2

Design concepts, UI mockups, and planning docs for the next version of the DSH
trading terminal. Everything here is a self-contained HTML file — open any of
them directly in a browser, no build step or dependencies required.

## Design concepts

Three progressively bolder reimaginings of the DSH front end. Each explores a
different interaction paradigm for the same underlying goal: research, trade,
report, and backtest.

| # | Concept | What it explores |
|---|---------|------------------|
| 01 | [Aurora](design-concepts/01-aurora.html) | A polished restyle of the classic terminal — dark "aurora" theme, cleaner dashboard, modern layout. |
| 02 | [Aurora v2](design-concepts/02-aurora-v2.html) | A more thorough rethink of the layout and information hierarchy. |
| 03 | [Conversational cockpit](design-concepts/03-conversational-cockpit.html) | The furthest departure: no dashboard or sidebar. A single "Ask DSH anything" command bar assembles live answers — analysis, stats, inline charts, and action buttons (Paper trade · Backtest · Watch) inside the reply. Perplexity/ChatGPT, but for trading. |

## Docs

| Doc | Contents |
|-----|----------|
| [Roadmap](docs/roadmap.html) | State of the terminal and the roadmap forward. |
| [Live trading blueprint](docs/live-trading-blueprint.html) | Architecture and key decisions for live trading. |

## Viewing

Clone the repo and open any `.html` file in your browser:

```bash
git clone https://github.com/dannyholden17-boop/dsh-trading-v2.git
cd dsh-trading-v2
open design-concepts/03-conversational-cockpit.html   # macOS
# or: xdg-open design-concepts/03-conversational-cockpit.html   # Linux
```
