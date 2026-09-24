"""Paper trading engine — simulates real broker orders using Dhan API structure.

This module handles:
- Placing paper orders (long/short)
- Tracking open positions
- Auto-exiting based on signal changes or time rules
- P&L calculation
- Order history

Paper trades are stored locally and can be synced to Dhan when a real broker
connection is configured.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from typing import Optional

TRADES_FILE = os.path.join(os.path.dirname(__file__), "..", ".paper_trades.json")
POSITIONS_FILE = os.path.join(os.path.dirname(__file__), "..", ".paper_positions.json")


def load_trades() -> list[dict]:
    try:
        with open(TRADES_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def save_trades(trades: list[dict]) -> None:
    with open(TRADES_FILE, "w", encoding="utf-8") as f:
        json.dump(trades, f, indent=2)


def load_positions() -> dict[str, dict]:
    try:
        with open(POSITIONS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_positions(positions: dict[str, dict]) -> None:
    with open(POSITIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(positions, f, indent=2)


def place_order(symbol: str, side: str, quantity: int = 1, order_type: str = "MARKET") -> dict:
    """Place a paper order. Returns order confirmation."""
    positions = load_positions()
    trades = load_trades()

    # Get current price from Yahoo
    try:
        import yfinance as yf
        ticker = symbol.replace(" ", "") + ".NS" if not symbol.startswith("^") else symbol
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1d")
        if hist.empty:
            return {"ok": False, "error": "No data for symbol"}
        price = hist["Close"].iloc[-1]
    except Exception as e:
        return {"ok": False, "error": str(e)}

    order_id = f"PAPER-{int(time.time())}"
    timestamp = datetime.now().isoformat()

    order = {
        "order_id": order_id,
        "symbol": symbol,
        "side": side,  # "BUY" or "SELL"
        "quantity": quantity,
        "price": float(price),
        "type": order_type,
        "status": "FILLED",
        "timestamp": timestamp,
    }

    # Update position
    if side == "BUY":
        if symbol in positions:
            pos = positions[symbol]
            # Average up
            total_qty = pos["quantity"] + quantity
            avg_price = (pos["avg_price"] * pos["quantity"] + price * quantity) / total_qty
            pos["quantity"] = total_qty
            pos["avg_price"] = round(avg_price, 2)
            pos["unrealized_pnl"] = round((price - avg_price) * total_qty, 2)
        else:
            positions[symbol] = {
                "symbol": symbol,
                "quantity": quantity,
                "avg_price": round(price, 2),
                "unrealized_pnl": 0.0,
                "entry_time": timestamp,
            }
    elif side == "SELL":
        if symbol in positions:
            pos = positions[symbol]
            realized_pnl = (price - pos["avg_price"]) * min(quantity, pos["quantity"])
            pos["quantity"] -= quantity
            pos["unrealized_pnl"] = round((price - pos["avg_price"]) * pos["quantity"], 2) if pos["quantity"] > 0 else 0.0
            pos["last_exit_price"] = round(price, 2)
            pos["last_exit_time"] = timestamp
            pos["realized_pnl"] = pos.get("realized_pnl", 0.0) + realized_pnl

            if pos["quantity"] <= 0:
                trades.append({
                    "symbol": symbol,
                    "entry_price": pos["avg_price"],
                    "exit_price": round(price, 2),
                    "quantity": quantity,
                    "pnl": round(realized_pnl, 2),
                    "entry_time": pos["entry_time"],
                    "exit_time": timestamp,
                })
                del positions[symbol]

    save_positions(positions)
    save_trades(trades)

    return {"ok": True, "order": order, "position": positions.get(symbol)}


def close_position(symbol: str) -> dict:
    """Close an open position at current market price."""
    positions = load_positions()
    if symbol not in positions:
        return {"ok": False, "error": f"No open position for {symbol}"}
    return place_order(symbol, "SELL", positions[symbol]["quantity"], "MARKET")


def get_portfolio() -> dict:
    """Get current portfolio summary."""
    positions = load_positions()
    trades = load_trades()

    total_pnl = 0.0
    positions_list = []

    for symbol, pos in positions.items():
        # Get current price
        try:
            import yfinance as yf
            ticker = symbol.replace(" ", "") + ".NS" if not symbol.startswith("^") else symbol
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1d")
            if not hist.empty:
                current_price = hist["Close"].iloc[-1]
                pos["current_price"] = float(current_price)
                pos["unrealized_pnl"] = round((current_price - pos["avg_price"]) * pos["quantity"], 2)
                total_pnl += pos["unrealized_pnl"]
        except Exception:
            pass
        positions_list.append(pos)
        total_pnl += pos.get("realized_pnl", 0.0)

    total_realized = sum(t["pnl"] for t in trades)

    return {
        "positions": positions_list,
        "open_count": len(positions),
        "total_unrealized_pnl": round(total_pnl, 2),
        "total_realized_pnl": round(total_realized, 2),
        "trade_count": len(trades),
    }


def get_trade_history(limit: int = 50) -> list[dict]:
    """Get recent trade history."""
    trades = load_trades()
    return trades[-limit:] if limit else trades


def auto_check_and_trade(symbols: list[str], signals: dict[str, str]) -> list[dict]:
    """Auto-trade based on signals. For each symbol, buy if bullish, sell if bearish."""
    positions = load_positions()
    actions = []

    for symbol in symbols:
        signal = signals.get(symbol, "neutral")
        if signal == "bullish" and symbol not in positions:
            result = place_order(symbol, "BUY", 1)
            if result["ok"]:
                actions.append({"action": "BUY", "symbol": symbol, "price": result["order"]["price"]})
        elif signal == "bearish" and symbol in positions:
            result = close_position(symbol)
            if result["ok"]:
                actions.append({"action": "SELL", "symbol": symbol})

    return actions
