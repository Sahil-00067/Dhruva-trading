"""Notification delivery — email and Telegram.

Signals are checked on each poll. When a signal fires for the first time since
the last check, we send one notification per channel that's configured.
Notifications are idempotent: if the same signal fires again before the next
state change, it won't spam.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

import yfinance as yf

STATE_FILE = os.path.join(os.path.dirname(__file__), "..", ".notification_state.json")

_SENDERS = {
    "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
    },
}


def load_config() -> dict:
    path = os.path.join(os.path.dirname(__file__), "..", ".notifications.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"enabled": False, "channels": {}}


def save_config(cfg: dict) -> None:
    path = os.path.join(os.path.dirname(__file__), "..", ".notifications.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def load_state() -> dict:
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def _request(method: str, url: str, body: dict | None = None, headers: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e.reason}") from e


def get_status() -> dict:
    cfg = load_config()
    return {
        "enabled": cfg.get("enabled", False),
        "channels": list(cfg.get("channels", {}).keys()),
        "watchlist": cfg.get("watchlist", []),
    }


def update_config(cfg: dict) -> dict:
    save_config(cfg)
    return get_status()


def _get_last_signal(symbol: str) -> str:
    state = load_state()
    return state.get(symbol, "")


def _set_last_signal(symbol: str, signal: str) -> None:
    state = load_state()
    state[symbol] = signal
    save_state(state)


def check_signals(symbols: list[str] | None = None) -> list[dict]:
    """Check each symbol for trend changes and return list of triggered signals."""
    cfg = load_config()
    if not cfg.get("enabled"):
        return []

    watchlist = symbols or cfg.get("watchlist", ["NIFTY 50"])
    signals = []

    for symbol in watchlist:
        try:
            last = _get_last_signal(symbol)
            current = _get_current_signal(symbol)
            if current and current != last:
                signals.append({
                    "symbol": symbol,
                    "signal": current,
                    "last": last,
                    "changed": True,
                })
                _set_last_signal(symbol, current)
            elif current:
                signals.append({
                    "symbol": symbol,
                    "signal": current,
                    "last": last,
                    "changed": False,
                })
        except Exception as e:
            signals.append({
                "symbol": symbol,
                "error": str(e),
                "signal": None,
                "last": _get_last_signal(symbol),
                "changed": False,
            })

    return signals


def _get_current_signal(symbol: str) -> str | None:
    """Simple trend detection: 20-day MA vs 50-day MA."""
    try:
        ticker = symbol.replace(" ", "") + ".NS" if not symbol.startswith("^") else symbol
        if symbol in ("NIFTY 50", "SENSEX", "BANKNIFTY"):
            ticker = {"NIFTY 50": "^NSEI", "SENSEX": "^BSESN", "BANKNIFTY": "^NSEBANK"}.get(symbol, symbol)

        stock = yf.Ticker(ticker)
        hist = stock.history(period="3mo", interval="1d")
        if len(hist) < 50:
            return None

        closes = hist["Close"].tolist()
        ma20 = sum(closes[-20:]) / 20
        ma50 = sum(closes[-50:]) / 50
        price = closes[-1]

        if price > ma20 > ma50:
            return "bullish"
        elif price < ma20 < ma50:
            return "bearish"
        return "neutral"
    except Exception:
        return None


def send_signal(signal: dict) -> dict:
    """Send a triggered signal through all enabled channels."""
    cfg = load_config()
    channels = cfg.get("channels", {})
    results = {}

    for name, chan_cfg in channels.items():
        try:
            if name == "telegram":
                results["telegram"] = _send_telegram(chan_cfg, signal)
            elif name == "email":
                results["email"] = _send_email(chan_cfg, signal)
            elif name == "whatsapp":
                results["whatsapp"] = _send_whatsapp(chan_cfg, signal)
            elif name == "browser":
                # Browser notifications don't need a channel config, just track that they're enabled
                results["browser"] = {"ok": True, "note": "Notification will appear in browser"}
        except Exception as e:
            results[name] = {"ok": False, "error": str(e)}

    return results


def _send_telegram(cfg: dict, signal: dict) -> dict:
    token = cfg.get("token", "")
    chat_id = cfg.get("chat_id", "")
    if not token or not chat_id:
        return {"ok": False, "error": "Missing token or chat_id"}

    tone = signal.get("signal", "")
    emoji = {"bullish": "\U0001f4c8", "bearish": "\U0001f4e9", "neutral": "\U0001f4ca"}.get(tone, "\U00002753")
    direction = {"bullish": "UP", "bearish": "DOWN", "neutral": "FLAT"}.get(tone, "?")

    text = f"{emoji} *{signal['symbol']}* trend is now {direction}\n\nLast check: {_format_time()}"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    _request("POST", url, {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    })
    return {"ok": True}


def _send_email(cfg: dict, signal: dict) -> dict:
    sender = cfg.get("sender", "")
    password = cfg.get("password", "")
    recipient = cfg.get("recipient", "")
    if not sender or not password or not recipient:
        return {"ok": False, "error": "Missing email config"}

    tone = signal.get("signal", "")
    direction = {"bullish": "BULLISH (buy signal)", "bearish": "BEARISH (sell signal)", "neutral": "NEUTRAL"}.get(tone, "UNKNOWN")

    subject = f"[Dhruva] {signal['symbol']} — {direction}"
    body = f"""Dhruva Signal Alert

Symbol: {signal['symbol']}
Signal: {direction}
Time: {_format_time()}

This is an automated alert from Dhruva. Not investment advice."""

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(cfg.get("host", "smtp.gmail.com"), cfg.get("port", 587))
        server.starttls()
        server.login(sender, password)
        server.sendmail(sender, recipient, msg.as_string())
        server.quit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _send_whatsapp(cfg: dict, signal: dict) -> dict:
    """Send via WhatsApp Web API (requires official Business API or twilio)."""
    phone = cfg.get("phone", "")
    if not phone:
        return {"ok": False, "error": "Missing phone number"}

    # This uses a simple web-based approach — for production, use Twilio or similar
    tone = signal.get("signal", "")
    direction = {"bullish": "BULLISH", "bearish": "BEARISH", "neutral": "NEUTRAL"}.get(tone, "UNKNOWN")
    message = f"[Dhruva Alert] {signal['symbol']} trend is now {direction}. {_format_time()}"

    # Using a simple API — in production you'd use Twilio or official WhatsApp Business API
    api_url = f"https://api.example.com/send"  # Placeholder — implement with Twilio
    return {"ok": False, "error": "WhatsApp requires Twilio or official API integration"}


def _format_time() -> str:
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M IST")


def get_watchlist() -> list[str]:
    cfg = load_config()
    return cfg.get("watchlist", ["NIFTY 50"])


def update_watchlist(symbols: list[str]) -> dict:
    cfg = load_config()
    cfg["watchlist"] = symbols
    save_config(cfg)
    return get_status()
