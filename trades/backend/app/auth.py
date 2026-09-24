"""User authentication — SQLite-backed, JWT tokens, bcrypt passwords.

Security: passwords are hashed with bcrypt (via passlib). JWTs are signed with
a secret from env (DHRUVA_JWT_SECRET) and expire after 7 days. The token is
stored client-side in localStorage and sent as a Bearer header on auth-required
requests.
"""
from __future__ import annotations

import os
import sqlite3
import secrets
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
import os
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import bcrypt
import jwt

DB_PATH = os.path.join(os.path.dirname(__file__), "..", ".users.db")
JWT_SECRET = os.environ.get("DHRUVA_JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_DAYS = 7


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()


_init_db()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def register(username: str, phone: str, password: str) -> dict:
    """Register a new user. Returns {ok, user_id, token} or {ok: False, error}."""
    conn = _get_db()
    try:
        # Check if user exists
        row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if row:
            return {"ok": False, "error": "Username already exists"}

        password_hash = hash_password(password)
        cursor = conn.execute(
            "INSERT INTO users (username, phone, password_hash) VALUES (?, ?, ?)",
            (username, phone, password_hash),
        )
        user_id = cursor.lastrowid
        token = create_token(user_id)
        conn.commit()
        return {"ok": True, "user_id": user_id, "token": token, "username": username, "phone": phone}
    finally:
        conn.close()


def login(username: str, password: str) -> dict:
    """Login. Returns {ok, user_id, token, username} or {ok: False, error}."""
    conn = _get_db()
    try:
        row = conn.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,)).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            return {"ok": False, "error": "Invalid username or password"}
        token = create_token(row["id"])
        return {"ok": True, "user_id": row["id"], "token": token, "username": row["username"]}
    finally:
        conn.close()


def get_user(token: str) -> Optional[dict]:
    """Get current user from token. Returns None if invalid."""
    payload = decode_token(token)
    if not payload:
        return None
    conn = _get_db()
    try:
        row = conn.execute("SELECT id, username, phone FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()