"""Dhruva backtest engine — local FastAPI service.

Run:  py -m uvicorn app.main:app --port 8000 --reload   (from the backend/ folder)

Educational / paper-trading only. Not investment advice.
"""
from __future__ import annotations

import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from typing import Literal
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from functools import lru_cache
import time

from . import data, dhan, engine, oos, review, sweep, universe
from . import notifications, paper_trading, auth, whatsapp
from .scheduler import get_scheduler, start_scheduler, stop_scheduler
from .schemas import BacktestRequest, BacktestResponse, Bars, DhanCreds, Instrument, Quote, SearchResult, Metrics as MetricsSchema

@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_scheduler()
    yield
    await stop_scheduler()

app = FastAPI(title="Dhruva backtest engine", version="0.1.0", lifespan=lifespan)

# The Vite dev server proxies /api here, but allow direct localhost access too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "instruments": len(data.SYMBOL_MAP)}


@app.get("/api/instruments", response_model=list[Instrument])
def instruments() -> list[dict]:
    return [{"symbol": k, "ticker": v} for k, v in data.SYMBOL_MAP.items()]


@app.get("/api/search", response_model=list[SearchResult])
def search(q: str = "", limit: int = 200) -> list[dict]:
    """Groww-style instrument search over the bundled NSE universe."""
    limit = max(1, min(limit, 200))
    return universe.search(q, limit)


@lru_cache(maxsize=256)
def _cached_quote(symbol: str, time_bucket: int):
    return data.get_quote(symbol)


@app.get("/api/quote", response_model=Quote)
def quote(symbol: str) -> dict:
    """Real (Yahoo-delayed, ~15 min) quote for the Live tab with caching and safe handling."""
    try:
        # Cache results for 60 seconds to prevent concurrent request bursts from hammering the server
        time_bucket = int(time.time() // 60)
        return _cached_quote(symbol, time_bucket)
    except Exception as e:
        err_msg = str(e).lower()
        if "no data found" in err_msg or "delisted" in err_msg:
            raise HTTPException(status_code=404, detail=f"Symbol not found: {symbol}")
        raise HTTPException(status_code=502, detail=f"Quote failed for {symbol}: {e}")


@app.get("/api/bars", response_model=Bars)
def bars(symbol: str, interval: str = "15m") -> dict:
    """Real OHLC bars at a timeframe (15m/30m/60m/1d) for the Live chart."""
    try:
        return data.get_bars(symbol, interval)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Bars failed for {symbol}: {e}")


@app.post("/api/backtest", response_model=BacktestResponse)
def backtest(req: BacktestRequest) -> dict:
    try:
        ticker, candles, intraday = data.get_backtest_candles(req.symbol, req.interval, req.lookback)
    except Exception as e:  # network / ticker / parse issues
        raise HTTPException(status_code=502, detail=f"Data fetch failed for {req.symbol}: {e}")

    if len(candles) < 30:
        unit = "sessions" if req.interval == "1d" else "bars"
        raise HTTPException(status_code=422, detail=f"Only {len(candles)} {unit} available — need at least 30.")

    res = engine.run_backtest(candles, req)
    reviews = review.review_backtest(res["metrics"], req)

    return {
        "candles": candles,
        "equity": res["equity"],
        "trades": res["trades"],
        "metrics": res["metrics"],
        "reviews": reviews,
        "source": "yfinance",
        "symbol": req.symbol,
        "ticker": ticker,
        "interval": req.interval,
        "intraday": intraday,
        "start": candles[0]["time"],
        "end": candles[-1]["time"],
    }


@app.post("/api/backtest/oos")
def backtest_oos(req: BacktestRequest) -> dict:
    """Train/test split backtest — same config on 70/30 split, with stability verdict."""
    try:
        ticker, candles, intraday = data.get_backtest_candles(req.symbol, req.interval, req.lookback)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data fetch failed for {req.symbol}: {e}")

    if len(candles) < 60:
        raise HTTPException(status_code=422, detail=f"Need at least 60 bars for OOS split (got {len(candles)}).")

    try:
        res = oos.run_backtest_oos(candles, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "symbol": req.symbol,
        "ticker": ticker,
        "interval": req.interval,
        "intraday": intraday,
        "start": candles[0]["time"],
        "end": candles[-1]["time"],
        **res,
    }


@app.post("/api/backtest/sweep")
def backtest_sweep(req: BacktestRequest) -> dict:
    """Parameter sweep — grid over fast/slow ranges, return matrix of metrics."""
    try:
        ticker, candles, intraday = data.get_backtest_candles(req.symbol, req.interval, req.lookback)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data fetch failed for {req.symbol}: {e}")

    if len(candles) < 60:
        raise HTTPException(status_code=422, detail=f"Need at least 60 bars for sweep (got {len(candles)}).")

    try:
        res = sweep.sweep(candles, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "symbol": req.symbol,
        "ticker": ticker,
        "interval": req.interval,
        "intraday": intraday,
        **res,
    }


@app.post("/api/backtest/walkforward")
def backtest_walkforward(req: BacktestRequest, win_len: int = 100, step_len: int = 20) -> dict:
    """Walk-forward analysis — rolling train/test windows."""
    try:
        ticker, candles, intraday = data.get_backtest_candles(req.symbol, req.interval, req.lookback)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data fetch failed for {req.symbol}: {e}")

    try:
        res = sweep.walk_forward(candles, req, window=win_len, step=step_len)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "symbol": req.symbol,
        "ticker": ticker,
        "interval": req.interval,
        "intraday": intraday,
        **res,
    }


