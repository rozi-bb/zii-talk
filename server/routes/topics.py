"""Daftar topik (plus statistik tes-nya) dan tambah topik baru."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from server import db
from server.auth import User, current_user
from server.util import clean, slug

router = APIRouter(prefix="/api/topics", tags=["Topik"])

HEX = r"^#[0-9A-Fa-f]{6}$"

# Topiknya masih dipakai bareng semua akun; statistik tesnya punya akun yang
# lagi login aja. Parameter pertama = user_id.
SELECT = """
SELECT t.id, t.name, t.category_id, t.icon, t.tint, t.ink, t.blurb, t.situations,
       s.tests, s.questions, s.last_tested_at
FROM topics t
CROSS JOIN LATERAL (
  SELECT count(*)::int                             AS tests,
         coalesce(sum(r.question_count), 0)::int   AS questions,
         max(r.ended_at)                           AS last_tested_at
  FROM test_runs r
  WHERE r.topic_id = t.id AND r.user_id = %s
) s
"""


class TopicOut(BaseModel):
    id: str
    name: str
    categoryId: str
    icon: str
    tint: str
    ink: str
    blurb: str
    situations: list[str]
    tests: int
    questions: int
    lastTestedAt: datetime | None


class TopicIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    categoryId: str = Field(min_length=1, max_length=48)
    blurb: str = Field(default="", max_length=160)
    situations: list[str] = Field(min_length=1, max_length=5)
    icon: str = Field(pattern=r"^[a-zA-Z]{1,24}$")
    tint: str = Field(pattern=HEX)
    ink: str = Field(pattern=HEX)

    @field_validator("name", "blurb")
    @classmethod
    def _tidy(cls, v: str) -> str:
        return clean(v, 160)

    @field_validator("situations")
    @classmethod
    def _situations(cls, v: list[str]) -> list[str]:
        # 300 = batas yang dipotong route chat waktu dikirim ke Zii
        out = [s for s in (clean(x, 300) for x in v) if s]
        if not out:
            raise ValueError("Isi minimal satu skenario")
        return out


def _out(r: dict[str, Any]) -> TopicOut:
    return TopicOut(
        id=r["id"],
        name=r["name"],
        categoryId=r["category_id"],
        icon=r["icon"],
        tint=r["tint"],
        ink=r["ink"],
        blurb=r["blurb"],
        situations=r["situations"],
        tests=r["tests"],
        questions=r["questions"],
        lastTestedAt=r["last_tested_at"],
    )


@router.get("", response_model=list[TopicOut], summary="Semua topik + jumlah tes & jawaban")
async def list_topics(user: User = Depends(current_user)) -> list[TopicOut]:
    rows = await db.fetch_all(SELECT + " ORDER BY t.sort_order, t.created_at", (user.id,))
    return [_out(r) for r in rows]


@router.post("", response_model=TopicOut, status_code=201, summary="Tambah topik baru")
async def create_topic(body: TopicIn, user: User = Depends(current_user)):
    base = slug(body.name, "topik")
    async with (await db.pool()).connection() as conn, conn.transaction():
        cur = await conn.execute("SELECT 1 FROM categories WHERE id = %s", (body.categoryId,))
        if await cur.fetchone() is None:
            return JSONResponse(status_code=400, content={"error": "Kategorinya nggak ketemu. Muat ulang halamannya."})

        # serialisasi tambah-topik, biar slug & sort_order nggak rebutan
        await conn.execute("LOCK TABLE topics IN SHARE ROW EXCLUSIVE MODE")
        cur = await conn.execute("SELECT id FROM topics WHERE id = %s OR id LIKE %s", (base, base + "-%"))
        taken = {r["id"] for r in await cur.fetchall()}
        id_, n = base, 2
        while id_ in taken:
            id_, n = f"{base}-{n}", n + 1

        await conn.execute(
            """
            INSERT INTO topics (id, name, category_id, icon, tint, ink, blurb, situations, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                    (SELECT coalesce(max(sort_order), 0) + 1 FROM topics))
            """,
            (id_, body.name, body.categoryId, body.icon, body.tint, body.ink, body.blurb, body.situations),
        )
        cur = await conn.execute(SELECT + " WHERE t.id = %s", (user.id, id_))
        row = await cur.fetchone()
    assert row is not None
    return _out(row)
