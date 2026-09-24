# Strategy Lab + AI Advisor — India (NSE/BSE)

A web app to **backtest trading strategies** and generate **AI-assisted trade ideas**, focused on the Indian market. Educational / paper-trading only.

> ⚠️ **Disclaimer.** Educational and simulation tool only. **Not** investment advice; we are **not** SEBI-registered investment advisers. No strategy guarantees profit. Backtested/past performance does **not** guarantee future results.

See **[docs/strategy-catalog.md](docs/strategy-catalog.md)** for the researched strategy library.

---

## The honest premise

No strategy generates *guaranteed* profit. Professionals pursue a **positive expected edge + disciplined risk management**, validated **out-of-sample**. This app's value is doing that rigorously: realistic Indian costs, honest risk-adjusted metrics, and defenses against overfitting.

## Confirmed decisions & finalized stack (v1)

| Area | Choice |
|---|---|
| Market | **Indian equities & indices** (NSE/BSE, NIFTY/BANKNIFTY; F&O later) |
| Mode | **Educational / paper-trading only** (no real orders → out of SEBI RIA/algo scope) |
| Backend | **Python + FastAPI** |
| Backtest framework | **backtrader** (realistic cost modeling via custom `CommissionInfo`; SaaS-safe license) |
| Data (v1) | **yfinance `.NS`** free EOD to ship the engine → **Upstox / Angel One** (free) or **Zerodha Kite** (₹500/mo) for intraday + live |
| Candle storage | **DuckDB / Parquet** |
| NL → strategy | **Claude structured output → validated JSON DSL → trusted interpreter** (⚠️ never execute model-generated code) |
| Frontend | **React + TradingView Lightweight Charts** |
| Default strategy | **Vol-targeted 12–1 time-series momentum on NIFTY (long/flat)** |

## Features

1. **Strategy Lab (backtest)** — plain-English or rule-builder strategy → JSON DSL → backtest on NSE data → metrics (CAGR, Sharpe, Sortino, max drawdown, win rate, profit factor) + equity curve + trade log, with realistic Indian costs.
2. **AI Advisor** — budget + risk tolerance → engine tests the vetted library, ranks by *out-of-sample* risk-adjusted results, proposes allocations. Ships with one **default strategy**.
3. **Live Market** — real-time prices, candlestick charts, watchlists.
4. **Strategy Library** — curated strategies from the research catalog.

## Navigation

- **Top tabs:** Trading | Investing
- **Bottom bar:** Dashboard · Backtest · Strategies · Settings

## Anti-overfitting principles (baked into the engine)

Point-in-time data & `t→t+1` fills (no look-ahead) · survivorship-bias-free universes · realistic costs/slippage/impact · **purged & embargoed CV** + walk-forward · **Deflated Sharpe Ratio** & PBO to flag overfit · risk-adjusted metrics over raw returns. (Details in [docs/strategy-catalog.md](docs/strategy-catalog.md) §F.)

## Architecture (v1)

```
NL strategy ──▶ Claude (structured output) ──▶ JSON DSL ──▶ [validate: Pydantic + whitelist]
                                                                │
 yfinance(.NS) ─▶ data layer ─▶ DuckDB/Parquet ─┐               ▼
                                                └──▶ DSL interpreter ─▶ backtrader Strategy
                                                                                │
                              custom CommissionInfo (Indian costs) ─────────────┤
                                                                                ▼
                                              backtest run ─▶ metrics + equity curve + trade log
                                                                                │
                                          FastAPI  ◀───────────────────────────┘
                                             │
                                          React UI + Lightweight Charts
```

## Roadmap

- **Phase 0 — Research** ✅ (see strategy catalog).
- **Phase 1 — Backtesting engine** ✅ *(shipped as a lightweight in-house engine — no look-ahead, Indian round-trip costs, MA/RSI/Donchian templates, metrics + equity curve + trade log. Full backtrader pipeline with walk-forward + Deflated Sharpe is a later hardening step.)*
- **Phase 2 — API** ✅: FastAPI service on real NSE EOD data (`backend/`, see [backend/README.md](backend/README.md)). Run with `npm run backend`.
- **Phase 3 — Frontend** ✅ *(first cut)*: nav shell, live-market screens, and a **Backtest** screen wired to the real engine — plain-English "what I'm testing", a bar-by-bar "watch it trade" replay with buy/sell markers, trade log, metrics, and an automated review. Falls back to an in-browser demo engine when the backend is offline.
- **Phase 1.5 — NL→DSL** *(next)*: Claude structured output → validated DSL (the `POST /api/backtest` request shape is the validation boundary it must target).
- **Phase 4 — Strategy library UI** + more strategies.
- **Phase 5 — AI Advisor**: budget → ranked ideas.
- **Phase 6 — Live market dashboard** (broker API).