@app.post("/api/ai/review")
def ai_review(req: BacktestRequest) -> dict:
    """AI-powered strategy critique. Falls back to heuristic if no API key set."""
    api_key = os.environ.get("DHRUVA_AI_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")

    try:
        ticker, candles, intraday = data.get_backtest_candles(req.symbol, req.interval, req.lookback)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data fetch failed for {req.symbol}: {e}")

    res = engine.run_backtest(candles, req)
    heuristic_reviews = review.review_backtest(res["metrics"], req)

    if not api_key:
        return {
            "reviews": heuristic_reviews,
            "source": "heuristic",
            "message": "Set DHRUVA_AI_KEY env var to enable LLM critique.",
        }

    reviews = heuristic_reviews
    source = "heuristic"
    message = ""

    if "sk-" in api_key or api_key.startswith("sk-proj-"):
        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            m = res["metrics"]
            prompt = f"""You are a expert quant trader reviewing a backtest. Be honest, specific, and actionable.

STRATEGY: {req.template if req.mode == 'template' else 'Custom rules'} on {req.symbol} ({req.interval})
PARAMETERS: fast={req.fast}, slow={req.slow}, cost={req.costBps}bps
RESULTS: CAGR={m['cagr']:.1f}%, Sharpe={m['sharpe']:.2f}, MaxDD={m['maxDD']:.1f}%, WinRate={m['winRate']:.0f}%, Trades={m['trades']}, Exposure={m['exposure']:.0f}%

Provide 3-5 bullet points with specific improvement suggestions. Use these tones:
- GREEN for things done well
- YELLOW for cautions
- RED for problems
- BLUE for insights

Format each as: [TONE] title - body"""
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=500,
            )
            text = resp.choices[0].message.content
            reviews = _parse_ai_review(text, heuristic_reviews)
            source = "openai"
        except Exception as e:
            message = f"OpenAI call failed: {e}"
    elif "sk-ant-" in api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            m = res["metrics"]
            prompt = f"""You are a expert quant trader reviewing a backtest. Be honest, specific, and actionable.

STRATEGY: {req.template if req.mode == 'template' else 'Custom rules'} on {req.symbol} ({req.interval})
PARAMETERS: fast={req.fast}, slow={req.slow}, cost={req.costBps}bps
RESULTS: CAGR={m['cagr']:.1f}%, Sharpe={m['sharpe']:.2f}, MaxDD={m['maxDD']:.1f}%, WinRate={m['winRate']:.0f}%, Trades={m['trades']}, Exposure={m['exposure']:.0f}%

Provide 3-5 bullet points with specific improvement suggestions. Use these tones:
- GREEN for things done well
- YELLOW for cautions
- RED for problems
- BLUE for insights

Format each as: [TONE] title - body"""
            resp = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text if resp.content else ""
            reviews = _parse_ai_review(text, heuristic_reviews)
            source = "anthropic"
        except Exception as e:
            message = f"Anthropic call failed: {e}"

    return {
        "reviews": reviews,
        "source": source,
        "message": message,
        "metrics": res["metrics"],
    }


def _parse_ai_review(text: str, fallback: list[dict]) -> list[dict]:
    """Parse AI review text into Review format. Falls back to heuristic."""
    import re
    reviews = []
    tone_map = {"GREEN": "good", "YELLOW": "warn", "RED": "bad", "BLUE": "info"}
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        match = re.match(r"\[(GREEN|YELLOW|RED|BLUE)\]\s*(.+?)\s*[-:]\s*(.+)", line)
        if match:
            tone_key, title, body = match.groups()
            reviews.append({
                "tone": tone_map[tone_key],
                "title": title.strip(),
                "body": body.strip(),
            })
    return reviews[:5] or fallback


# ---- Dhan broker link (data-only for now; token stays server-side) ----

@app.get("/api/settings/dhan")
def dhan_status() -> dict:
    """Masked view — never returns the raw token to the browser."""
    return dhan.status()


