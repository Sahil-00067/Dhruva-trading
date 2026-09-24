"""Dhan (DhanHQ v2) integration — the ONLY place the broker token lives.

Security posture (deliberate):
  * The access token can place real orders on a funded account, so it never
    touches the browser. Settings POSTs it here once; the backend persists it to
    a gitignored creds file and only ever returns a MASKED view to the UI.
  * Reads (profile / quotes / historical) are enabled once a token is saved.
    Order placement is a SEPARATE, explicitly-gated surface built later — this
    module has no order-write code by design.

Dhan splits its APIs into two families that share one token:
  * Trading API  — orders, positions, funds (free for all Dhan users)
  * Data API     — live feed, quotes, historical (a separate PAID data plan)
Whether live data works depends on the account's `dataPlan`, not the token — so
the connection test surfaces `dataPlan`/`dataValidity` from the profile.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

BASE = "https://api.dhan.co/v2"
CREDS_PATH = os.path.join(os.path.dirname(__file__), "..", ".dhan_creds.json")
_TIMEOUT = 15


# ---- creds storage (gitignored file; never returned raw to the UI) ----

def load_creds() -> dict | None:
    try:
        with open(CREDS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("accessToken") and data.get("clientId"):
            return data
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return None


def save_creds(client_id: str, access_token: str) -> None:
    client_id = (client_id or "").strip()
    access_token = (access_token or "").strip()
    if not client_id or not access_token:
        raise ValueError("Both Client ID and Access Token are required.")
    with open(CREDS_PATH, "w", encoding="utf-8") as f:
        json.dump({"clientId": client_id, "accessToken": access_token}, f)
    # Best-effort: keep the token readable only by the owner on POSIX; a no-op on Windows.
    try:
        os.chmod(CREDS_PATH, 0o600)
    except OSError:
        pass


def clear_creds() -> None:
    try:
        os.remove(CREDS_PATH)
    except FileNotFoundError:
        pass


def _mask(token: str) -> str:
    """Show only the last 4 chars, e.g. '••••••••3f9a', so status is verifiable but not leaky."""
    if len(token) <= 4:
        return "••••"
    return "••••••••" + token[-4:]


def status() -> dict:
    """Masked, browser-safe view of whether a token is configured."""
    creds = load_creds()
    if not creds:
        return {"configured": False}
    return {
        "configured": True,
        "clientId": creds["clientId"],
        "tokenMask": _mask(creds["accessToken"]),
    }


# ---- Dhan REST (read-only helpers) ----

def _request(method: str, path: str, body: dict | None = None) -> dict:
    creds = load_creds()
    if not creds:
        raise RuntimeError("No Dhan token saved. Add it in Settings first.")
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("access-token", creds["accessToken"])
    req.add_header("client-id", creds["clientId"])
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"Dhan API {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not reach Dhan: {e.reason}") from e


def profile() -> dict:
    """GET /v2/profile — validates the token and reveals the data-plan entitlement.

    Returns the fields the Settings 'Test connection' card cares about, normalised.
    """
    p = _request("GET", "/profile")
    return {
        "clientId": p.get("dhanClientId"),
        "tokenValidity": p.get("tokenValidity"),
        "activeSegment": p.get("activeSegment"),
        "dataPlan": p.get("dataPlan"),
        "dataValidity": p.get("dataValidity"),
    }
