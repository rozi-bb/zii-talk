"""Kategori topik: daftar (plus jumlah topiknya) dan tambah kategori baru."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from server import db
from server.util import clean, slug

router = APIRouter(prefix="/api/categories", tags=["Kategori"])

SELECT = """
SELECT c.id, c.name, count(t.id)::int AS topics
FROM categories c
LEFT JOIN topics t ON t.category_id = c.id
"""


class CategoryOut(BaseModel):
    id: str
    name: str
    topics: int  # jumlah topik di kategori ini


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)

    @field_validator("name")
    @classmethod
    def _tidy(cls, v: str) -> str:
        v = clean(v, 40)
        if not v:
            raise ValueError("Nama kategori nggak boleh kosong")
        return v


@router.get("", response_model=list[CategoryOut], summary="Semua kategori + jumlah topiknya")
async def list_categories() -> list[CategoryOut]:
    rows = await db.fetch_all(SELECT + " GROUP BY c.id ORDER BY c.sort_order, c.created_at")
    return [CategoryOut(**r) for r in rows]


@router.post("", response_model=CategoryOut, status_code=201, summary="Tambah kategori baru")
async def create_category(body: CategoryIn):
    base = slug(body.name, "kategori")
    async with (await db.pool()).connection() as conn, conn.transaction():
        # serialisasi, biar dua tab yang nambah barengan nggak rebutan slug / sort_order
        await conn.execute("LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE")
        cur = await conn.execute("SELECT name FROM categories WHERE lower(name) = lower(%s)", (body.name,))
        dup = await cur.fetchone()
        if dup:
            return JSONResponse(status_code=409, content={"error": f"Kategori “{dup['name']}” udah ada"})

        cur = await conn.execute("SELECT id FROM categories WHERE id = %s OR id LIKE %s", (base, base + "-%"))
        taken = {r["id"] for r in await cur.fetchall()}
        id_, n = base, 2
        while id_ in taken:
            id_, n = f"{base}-{n}", n + 1

        await conn.execute(
            """
            INSERT INTO categories (id, name, sort_order)
            VALUES (%s, %s, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories))
            """,
            (id_, body.name),
        )
    return CategoryOut(id=id_, name=body.name, topics=0)