@app.post("/api/settings/dhan")
def dhan_save(creds: DhanCreds) -> dict:
    dhan.save_creds(creds.clientId, creds.accessToken)
    return dhan.status()


@app.delete("/api/settings/dhan")
def dhan_delete() -> dict:
    dhan.clear_creds()
    return {"configured": False}


@app.post("/api/settings/dhan/test")
def dhan_test() -> dict:
    """Call Dhan's profile endpoint to confirm the token works and read the data plan."""
    try:
        prof = dhan.profile()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"ok": True, "profile": prof}


# ---- Notifications -----------------------------------------------------------

@app.get("/api/notifications/status")
def notif_status() -> dict:
    """Get notification configuration status."""
    return notifications.get_status()


@app.post("/api/notifications/config")
def notif_config(cfg: dict) -> dict:
    """Update notification configuration."""
    return notifications.update_config(cfg)


@app.get("/api/notifications/watchlist")
def notif_watchlist() -> list[str]:
    """Get current watchlist."""
    return notifications.get_watchlist()


@app.put("/api/notifications/watchlist")
def notif_update_watchlist(symbols: list[str]) -> dict:
    """Update watchlist."""
    return notifications.update_watchlist(symbols)


@app.get("/api/notifications/signals")
def notif_signals() -> list[dict]:
    """Check all signals and return results."""
    return notifications.check_signals()


@app.post("/api/notifications/test")
def notif_test() -> dict:
    """Send a test notification."""
    test_signal = {
        "symbol": "NIFTY 50",
        "signal": "bullish",
        "last": "",
        "changed": True,
    }
    return notifications.send_signal(test_signal)


# ---- Paper Trading -----------------------------------------------------------

class PaperOrder(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"] = "BUY"
    quantity: int = 1

@app.post("/api/paper/order")
def paper_order(req: PaperOrder) -> dict:
    """Place a paper order."""
    try:
        return paper_trading.place_order(req.symbol, req.side, req.quantity)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/paper/close/{symbol}")
def paper_close(symbol: str) -> dict:
    """Close an open position."""
    try:
        return paper_trading.close_position(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/paper/portfolio")
def paper_portfolio() -> dict:
    """Get current portfolio."""
    return paper_trading.get_portfolio()


@app.get("/api/paper/history")
def paper_history(limit: int = 50) -> list[dict]:
    """Get trade history."""
    return paper_trading.get_trade_history(limit)


@app.post("/api/paper/auto-trade")
def paper_auto_trade() -> dict:
    """Run auto-trade check based on current signals."""
    try:
        signals = notifications.check_signals()
        signal_map = {s["symbol"]: s["signal"] for s in signals if s.get("signal")}
        actions = paper_trading.auto_check_and_trade(list(signal_map.keys()), signal_map)
        return {"actions": actions, "signals": signal_map}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def require_user(request: Request) -> dict:
    """Get current user from Bearer token, raise 401 if invalid."""
    token = get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    user = auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


# ---- Auth --------------------------------------------------------------------

@app.post("/api/auth/register")
def auth_register(req: dict) -> dict:
    """Register a new user."""
    username = req.get("username", "").strip()
    phone = req.get("phone", "").strip()
    password = req.get("password", "")
    if not username or not phone or not password:
        raise HTTPException(status_code=400, detail="Username, phone, and password required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    result = auth.register(username, phone, password)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/auth/login")
def auth_login(req: dict) -> dict:
    """Login and return JWT token."""
    username = req.get("username", "").strip()
    password = req.get("password", "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    result = auth.login(username, password)
    if not result["ok"]:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@app.get("/api/auth/me")
def auth_me(request: Request) -> dict:
    """Get current user from Bearer token."""
    user = require_user(request)
    return {"id": user["id"], "username": user["username"], "phone": user["phone"]}


# ---- WhatsApp Notifications --------------------------------------------------

@app.get("/api/notifications/whatsapp/config")
def whatsapp_config(request: Request) -> dict:
    """Get WhatsApp config status (requires auth)."""
    user = require_user(request)
    return {"enabled": bool(os.environ.get("TWILIO_ACCOUNT_SID")), "user_phone": user["phone"]}


@app.post("/api/notifications/whatsapp/send")
def whatsapp_send(req: dict, request: Request) -> dict:
    """Send WhatsApp notification for a signal."""
    user = require_user(request)

    signal = req.get("signal", {})
    phone = req.get("phone", user["phone"])
    result = whatsapp.send_signal_notification(phone, signal)
    return result


@app.post("/api/notifications/whatsapp/test")
def whatsapp_test(request: Request) -> dict:
    """Send test WhatsApp message."""
    user = require_user(request)
    result = whatsapp.test_connection(user["phone"])
    return result