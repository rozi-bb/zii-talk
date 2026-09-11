"""Bengkel Kalimat — Indonesia -> Inggris (formal + casual), sekali jalan."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from server.agent.models import MODELS, key_for, pick_model
from server.agent.workshop import graph as workshop
from server.util import clean

router = APIRouter(prefix="/api", tags=["Bengkel Kalimat"])


class TranslateOut(BaseModel):
    formal: str
    casual: str
    note: str


@router.post("/translate", response_model=TranslateOut, summary="Terjemah Indonesia -> Inggris, formal & casual")
async def translate_endpoint(req: Request):
    body = await req.json()
    said = clean(body.get("text"), 500)
    if not said:
        return JSONResponse(status_code=400, content={"error": "Belum ada yang mau diterjemahin"})

    model = pick_model(body.get("model"))
    if not key_for(model):
        spec = MODELS[model]
        return JSONResponse(
            status_code=503,
            content={"error": f"{spec.label} belum ada API key-nya. Isi {spec.key_env} di .env"},
        )

    try:
        out = await workshop.ainvoke({"text": said, "topic": clean(body.get("topic"), 120), "model": model})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=502, content={"error": str(e)})

    formal = clean(out.get("formal"), 240)
    return TranslateOut(
        formal=formal,
        casual=clean(out.get("casual"), 240) or formal,
        note=clean(out.get("note"), 200),
    )
