"""Metrik kelancaran: seberapa banyak ngomong, dan seberapa sering dikoreksi.

Semuanya dihitung dari sesi yang tersimpan (minimal 10 jawaban) punya akun yang
lagi login — nggak ada kolom baru yang disimpan.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from server import db
from server.auth import User, current_user

router = APIRouter(prefix="/api", tags=["Progres"])

WEEKS = 8  # termasuk minggu ini

# satu sesi + jumlah koreksinya
MINE = """
WITH mine AS (
  SELECT r.id, r.topic_id, r.started_at, r.ended_at, r.question_count,
         (SELECT count(*) FROM messages m WHERE m.run_id = r.id AND m.correction IS NOT NULL) AS corrections
  FROM test_runs r
  WHERE r.user_id = %s
)
"""


class Span(BaseModel):
    sessions: int
    answers: int
    corrections: int
    minutes: int
    perTen: float | None  # koreksi per 10 jawaban; null = belum ada jawaban


class Week(Span):
    start: date  # Senin minggu itu


class ProgressOut(BaseModel):
    weeks: list[Week]  # 8 minggu terakhir, paling lama duluan
    week: Span  # minggu ini
    prevWeek: Span
    activeTopics: int  # topik yang dilatih 7 hari terakhir
    total: Span


def _span(r: dict[str, Any]) -> Span:
    answers = r["answers"]
    return Span(
        sessions=r["sessions"],
        answers=answers,
        corrections=r["corrections"],
        minutes=r["minutes"],
        perTen=round(r["corrections"] * 10 / answers, 1) if answers else None,
    )


EMPTY = {"sessions": 0, "answers": 0, "corrections": 0, "minutes": 0}


@router.get("/progress", response_model=ProgressOut, summary="Metrik kelancaran 8 minggu terakhir")
async def get_progress(user: User = Depends(current_user)) -> ProgressOut:
    rows = await db.fetch_all(
        MINE
        + """
        , weeks AS (
          SELECT generate_series(
            date_trunc('week', now()) - make_interval(weeks => %s),
            date_trunc('week', now()),
            '1 week'
          ) AS start
        )
        SELECT w.start::date                                      AS start,
               count(m.id)::int                                   AS sessions,
               coalesce(sum(m.question_count), 0)::int            AS answers,
               coalesce(sum(m.corrections), 0)::int               AS corrections,
               coalesce(round(sum(extract(epoch FROM m.ended_at - m.started_at)) / 60), 0)::int AS minutes
        FROM weeks w
        LEFT JOIN mine m ON m.started_at >= w.start AND m.started_at < w.start + interval '1 week'
        GROUP BY w.start
        ORDER BY w.start
        """,
        (user.id, WEEKS - 1),
    )
    weeks = [Week(start=r["start"], **_span(r).model_dump()) for r in rows]

    total = await db.fetch_one(
        MINE
        + """
        SELECT count(*)::int                                     AS sessions,
               coalesce(sum(question_count), 0)::int             AS answers,
               coalesce(sum(corrections), 0)::int                AS corrections,
               coalesce(round(sum(extract(epoch FROM ended_at - started_at)) / 60), 0)::int AS minutes
        FROM mine
        """,
        (user.id,),
    )
    active = await db.fetch_one(
        "SELECT count(DISTINCT topic_id)::int AS n FROM test_runs"
        " WHERE user_id = %s AND ended_at >= now() - interval '7 days'",
        (user.id,),
    )

    return ProgressOut(
        weeks=weeks,
        week=weeks[-1] if weeks else _span(EMPTY),
        prevWeek=weeks[-2] if len(weeks) > 1 else _span(EMPTY),
        activeTopics=active["n"] if active else 0,
        total=_span(total or EMPTY),
    )
