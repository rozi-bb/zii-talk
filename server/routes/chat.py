"""Satu giliran ngobrol.

Graph-nya jalanin `respond` dan `review` PARALEL, dan dua-duanya keluar
lewat SATU stream NDJSON ini:
  {"d": "..."}       potongan balasan Zii
  {"review": {...}}  koreksi + frasa, nyusul belakangan
"""

from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from server.agent.conversation import graph as conversation
from server.agent.models import MODELS, key_for, pick_model
from server.util import clean, to_messages

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/stream", summary="Streaming NDJSON: balasan Zii + koreksi (paralel)")
async def chat_stream(req: Request):
    body = await req.json()
    model = pick_model(body.get("model"))
    if not key_for(model):
        spec = MODELS[model]
        return JSONResponse(
            status_code=503,
            content={"error": f"{spec.label} belum ada API key-nya. Isi {spec.key_env} di .env"},
        )

    async def lines() -> AsyncIterator[str]:
        got = 0
        try:
            async for mode, chunk in conversation.astream(
                {
                    "messages": to_messages(body.get("history")),
                    "topic": clean(body.get("topic"), 80),
                    "situation": clean(body.get("situation"), 300),
                    "model": model,
                    "correction": None,
                    "phrase": None,
                },
                stream_mode=["messages", "updates"],
            ):
                if mode == "messages":
                    msg, meta = chunk
                    # HANYA token dari node `respond`. Node `review` juga manggil
                    # LLM, dan buat DeepSeek itu termasuk monolog "thinking" —
                    # jangan sampai kekirim ke user (atau keucap sama TTS).
                    if meta.get("langgraph_node") == "respond" and msg.content:
                        got += len(msg.content)
                        yield json.dumps({"d": msg.content}) + "\n"

                if mode == "updates":
                    upd = chunk.get("review")
                    if upd and (upd.get("correction") or upd.get("phrase")):
                        correction = upd.get("correction")
                        phrase = upd.get("phrase")
                        yield json.dumps(
                            {
                                "review": {
                                    "correction": correction.model_dump() if correction else None,
                                    "phrase": phrase.model_dump() if phrase else None,
                                }
                            }
                        ) + "\n"

            if not got:
                yield json.dumps({"e": f"{MODELS[model].label} nggak ngasih jawaban. Coba lagi atau ganti model."}) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except Exception as e:  # noqa: BLE001 — stream harus tetap ditutup rapi
            yield json.dumps({"e": f"Stream putus: {e}"}) + "\n"

    return StreamingResponse(
        lines(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
