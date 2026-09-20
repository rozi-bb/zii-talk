"""State per akun: model & suara pilihan, momentum, dan koleksi frasa."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from server import db
from server.agent.models import is_model_id
from server.auth import User, current_user
from server.util import clean
from server.voices import is_voice_id, pick_voice

router = APIRouter(prefix="/api", tags=["State"])

Result = Literal["pas", "hampir", "belum"]

# Kotak Leitner: jarak ulang (hari) per kotak. Pas = naik satu kotak,
# hampir = kotaknya tetap, belum = balik ke kotak 1. Dua yang terakhir
# diulang besok, biar yang belum nyantol nggak nunggu lama.
BOX_DAYS = {1: 1, 2: 3, 3: 7, 4: 14, 5: 30}
MAX_BOX = 5


class StateOut(BaseModel):
    model: str
    voice: str  # selalu valid: belum pernah milih / udah nggak ada di daftar -> default
    momentum: int
    lastPlayed: date | None
    phrases: int
    due: int  # frasa yang waktunya diulang hari ini


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
    box: int  # kotak Leitner 1-5
    nextReviewAt: datetime
    lastResult: Result | None
    reviews: int


class ReviewIn(BaseModel):
    result: Result


class ReviewOut(BaseModel):
    phrase: PhraseOut
    due: int  # sisa frasa yang masih jatuh tempo


PHRASE_COLUMNS = """
    p.id, p.en, p.meaning, p.topic_id, t.name AS topic_name, p.created_at,
    p.box, p.next_review_at, p.last_result, p.reviews
