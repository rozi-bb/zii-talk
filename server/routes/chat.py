"""Satu giliran ngobrol.

Graph-nya jalanin `respond` dan `review` PARALEL, dan dua-duanya keluar
lewat SATU stream NDJSON ini:
  {"run": {...}}     sesi ini udah kesimpan sebagai tes (attempt, questions)
  {"warn": "..."}    gagal nyimpen ke database — obrolan tetap jalan
  {"d": "..."}       potongan balasan Zii
  {"review": {...}}  koreksi + frasa, nyusul belakangan

Pencatatan tes-nya (minimal 10 jawaban baru disimpan) ada di server/runlog.py.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from server import db, expressions, runlog
from server.agent.conversation import graph as conversation
from server.agent.models import MODELS, key_for, pick_model
from server.auth import User, current_user
from server.util import clean, to_messages

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/stream", summary="Streaming NDJSON: balasan Zii + koreksi (paralel)")
async def chat_stream(req: Request, user: User = Depends(current_user)):
    body = await req.json()
    model = pick_model(body.get("model"))
    if not key_for(model):
        spec = MODELS[model]
        return JSONResponse(
            status_code=503,
            content={"error": f"{spec.label} belum ada API key-nya. Isi {spec.key_env} di .env"},
        )

    topic_id = clean(body.get("topicId"), 64)
    topic = await db.fetch_one("SELECT name FROM topics WHERE id = %s", (topic_id,))
    if topic is None:
        return JSONResponse(status_code=404, content={"error": "Topiknya nggak ketemu. Muat ulang halamannya."})

    situation = clean(body.get("situation"), 300)
    run_id = runlog.parse_uuid(body.get("runId"))
    turns = runlog.parse_turns(body.get("history"))

    saved: runlog.Saved | None = None
    warn: str | None = None
    if run_id and turns:
        try:
            saved = await runlog.sync(user.id, run_id, topic_id, situation, model, turns)
        except Exception as e:  # noqa: BLE001 — nyimpen itu pencatatan, jangan sampai ngerusak obrolan
            warn = f"Obrolan jalan terus, tapi gagal nyimpen ke database: {e}"

    async def lines() -> AsyncIterator[str]:
        if saved:
            yield json.dumps({"run": saved.dump()}) + "\n"
        if warn:
            yield json.dumps({"warn": warn}) + "\n"

        reply: list[str] = []
        # Tag suara ([laughter]) disaring sebelum kekirim: yang dikarang LLM dibuang,
        # yang kepotong di antara dua token ditahan sampai utuh.
        tags = expressions.TagFilter()
        correction = None
        try:
            async for mode, chunk in conversation.astream(
                {
                    "messages": to_messages(body.get("history")),
                    "topic": topic["name"],
                    "situation": situation,
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
                        piece = tags.push(msg.content)
                        if piece:
                            reply.append(piece)
                            yield json.dumps({"d": piece}) + "\n"

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

            tail = tags.flush()
            if tail:
                reply.append(tail)
                yield json.dumps({"d": tail}) + "\n"

            # balasan yang isinya cuma tag = nggak ada yang bisa dibaca
            said = expressions.strip("".join(reply))
            if not said:
                yield json.dumps({"e": f"{MODELS[model].label} nggak ngasih jawaban. Coba lagi atau ganti model."}) + "\n"
            elif run_id:
                # Cuma kalau stream-nya kelar. Dibatalin di tengah (betulin / keluar)
                # = generator ini di-cancel sebelum sampai sini, balasannya nggak ditulis.
                try:
                    await runlog.save_reply(
                        user.id,
                        run_id,
                        seq=len(turns),
                        text=clean(said, 2000),
                        correction=correction.model_dump() if correction else None,
                    )
                except Exception as e:  # noqa: BLE001
                    yield json.dumps({"warn": f"Balasan Zii gagal disimpan ke database: {e}"}) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except Exception as e:  # noqa: BLE001 — stream harus tetap ditutup rapi
            yield json.dumps({"e": f"Stream putus: {e}"}) + "\n"

    return StreamingResponse(
        lines(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
