"""WhatsApp notifications via WPPConnect (direct WhatsApp Web connection).

No Twilio needed. Scans QR code once, then sends messages directly to any WhatsApp number.
Stores session data locally so you only scan once per device.
"""
from __future__ import annotations

import os
import json
import asyncio
from typing import Optional

SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", ".wpp_sessions")
os.makedirs(SESSION_DIR, exist_ok=True)

# Module-level state
_client = None
_qr_code = None
_is_connected = False


def get_qr() -> dict:
    """Get QR code for scanning. Call this when user clicks 'Connect WhatsApp'."""
    global _client, _qr_code, _is_connected
    
    if _client and _is_connected:
        return {"connected": True, "qr": None}
    
    import wppconnect
    from wppconnect.factory import Factory
    
    try:
        # Use existing session if available
        session_path = os.path.join(SESSION_DIR, "default")
        
        _client = Factory().new_session(
            session="default",
            folder=SESSION_DIR,
            device_name="Dhruva",
        )
        
        # Wait for QR
        def on_qr(qr: str):
            global _qr_code
            _qr_code = qr
        
        _client.on_qr(on_qr)
        
        # Start listening (non-blocking)
        _client.start_listen()
        
        return {"connected": False, "qr": _qr_code}
    except Exception as e:
        return {"connected": False, "qr": None, "error": str(e)}


def send_message(to: str, message: str) -> dict:
    """Send WhatsApp message. Returns {ok, error?}."""
    global _client, _is_connected
    
    if not _client:
        return {"ok": False, "error": "Not connected. Scan QR code first."}
    
    try:
        # Normalize phone number (remove +, spaces, etc.)
        clean_number = to.replace("+", "").replace(" ", "").replace("-", "")
        if not clean_number.startswith("91"):
            clean_number = "91" + clean_number
        
        result = _client.send_message(clean_number, message)
        return {"ok": bool(result)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def check_connection() -> dict:
    """Check if WhatsApp is connected."""
    global _is_connected
    return {"connected": _is_connected}


def send_signal_notification(phone: str, signal: dict) -> dict:
    """Send a WhatsApp notification for a signal change."""
    emoji = {"bullish": "📈", "bearish": "📉", "neutral": "➡️"}.get(signal.get("signal"), "⚪")
    direction = {"bullish": "UP", "bearish": "DOWN", "neutral": "FLAT"}.get(signal.get("signal"), "?")
    symbol = signal.get("symbol", "Unknown")
    
    message = f"*Dhruva Signal Alert* {emoji}\n\nSymbol: {symbol}\nTrend: {direction}\nTime: {signal.get('time', 'Now')}\n\n— Dhruva Paper Trading"
    
    return send_message(phone, message)


def test_connection(phone: str) -> dict:
    """Send a test WhatsApp message."""
    return send_message(phone, "✅ Dhruva notification test successful! You're all set.")
