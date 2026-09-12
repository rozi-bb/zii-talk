"""Koneksi Postgres + migrasi.

Satu pool buat seluruh server. Migrasi = file .sql di server/migrations,
dijalanin urut nama, sekali per file, dicatat di `schema_migrations`.

Kalau Postgres belum nyala waktu server start, server tetap hidup: tiap
request nyoba nyambung lagi, jadi `npm run db:up` belakangan juga beres
tanpa restart.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

DEFAULT_URL = "postgresql://zii:zii@127.0.0.1:5439/zii_talk"
MIGRATIONS = Path(__file__).resolve().parent / "migrations"


class DatabaseDown(RuntimeError):
    """Postgres nggak bisa dihubungi. Dijadiin 503 di main.py."""


_pool: AsyncConnectionPool | None = None
_lock = asyncio.Lock()


def url() -> str:
    return (os.environ.get("DATABASE_URL") or "").strip() or DEFAULT_URL


def where() -> str:
    """host:port/db tanpa password — buat log & pesan error."""
    try:
        d = conninfo_to_dict(url())
        return f"{d.get('host', '?')}:{d.get('port', '5432')}/{d.get('dbname', '?')}"
    except Exception:  # noqa: BLE001
        return "DATABASE_URL"


async def pool() -> AsyncConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    async with _lock:
        if _pool is not None:
            return _pool
        p = AsyncConnectionPool(
            url(),
            min_size=1,
            max_size=5,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        try:
            await p.open(wait=True, timeout=3)
            await _migrate(p)
        except Exception as e:
            await p.close()
            raise DatabaseDown(
                f"Postgres ({where()}) nggak bisa dihubungi. Jalanin `npm run db:up` dulu. ({e})"
            ) from e
        _pool = p
        return p


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def _migrate(p: AsyncConnectionPool) -> None:
    async with p.connection() as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            " version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        cur = await conn.execute("SELECT version FROM schema_migrations")
        done = {r["version"] for r in await cur.fetchall()}

    for f in sorted(MIGRATIONS.glob("*.sql")):
        if f.stem in done:
            continue
        # satu file = satu transaksi: gagal di tengah, nggak ada yang setengah jadi
        async with p.connection() as conn, conn.transaction():
            await conn.execute(f.read_text())  # tanpa parameter = boleh banyak statement
            await conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (f.stem,))
        print(f"  Migrasi       →  {f.name}")


async def fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    async with (await pool()).connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()


async def fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    async with (await pool()).connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchone()
