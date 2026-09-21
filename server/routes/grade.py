"""Latihan ulang & "Latih dulu": nilai jawaban pakai LLM (makna, grammar, kelaziman)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server.agent.grader import grade
from server.agent.models import MODELS, key_for, pick_model
from server.util import clean, json_body

router = APIRouter(prefix="/api", tags=["Latihan"])


class GradeResult(BaseModel):
    result: Literal["pas", "hampir", "belum"]
    why: str
    better: str | None


@router.post("/grade", response_model=GradeResult, summary="Nilai jawaban latihan berdasarkan makna")
async def grade_endpoint(req: Request):
    body = await json_body(req)
    if body is None:
        return JSONResponse(status_code=400, content={"error": "Data yang dikirim nggak kebaca. Coba lagi."})

    target = clean(body.get("target"), 300)
    answer = clean(body.get("answer"), 500)
    if not target or not answer:
        return JSONResponse(status_code=400, content={"error": "Jawabannya masih kosong"})

    model = pick_model(body.get("model"))
    if not key_for(model):
        spec = MODELS[model]
        return JSONResponse(
            status_code=503,
            content={"error": f"{spec.label} belum ada API key-nya. Isi {spec.key_env} di .env"},
        )

    try:
        out = await grade(model, clean(body.get("meaning"), 500), target, answer)
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=502, content={"error": str(e)})

    better = clean(out.better, 300) if out.result != "pas" else ""
    return GradeResult(result=out.result, why=clean(out.why, 240), better=better or None)
