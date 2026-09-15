"""Nyatet sesi tes ke Postgres.

Aturannya: sesi baru ada di database begitu jawaban ke-MIN_ANSWERS masuk.
Sebelum itu semuanya cuma hidup di browser — keluar di jawaban ke-7 = sesi
itu nggak pernah ada.

Browser ngirim transkrip lengkap tiap giliran (server-nya stateless), jadi
tiap giliran tinggal di-"sinkron": baris yang belum ada ditulis, yang udah
ada dibiarin. `seq` = posisi baris di layar sesi.

Dua jalur nulis, sengaja dipisah:
- `sync`       di AWAL giliran: transkrip sampai jawabanku yang barusan.
               Ditulis duluan biar jawaban ke-10 tetap kesimpan walaupun
               kamu langsung keluar selagi Zii masih nyaut.
- `save_reply` di AKHIR giliran: balasan Zii, cuma kalau stream-nya kelar.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from server import db, expressions
from server.util import clean

MIN_ANSWERS = 10


@dataclass
class Turn:
    role: str  # 'ai' | 'me'
    text: str
    at: datetime
    correction: dict[str, str] | None


@dataclass
class Saved:
    attempt: int
    questions: int

    def dump(self) -> dict[str, int]:
        return asdict(self)


def parse_uuid(v: object) -> UUID | None:
    try:
        return UUID(str(v))
    except (TypeError, ValueError):
        return None


def parse_turns(history: object) -> list[Turn]:
    """Transkrip dari browser. Item yang aneh tetap jadi baris, biar `seq` nggak geser."""
    if not isinstance(history, list):
        return []
    now = datetime.now(timezone.utc)
    out: list[Turn] = []
    for item in history:
        t = item if isinstance(item, dict) else {}
        role = "ai" if t.get("role") == "ai" else "me"
        try:
            at = datetime.fromtimestamp(float(t["at"]) / 1000, tz=timezone.utc)
        except (KeyError, TypeError, ValueError, OverflowError, OSError):
            at = now
        c = t.get("correction")
        correction = (
            {k: clean(c.get(k), 300) for k in ("wrong", "right", "why")}
            if role == "me" and isinstance(c, dict) and c.get("right")
            else None
        )
        text = clean(t.get("text"), 2000)
        # balasan Zii di browser masih bawa tag suara ([laughter]) — riwayat tes disimpan bersih
        out.append(Turn(role, expressions.strip(text) if role == "ai" else text, at, correction))
    return out


async def sync(
    user_id: int, run_id: UUID, topic_id: str, situation: str, model: str, turns: list[Turn]
) -> Saved | None:
    answers = sum(t.role == "me" for t in turns)
    async with (await db.pool()).connection() as conn, conn.transaction():
        if not await _lock_run(conn, run_id, user_id):
            if answers < MIN_ANSWERS:
                return None
            # kunci baris topik biar nomor tes nggak dobel kalau dua sesi nyampe barengan
            await conn.execute("SELECT 1 FROM topics WHERE id = %s FOR UPDATE", (topic_id,))
            cur = await conn.execute(
                """
                INSERT INTO test_runs (id, user_id, topic_id, attempt_no, situation, model, started_at, ended_at)
                VALUES (%s, %s, %s,
                        (SELECT coalesce(max(attempt_no), 0) + 1 FROM test_runs
                         WHERE user_id = %s AND topic_id = %s),
                        %s, %s, %s, now())
                ON CONFLICT (id) DO NOTHING
                RETURNING id
                """,
                (run_id, user_id, topic_id, user_id, topic_id, situation, model, turns[0].at),
            )
            # Nggak kebikin = id-nya udah ada. Kalau punya giliran lain dari sesi yang
            # sama (nyampe barengan), lanjut. Kalau punya akun lain, jangan pernah ditulis.
            if await cur.fetchone() is None and not await _lock_run(conn, run_id, user_id):
                return None

        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO messages (run_id, seq, role, text, correction, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (run_id, seq) DO UPDATE SET
                  -- kata-kataku: browser yang paling tau (habis "betulin" teksnya bisa beda).
                  -- Balasan Zii: jangan ditimpa — versi di browser bisa potongan yang
                  -- dikirim selagi Zii masih nulis; yang utuh ditulis save_reply.
                  text = CASE WHEN messages.role = 'me' THEN EXCLUDED.text ELSE messages.text END,
                  -- koreksi datengnya belakangan, jadi jangan sampai ketimpa null
                  correction = coalesce(EXCLUDED.correction, messages.correction)
                """,
                [
                    (run_id, i, t.role, t.text, Jsonb(t.correction) if t.correction else None, t.at)
                    for i, t in enumerate(turns)
                ],
            )
        return await _recount(conn, run_id)


async def save_reply(user_id: int, run_id: UUID, seq: int, text: str, correction: dict[str, str] | None) -> None:
    async with (await db.pool()).connection() as conn, conn.transaction():
        if not await _lock_run(conn, run_id, user_id):
            return  # belum 10 jawaban
        await conn.execute(
            """
            INSERT INTO messages (run_id, seq, role, text, correction, created_at)
            VALUES (%s, %s, 'ai', %s, NULL, now())
            ON CONFLICT (run_id, seq) DO UPDATE SET text = EXCLUDED.text WHERE messages.role = 'ai'
            """,
            (run_id, seq, text),
        )
        if correction and seq > 0:
            await conn.execute(
                "UPDATE messages SET correction = %s WHERE run_id = %s AND seq = %s AND role = 'me'",
                (Jsonb(correction), run_id, seq - 1),
            )
        await conn.execute("UPDATE test_runs SET ended_at = now() WHERE id = %s", (run_id,))


async def rewind(user_id: int, run_id: UUID, keep: int) -> Saved | None:
    """Buat "betulin": buang baris mulai `keep`. Jawabannya jadi di bawah minimum
    = sesinya dihapus lagi, balik jadi "nggak pernah ada"."""
    async with (await db.pool()).connection() as conn, conn.transaction():
        if not await _lock_run(conn, run_id, user_id):
            return None
        await conn.execute("DELETE FROM messages WHERE run_id = %s AND seq >= %s", (run_id, max(0, keep)))
        saved = await _recount(conn, run_id)
        if saved.questions < MIN_ANSWERS:
            await conn.execute("DELETE FROM test_runs WHERE id = %s", (run_id,))
            return None
        return saved


async def _lock_run(conn: AsyncConnection[Any], run_id: UUID, user_id: int) -> bool:
    """Kunci sesi ini — cuma kalau punya akun yang lagi login."""
    cur = await conn.execute("SELECT 1 FROM test_runs WHERE id = %s AND user_id = %s FOR UPDATE", (run_id, user_id))
    return await cur.fetchone() is not None


async def _recount(conn: AsyncConnection[Any], run_id: UUID) -> Saved:
    cur = await conn.execute(
        """
        UPDATE test_runs
        SET question_count = (SELECT count(*) FROM messages WHERE run_id = %s AND role = 'me'),
            ended_at = now()
        WHERE id = %s
        RETURNING attempt_no, question_count
        """,
        (run_id, run_id),
    )
    r = await cur.fetchone()
    assert r is not None
    return Saved(attempt=r["attempt_no"], questions=r["question_count"])
