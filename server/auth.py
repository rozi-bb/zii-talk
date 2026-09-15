"""Akun: hash password, sesi login (cookie), dan "siapa yang lagi login".

- Password di-hash pakai scrypt bawaan Python — nggak butuh package tambahan.
- Sesi = token acak di cookie httpOnly. Yang disimpan di database cuma
  sha256-nya, jadi bocornya tabel `sessions` nggak bikin orang bisa login.
- Akun pertama yang dibikin jadi admin dan dapet semua data lama (dari zaman
  app ini masih satu user).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import math
import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import Request, Response

from server import db

COOKIE = "zii_session"
SESSION_DAYS = 30
MIN_PASSWORD = 8
MAX_PASSWORD = 200  # scrypt tetap jalan buat input segede apa pun; ini biar nggak dipakai buat nyiksa CPU

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# scrypt: n=2^15, r=8 butuh ±32MB RAM per hash (~50ms) — standar OWASP
_N, _R, _P = 2**15, 8, 1
_MAXMEM = 64 * 1024 * 1024


class NotLoggedIn(Exception):
    """Belum login / sesinya habis. Dijadiin 401 di main.py."""


@dataclass
class User:
    id: int
    email: str
    role: Literal["admin", "user"]


# ── password ───────────────────────────────────────────────────────


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=_MAXMEM, dklen=64)


def _hash_sync(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = _scrypt(password, salt, _N, _R, _P)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${_N}${_R}${_P}${b64(salt)}${b64(key)}"


def _verify_sync(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, key = stored.split("$")
        if algo != "scrypt":
            return False
        got = _scrypt(password, base64.b64decode(salt), int(n), int(r), int(p))
        return hmac.compare_digest(got, base64.b64decode(key))
    except (ValueError, TypeError):
        return False


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hash_sync, password)


# hash bohongan: email yang nggak terdaftar tetap makan waktu yang sama,
# jadi lamanya respons nggak ngebocorin email mana yang punya akun
_DUMMY = _hash_sync(secrets.token_hex(8))


async def verify_password(password: str, stored: str | None) -> bool:
    ok = await asyncio.to_thread(_verify_sync, password, stored or _DUMMY)
    return ok and stored is not None


def norm_email(email: object) -> str:
    return str(email or "").strip().lower()[:254]


def check_credentials(email: str, password: str) -> str | None:
    """Pesan error yang kebaca manusia, atau None kalau aman."""
    if not EMAIL.match(email):
        return "Format email-nya belum bener"
    if len(password) < MIN_PASSWORD:
        return f"Password minimal {MIN_PASSWORD} karakter"
    if len(password) > MAX_PASSWORD:
        return f"Password maksimal {MAX_PASSWORD} karakter"
    return None


# ── batas salah password ───────────────────────────────────────────
# Disimpan di memori: server restart = hitungannya ke-reset. Cukup buat
# ngerem tebak-tebakan password lewat tailnet.

MAX_FAILS = 5
LOCK_SECONDS = 60
FORGET_AFTER = 15 * 60  # salah sesekali dalam jarak jauh nggak numpuk jadi kekunci

_fails: dict[str, tuple[int, float]] = {}


def wait_seconds(email: str) -> int:
    """Berapa detik lagi email ini boleh nyoba login. 0 = boleh sekarang."""
    count, last = _fails.get(email, (0, 0.0))
    if count < MAX_FAILS:
        return 0
    left = last + LOCK_SECONDS - time.monotonic()
    if left <= 0:
        _fails.pop(email, None)
        return 0
    return math.ceil(left)


def record_fail(email: str) -> None:
    now = time.monotonic()
    if len(_fails) > 1000:
        for k in [k for k, (_, t) in _fails.items() if now - t > FORGET_AFTER]:
            del _fails[k]
    count, last = _fails.get(email, (0, 0.0))
    if now - last > FORGET_AFTER:
        count = 0
    _fails[email] = (count + 1, now)


def clear_fails(email: str) -> None:
    _fails.pop(email, None)


# ── akun ───────────────────────────────────────────────────────────


def _user(r: dict[str, Any]) -> User:
    return User(id=r["id"], email=r["email"], role=r["role"])


async def create_user(conn: Any, email: str, password_hash: str) -> User | None:
    """Bikin akun. None = email-nya udah dipakai. Harus di dalam transaksi.

    Akun pertama jadi admin dan ngambil semua data yang belum ada pemiliknya
    (frasa, riwayat tes, model/suara/momentum dari zaman satu user)."""
    # serialisasi pendaftaran: dua orang daftar barengan nggak bisa dua-duanya jadi "akun pertama"
    await conn.execute("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")
    cur = await conn.execute("SELECT 1 FROM users WHERE lower(email) = %s", (email,))
    if await cur.fetchone():
        return None
    cur = await conn.execute("SELECT NOT EXISTS (SELECT 1 FROM users) AS first")
    first = (await cur.fetchone())["first"]

    cur = await conn.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s) RETURNING id, email, role",
        (email, password_hash, "admin" if first else "user"),
    )
    user = _user(await cur.fetchone())

    if first:
        for table in ("app_state", "phrases", "test_runs"):
            await conn.execute(f"UPDATE {table} SET user_id = %s WHERE user_id IS NULL", (user.id,))
    await conn.execute("INSERT INTO app_state (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING", (user.id,))
    return user


async def has_users() -> bool:
    row = await db.fetch_one("SELECT EXISTS (SELECT 1 FROM users) AS any")
    return bool(row and row["any"])


# ── sesi login ─────────────────────────────────────────────────────


def _digest(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


async def start_session(conn: Any, user_id: int, request: Request, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await conn.execute("DELETE FROM sessions WHERE expires_at < now()")
    await conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (_digest(token), user_id, expires),
    )
    response.set_cookie(
        COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        # lewat `tailscale serve` (HTTPS) cookie-nya dikunci ke HTTPS; di localhost tetap jalan
        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
        path="/",
    )


async def end_session(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        async with (await db.pool()).connection() as conn:
            await conn.execute("DELETE FROM sessions WHERE token_hash = %s", (_digest(token),))
    response.delete_cookie(COOKIE, path="/")


async def user_from(request: Request) -> User | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    row = await db.fetch_one(
        """
        SELECT u.id, u.email, u.role
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s AND s.expires_at > now()
        """,
        (_digest(token),),
    )
    return _user(row) if row else None


async def current_user(request: Request) -> User:
    """Dependency FastAPI: semua route selain /api/auth/* wajib login."""
    user = await user_from(request)
    if user is None:
        raise NotLoggedIn()
    return user