"""


def _phrase(r: dict[str, Any]) -> PhraseOut:
    return PhraseOut(
        id=r["id"],
        en=r["en"],
        meaning=r["meaning"],
        topicId=r["topic_id"],
        topicName=r["topic_name"],
        createdAt=r["created_at"],
        box=r["box"],
        nextReviewAt=r["next_review_at"],
        lastResult=r["last_result"],
        reviews=r["reviews"],
    )


async def _read(conn: Any, user_id: int) -> StateOut:
    sql = (
        "SELECT model, voice, momentum, last_played,"
        " (SELECT count(*) FROM phrases WHERE user_id = %s)::int AS phrases,"
        " (SELECT count(*) FROM phrases WHERE user_id = %s AND next_review_at <= now())::int AS due"
        " FROM app_state WHERE user_id = %s"
    )
    cur = await conn.execute(sql, (user_id, user_id, user_id))
    r = await cur.fetchone()
    if r is None:
        # barisnya dibikin waktu daftar; ini jaga-jaga buat akun yang dibikin di luar app
        await conn.execute("INSERT INTO app_state (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING", (user_id,))
        cur = await conn.execute(sql, (user_id, user_id, user_id))
        r = await cur.fetchone()
    return StateOut(
        model=r["model"],
        voice=pick_voice(r["voice"]),
        momentum=r["momentum"],
        lastPlayed=r["last_played"],
        phrases=r["phrases"],
        due=r["due"],
    )


@router.get("/state", response_model=StateOut, summary="Model & suara pilihan, momentum, jumlah frasa")
async def get_state(user: User = Depends(current_user)) -> StateOut:
    async with (await db.pool()).connection() as conn:
        return await _read(conn, user.id)


@router.put("/state/model", response_model=StateOut, summary="Simpan model LLM yang dipilih")
async def set_model(body: ModelIn, user: User = Depends(current_user)):
    if not is_model_id(body.model):
        return JSONResponse(status_code=400, content={"error": f"Model {body.model!r} nggak dikenal"})
    async with (await db.pool()).connection() as conn:
        await conn.execute("UPDATE app_state SET model = %s WHERE user_id = %s", (body.model, user.id))
        return await _read(conn, user.id)


@router.put("/state/voice", response_model=StateOut, summary="Simpan suara Zii yang dipilih")
async def set_voice(body: VoiceIn, user: User = Depends(current_user)):
    if not is_voice_id(body.voice):
        return JSONResponse(status_code=400, content={"error": f"Suara {body.voice!r} nggak dikenal"})
    async with (await db.pool()).connection() as conn:
        await conn.execute("UPDATE app_state SET voice = %s WHERE user_id = %s", (body.voice, user.id))
        return await _read(conn, user.id)


@router.post("/state/touch", response_model=StateOut, summary="Catat hari ini main (momentum)")
async def touch(user: User = Depends(current_user)) -> StateOut:
    """Momentum, bukan streak: bolos sehari nggak ngapus apa-apa, dan baru
    mengecil (separuh, minimal 1) kalau nganggur lebih dari 2 hari.
    "Hari ini" pakai jam mesin server — server-nya jalan di mesinmu sendiri."""
    today = date.today()
    async with (await db.pool()).connection() as conn, conn.transaction():
        await _read(conn, user.id)  # mastiin barisnya ada sebelum dikunci
        cur = await conn.execute(
            "SELECT momentum, last_played FROM app_state WHERE user_id = %s FOR UPDATE", (user.id,)
        )
        r = await cur.fetchone()
        last: date | None = r["last_played"]
        if last != today:
            gap = (today - last).days if last else 1
            m = r["momentum"]
            # (m + 1) // 2 = Math.round(m / 2) versi lama, tanpa pembulatan bankir Python
            momentum = m + 1 if gap <= 2 else max(1, (m + 1) // 2)
            await conn.execute(
                "UPDATE app_state SET momentum = %s, last_played = %s WHERE user_id = %s",
                (momentum, today, user.id),
            )
        return await _read(conn, user.id)


@router.get("/phrases", response_model=list[PhraseOut], summary="Semua frasa di koleksi, terbaru dulu")
async def list_phrases(user: User = Depends(current_user)) -> list[PhraseOut]:
    rows = await db.fetch_all(
        f"""
        SELECT {PHRASE_COLUMNS}
        FROM phrases p
        LEFT JOIN topics t ON t.id = p.topic_id
        WHERE p.user_id = %s
        ORDER BY p.created_at DESC, p.id DESC
        """,
        (user.id,),
    )
    return [_phrase(r) for r in rows]


@router.get(
    "/phrases/due",
    response_model=list[PhraseOut],
    summary="Frasa yang waktunya diulang, yang paling lama nunggu duluan",
)
async def due_phrases(limit: int = 20, user: User = Depends(current_user)) -> list[PhraseOut]:
    rows = await db.fetch_all(
        f"""
        SELECT {PHRASE_COLUMNS}
        FROM phrases p
        LEFT JOIN topics t ON t.id = p.topic_id
        WHERE p.user_id = %s AND p.next_review_at <= now()
        ORDER BY p.next_review_at, p.id
        LIMIT %s
        """,
        (user.id, max(1, min(limit, 50))),
    )
    return [_phrase(r) for r in rows]


@router.post(
    "/phrases/{phrase_id}/review",
    response_model=ReviewOut,
    summary="Catat hasil latihan ulang & jadwalin ulangan berikutnya",
)
async def review_phrase(phrase_id: int, body: ReviewIn, user: User = Depends(current_user)):
    async with (await db.pool()).connection() as conn, conn.transaction():
        cur = await conn.execute(
            "SELECT box FROM phrases WHERE id = %s AND user_id = %s FOR UPDATE", (phrase_id, user.id)
        )
        row = await cur.fetchone()
        if row is None:
            return JSONResponse(status_code=404, content={"error": "Frasa nggak ketemu — mungkin udah dihapus"})

        if body.result == "pas":
            box = min(row["box"] + 1, MAX_BOX)
            days = BOX_DAYS[box]
        else:
            # hampir = kotaknya ditahan, belum = balik dari awal; dua-duanya diulang besok
            box = row["box"] if body.result == "hampir" else 1
            days = 1

        await conn.execute(
            """
            UPDATE phrases
            SET box = %s,
                next_review_at = now() + make_interval(days => %s),
                last_result = %s,
                reviewed_at = now(),
                reviews = reviews + 1
            WHERE id = %s
            """,
            (box, days, body.result, phrase_id),
        )
        # dibaca ulang lewat join yang sama kayak daftar frasa, biar nama topiknya ikut
        cur = await conn.execute(
            f"SELECT {PHRASE_COLUMNS} FROM phrases p LEFT JOIN topics t ON t.id = p.topic_id WHERE p.id = %s",
            (phrase_id,),
        )
        updated = await cur.fetchone()

        cur = await conn.execute(
            "SELECT count(*)::int AS due FROM phrases WHERE user_id = %s AND next_review_at <= now()",
            (user.id,),
        )
        due = (await cur.fetchone())["due"]
        assert updated is not None
        return ReviewOut(phrase=_phrase(updated), due=due)


@router.post("/phrases", response_model=StateOut, summary="Simpan frasa ke koleksi (dobel diabaikan)")
async def add_phrase(body: PhraseIn, user: User = Depends(current_user)) -> StateOut:
    async with (await db.pool()).connection() as conn:
        await conn.execute(
            """
            INSERT INTO phrases (user_id, en, meaning, topic_id)
            VALUES (%s, %s, %s, (SELECT id FROM topics WHERE id = %s))
            ON CONFLICT (user_id, (lower(en))) DO NOTHING
            """,
            (user.id, clean(body.en, 300), clean(body.id, 300), body.topicId),
        )
        return await _read(conn, user.id)


@router.delete("/phrases/{phrase_id}", response_model=StateOut, summary="Hapus frasa dari koleksi")
async def delete_phrase(phrase_id: int, user: User = Depends(current_user)):
    async with (await db.pool()).connection() as conn:
        cur = await conn.execute("DELETE FROM phrases WHERE id = %s AND user_id = %s", (phrase_id, user.id))
        if cur.rowcount == 0:
            return JSONResponse(status_code=404, content={"error": "Frasa nggak ketemu — mungkin udah dihapus"})
        return await _read(conn, user.id)
