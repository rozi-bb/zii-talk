"""Riwayat tes: daftar sesi per topik, transkrip satu sesi, dan rewind buat "betulin"."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from server import db, runlog

router = APIRouter(prefix="/api", tags=["Riwayat Tes"])

COLUMNS = "id, topic_id, attempt_no, situation, model, question_count, started_at, ended_at"


class Correction(BaseModel):
    wrong: str
    right: str
    why: str


class RunOut(BaseModel):
    id: str
    topicId: str
    attempt: int
    situation: str
    model: str
    questions: int
    startedAt: datetime
    endedAt: datetime


class MessageOut(BaseModel):
    role: Literal["ai", "me"]
    text: str
    correction: Correction | None
    at: datetime


class RunDetail(RunOut):
    messages: list[MessageOut]


class SavedOut(BaseModel):
    attempt: int
    questions: int


class RewindIn(BaseModel):
    keep: int = Field(ge=0, description="jumlah baris transkrip yang dipertahankan")


class RewindOut(BaseModel):
    saved: SavedOut | None


def _run(r: dict[str, Any]) -> dict[str, Any]:
    return dict(
        id=str(r["id"]),
        topicId=r["topic_id"],
        attempt=r["attempt_no"],
        situation=r["situation"],
        model=r["model"],
        questions=r["question_count"],
        startedAt=r["started_at"],
        endedAt=r["ended_at"],
    )


def _not_found(what: str) -> JSONResponse:
    return JSONResponse(status_code=404, content={"error": f"{what} nggak ketemu"})


@router.get(
    "/topics/{topic_id}/runs",
    response_model=list[RunOut],
    summary="Semua sesi tes satu topik, terbaru dulu",
)
async def list_runs(topic_id: str):
    if await db.fetch_one("SELECT 1 FROM topics WHERE id = %s", (topic_id,)) is None:
        return _not_found("Topik")
    rows = await db.fetch_all(
        f"SELECT {COLUMNS} FROM test_runs WHERE topic_id = %s ORDER BY attempt_no DESC", (topic_id,)
    )
    return [RunOut(**_run(r)) for r in rows]


@router.get("/runs/{run_id}", response_model=RunDetail, summary="Satu sesi tes lengkap dengan transkripnya")
async def get_run(run_id: str):
    id_ = runlog.parse_uuid(run_id)
    row = id_ and await db.fetch_one(f"SELECT {COLUMNS} FROM test_runs WHERE id = %s", (id_,))
    if not row:
        return _not_found("Sesi tes")
    msgs = await db.fetch_all(
        "SELECT role, text, correction, created_at FROM messages WHERE run_id = %s ORDER BY seq", (id_,)
    )
    return RunDetail(
        **_run(row),
        messages=[
            MessageOut(role=m["role"], text=m["text"], correction=m["correction"], at=m["created_at"]) for m in msgs
        ],
    )


@router.post(
    "/runs/{run_id}/rewind",
    response_model=RewindOut,
    summary="Buang transkrip mulai baris ke-`keep` (dipakai fitur betulin)",
)
async def rewind_run(run_id: str, body: RewindIn) -> RewindOut:
    id_ = runlog.parse_uuid(run_id)
    saved = await runlog.rewind(id_, body.keep) if id_ else None
    return RewindOut(saved=SavedOut(**saved.dump()) if saved else None)
