# Dhruva backtest engine (local)

A small **FastAPI** service that runs strategy backtests on **real NSE end-of-day data** (via `yfinance`) and returns candles, an equity curve, a trade log, metrics, and an automated review. This is the Phase-2 engine: a lightweight, dependency-light port of the in-browser TypeScript engine — identical math, but running server-side on real market history.

> ⚠️ Educational / paper-trading only. Not investment advice. No strategy guarantees profit.

## Why it's built this way

- **No model-generated code is ever executed.** Requests are validated by Pydantic against a whitelist (`app/schemas.py`) before anything runs. When natural-language → strategy parsing lands, it must emit *this* validated request shape — never raw code.
- **No look-ahead.** Yesterday's position earns today's return; costs are charged in bps on every position change. Same logic as the frontend (`src/lib/backtest.ts`), so live and demo results are directly comparable.
- **Realistic Indian costs** are modelled as round-trip basis points (brokerage + STT + slippage), tunable per backtest.

## Setup (Windows, one time)

From the `backend/` folder:

```bash
py -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

(macOS/Linux: use `python3 -m venv .venv` and `.venv/bin/python`.)

## Run

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000 --reload
```

Or, from the repo root: `npm run backend`.

The Vite dev server proxies `/api` → `http://localhost:8000`, so once this is running the Backtest page automatically switches from **demo data** to a green **Live NSE end-of-day** badge. If the engine is down, the app falls back to the in-browser demo engine — nothing breaks.

## Smoke test

```bash
.venv/Scripts/python.exe smoke_test.py
```

Runs the engine offline on a synthetic ramp (must produce exactly one round trip), then fetches live NIFTY 50 and prints its metrics.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + instrument count |
| `GET` | `/api/instruments` | Supported symbol → ticker map |
| `POST` | `/api/backtest` | Run a backtest, returns full result |

### `POST /api/backtest`

Request (validated — out-of-range values are rejected):

```json
{ "template": "ma", "symbol": "NIFTY 50", "fast": 20, "slow": 50, "costBps": 20, "lookback": 250 }
```

- `template`: `"ma"` (MA cross) · `"rsi"` (RSI mean-reversion) · `"breakout"` (Donchian)
- `symbol`: one of the supported instruments (see `/api/instruments`)
- `fast` / `slow`: 2–400 / 3–400 — lookback lengths (RSI uses `fast`, breakout uses `slow`)
- `costBps`: 0–200 round-trip cost
- `lookback`: 30–2500 trading days

Returns `{ candles, equity, trades, metrics, reviews, source, symbol, ticker, start, end }`.

Errors: `502` if the data fetch fails (network/ticker), `422` if fewer than 30 sessions are available.

## Supported instruments

The **search** (`GET /api/search?q=...`) covers a bundled universe of ~200 liquid NSE names + indices (`app/universe.py`). Any symbol resolves to a Yahoo ticker via `data.ticker_for()` — indices map explicitly, equities get the `.NS` suffix. You can also backtest a **raw ticker** not in the list (e.g. `WIPRO.NS`); it just won't appear in search. Extend the searchable list in `app/universe.py` and any special-cased index tickers in `app/data.SYMBOL_MAP` / `universe.INDEX_TICKERS`.

Note: a few Yahoo tickers lag corporate actions (e.g. `TATAMOTORS.NS` returned no data after the 2025 demerger). The frontend falls back to demo data for any symbol the live feed can't serve, so the page never breaks.

## Data & caching

`yfinance` downloads ~8 years of daily bars per ticker into `backend/.cache/*.csv`, refreshed once per calendar day. First fetch of a new symbol makes a network call; subsequent same-day calls are instant. The cache is safe to delete.

## Layout

```
backend/
  app/
    main.py       FastAPI app + routes + CORS
    schemas.py    Pydantic request/response models (the security boundary)
    engine.py     backtest math — mirrors src/lib/backtest.ts exactly
    review.py     automated-review heuristics
    data.py       yfinance fetch, symbol map, daily CSV cache
  smoke_test.py   offline + live sanity check
  requirements.txt
```
