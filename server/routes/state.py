"""State app (satu user): model & suara pilihan, momentum, dan koleksi frasa."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from server import db
from server.agent.models import is_model_id
from server.util import clean
from server.voices import is_voice_id, pick_voice

router = APIRouter(prefix="/api", tags=["State"])


class StateOut(BaseModel):
    model: str
    voice: str  # selalu valid: belum pernah milih / udah nggak ada di daftar -> default
    momentum: int
    lastPlayed: date | None
    phrases: int


class ModelIn(BaseModel):
    model: str


class VoiceIn(BaseModel):
    voice: str


class PhraseIn(BaseModel):
    en: str = Field(min_length=1)
    id: str = ""
    topicId: str | None = None


class PhraseOut(BaseModel):
    id: int
    en: str
    meaning: str  # arti / kalimat Indonesia-nya, boleh kosong
    topicId: str | None
    topicName: str | None  # topik udah dihapus = None
    createdAt: datetime


async def _read(conn: Any) -> StateOut:
    cur = await conn.execute(
        "SELECT model, voice, momentum, last_played, (SELECT count(*) FROM phrases)::int AS phrases"
        " FROM app_state WHERE id = 1"
    )
    r = await cur.fetchone()
    return StateOut(
        model=r["model"],
        voice=pick_voice(r["voice"]),
        momentum=r["momentum"],
        lastPlayed=r["last_played"],
        phrases=r["phrases"],
    )


@router.get("/state", response_model=StateOut, summary="Model & suara pilihan, momentum, jumlah frasa")
async def get_state() -> StateOut:
    async with (await db.pool()).connection() as conn:
        return await _read(conn)


@router.put("/state/model", response_model=StateOut, summary="Simpan model LLM yang dipilih")
async def set_model(body: ModelIn):
    if not is_model_id(body.model):
        return JSONResponse(status_code=400, content={"error": f"Model {body.model!r} nggak dikenal"})
    async with (await db.pool()).connection() as conn:
        await conn.execute("UPDATE app_state SET model = %s WHERE id = 1", (body.model,))
        return await _read(conn)


@router.put("/state/voice", response_model=StateOut, summary="Simpan suara Zii yang dipilih")
async def set_voice(body: VoiceIn):
    if not is_voice_id(body.voice):
        return JSONResponse(status_code=400, content={"error": f"Suara {body.voice!r} nggak dikenal"})
    async with (await db.pool()).connection() as conn:
        await conn.execute("UPDATE app_state SET voice = %s WHERE id = 1", (body.voice,))
        return await _read(conn)


@router.post("/state/touch", response_model=StateOut, summary="Catat hari ini main (momentum)")
async def touch() -> StateOut:
    """Momentum, bukan streak: bolos sehari nggak ngapus apa-apa, dan baru
    mengecil (separuh, minimal 1) kalau nganggur lebih dari 2 hari.
    "Hari ini" pakai jam mesin server — server-nya jalan di mesinmu sendiri."""
    today = date.today()
    async with (await db.pool()).connection() as conn, conn.transaction():
        cur = await conn.execute("SELECT momentum, last_played FROM app_state WHERE id = 1 FOR UPDATE")
        r = await cur.fetchone()
        last: date | None = r["last_played"]
        if last != today:
            gap = (today - last).days if last else 1
            m = r["momentum"]
            # (m + 1) // 2 = Math.round(m / 2) versi lama, tanpa pembulatan bankir Python
            momentum = m + 1 if gap <= 2 else max(1, (m + 1) // 2)
            await conn.execute(
                "UPDATE app_state SET momentum = %s, last_played = %s WHERE id = 1", (momentum, today)
            )
        return await _read(conn)


@router.get("/phrases", response_model=list[PhraseOut], summary="Semua frasa di koleksi, terbaru dulu")
async def list_phrases() -> list[PhraseOut]:
    rows = await db.fetch_all(
        """
        SELECT p.id, p.en, p.meaning, p.topic_id, t.name AS topic_name, p.created_at
        FROM phrases p
        LEFT JOIN topics t ON t.id = p.topic_id
        ORDER BY p.created_at DESC, p.id DESC
        """
    )
    return [
        PhraseOut(
            id=r["id"],
            en=r["en"],
            meaning=r["meaning"],
            topicId=r["topic_id"],
            topicName=r["topic_name"],
            createdAt=r["created_at"],
        )
        for r in rows
    ]


@router.post("/phrases", response_model=StateOut, summary="Simpan frasa ke koleksi (dobel diabaikan)")
async def add_phrase(body: PhraseIn) -> StateOut:
    async with (await db.pool()).connection() as conn:
        await conn.execute(
            """
            INSERT INTO phrases (en, meaning, topic_id)
            VALUES (%s, %s, (SELECT id FROM topics WHERE id = %s))
            ON CONFLICT ((lower(en))) DO NOTHING
            """,
            (clean(body.en, 300), clean(body.id, 300), body.topicId),
        )
        return await _read(conn)


@router.delete("/phrases/{phrase_id}", response_model=StateOut, summary="Hapus frasa dari koleksi")
async def delete_phrase(phrase_id: int):
    async with (await db.pool()).connection() as conn:
        cur = await conn.execute("DELETE FROM phrases WHERE id = %s", (phrase_id,))
        if cur.rowcount == 0:
            return JSONResponse(status_code=404, content={"error": "Frasa nggak ketemu — mungkin udah dihapus"})
        return await _read(conn)
