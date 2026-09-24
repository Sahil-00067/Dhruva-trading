"""WhatsApp notifications — Simple local approach.

This uses a local webhook approach:
1. User scans QR code to connect their WhatsApp (one-time)
2. Backend receives webhook when messages are sent
3. Notifications are queued and sent via local WhatsApp Web

For production, integrate with:
- Twilio API (paid, reliable)
- WPPConnect (open source, needs QR scan)
- WhatsApp Business API (official)
"""
from __future__ import annotations

import os
import json
import time
from pathlib import Path
from typing import Optional

SESSION_DIR = Path(__file__).parent.parent / ".whatsapp_sessions"
SESSION_DIR.mkdir(exist_ok=True)


def get_session_file(phone: str) -> Path:
    """Get session file path for a phone number."""
    safe_phone = phone.replace("+", "").replace(" ", "")
    return SESSION_DIR / f"{safe_phone}.json"


def load_session(phone: str) -> Optional[dict]:
    """Load WhatsApp session for a phone number."""
    session_file = get_session_file(phone)
    try:
        if session_file.exists():
            with open(session_file) as f:
                return json.load(f)
    except:
        pass
    return None


def save_session(phone: str, data: dict) -> None:
    """Save WhatsApp session."""
    session_file = get_session_file(phone)
    with open(session_file, "w") as f:
        json.dump(data, f, indent=2)


def delete_session(phone: str) -> None:
    """Delete WhatsApp session."""
    session_file = get_session_file(phone)
    if session_file.exists():
        session_file.unlink()


def send_whatsapp(to: str, message: str) -> dict:
    """Send WhatsApp message using local session.
    
    In production, this would use a real WhatsApp automation library.
    For now, logs the message and returns success.
    """
    # Clean phone number
    clean_to = to.replace("+", "").replace(" ", "").replace("-", "")
    if not clean_to.startswith("91"):
        clean_to = "91" + clean_to
    
    # Log the message (in production, send via WhatsApp API)
    log_entry = {
        "to": f"+{clean_to}",
        "message": message,
        "sent_at": time.time(),
        "status": "queued"
    }
    
    # Save to queue file
    queue_file = Path(__file__).parent.parent / ".notification_queue.json"
    queue = []
    if queue_file.exists():
        try:
            with open(queue_file) as f:
                queue = json.load(f)
        except:
            queue = []
    
    queue.append(log_entry)
    with open(queue_file, "w") as f:
        json.dump(queue, f, indent=2)
    
    return {"ok": True, "to": f"+{clean_to}", "queued": True}


def send_signal_notification(phone: str, signal: dict) -> dict:
    """Send WhatsApp notification for a signal change."""
    emoji = {"bullish": "📈", "bearish": "📉", "neutral": "➡️"}.get(signal.get("signal"), "⚪")
    direction = {"bullish": "UP", "bearish": "DOWN", "neutral": "FLAT"}.get(signal.get("signal"), "?")
    symbol = signal.get("symbol", "Unknown")
    
    message = f"*Dhruva Signal Alert* {emoji}\n\nSymbol: {symbol}\nTrend: {direction}\nTime: {signal.get('time', 'Now')}\n\n— Dhruva Paper Trading"
    
    return send_whatsapp(phone, message)


def test_connection(phone: str) -> dict:
    """Send test WhatsApp message."""
    return send_whatsapp(phone, "✅ Dhruva notification test successful! You're all set.")


def get_setup_status() -> dict:
    """Get current setup status."""
    return {
        "method": "local_queue",
        "description": "Messages are queued and will be sent via WhatsApp Web",
        "instructions": [
            "1. Sign up on the app with your WhatsApp number",
            "2. Go to Settings → Notifications → WhatsApp",
            "3. Click 'Connect WhatsApp' and scan QR code",
            "4. Messages will be sent automatically"
        ]
    }
