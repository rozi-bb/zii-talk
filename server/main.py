from __future__ import annotations

import json
import os
import traceback
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import Response

load_dotenv()

from server import auth, db  # noqa: E402
from server.agent.models import MODELS, key_for  # noqa: E402  (butuh .env kemuat duluan)
from server.routes import auth as auth_routes  # noqa: E402
from server.routes import categories, chat, config, progress, runs, speech, state, topics, translate  # noqa: E402
from server.voices import DEFAULT_VOICE, env_voice, is_voice_id  # noqa: E402

# ── grouping buat Swagger (/docs) ──────────────────────────────────
TAGS_METADATA = [
    {"name": "Akun", "description": "Daftar, masuk, keluar. Semua endpoint lain wajib login (cookie sesi)."},
    {"name": "Config", "description": "Status server: model apa aja yang siap, Azure Speech, LangSmith tracing."},
    {"name": "Speech", "description": "Token sementara buat Azure Speech SDK (STT & TTS) di browser."},
    {"name": "Chat", "description": "Obrolan sama Zii — streaming NDJSON, respond + review paralel."},
    {"name": "Bengkel Kalimat", "description": "Jeda obrolan, terjemahin Indonesia -> Inggris (formal & casual)."},
    {"name": "Topik", "description": "Daftar topik + statistik tes, dan tambah topik baru."},
    {"name": "Kategori", "description": "Kategori topik: daftar dan tambah kategori baru."},
    {"name": "Riwayat Tes", "description": "Sesi tes per topik (minimal 10 jawaban) lengkap dengan transkripnya."},
    {"name": "State", "description": "Model & suara pilihan, momentum, dan koleksi frasa."},
    {"name": "Progres", "description": "Metrik kelancaran: menit ngomong & koreksi per 10 jawaban."},
]

app = FastAPI(
    title="Zii Talk API",
    description="Backend Zii Talk — latihan ngobrol Inggris pakai suara, ditemenin AI.",
    version="0.1.0",
    openapi_tags=TAGS_METADATA,
)

app.include_router(auth_routes.router)

# Selain /api/auth/*, semuanya wajib login — dipasang di sini biar router baru
# otomatis ikut kekunci. Route yang butuh id akunnya minta `current_user` lagi;
# FastAPI nge-cache dependency per request, jadi sesi cuma dicek sekali.
LOGGED_IN = [Depends(auth.current_user)]
for r in (config, speech, chat, translate, topics, categories, runs, state, progress):
    app.include_router(r.router, dependencies=LOGGED_IN)


# Semua error dibalikin sebagai {"error": "..."} — itu yang dibaca frontend.
@app.exception_handler(auth.NotLoggedIn)
async def on_not_logged_in(_: Request, __: auth.NotLoggedIn) -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "Sesi login habis. Masuk lagi ya."})


@app.exception_handler(db.DatabaseDown)
async def on_db_down(_: Request, e: db.DatabaseDown) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": str(e)})


@app.exception_handler(psycopg.OperationalError)
async def on_db_lost(_: Request, e: psycopg.OperationalError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": f"Koneksi ke Postgres putus: {e}"})


@app.exception_handler(RequestValidationError)
async def on_invalid(_: Request, e: RequestValidationError) -> JSONResponse:
    first = e.errors()[0] if e.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    msg = first.get("msg", "Data nggak valid").removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"error": f"{field}: {msg}" if field else msg})


# Jaring terakhir: error yang nggak kepikiran pun tetap keluar sebagai
# {"error": "..."} — dulu jadi 500 berisi HTML, dan di layar cuma kebaca
# "Gagal (500)". Detail lengkapnya tetap ke log server.
@app.exception_handler(Exception)
async def on_crash(_: Request, e: Exception) -> JSONResponse:
    traceback.print_exception(e)
    return JSONResponse(
        status_code=500,
        content={"error": f"Ada yang error di server ({type(e).__name__}). Cek log-nya buat detail."},
    )

# ── frontend hasil build ────────────────────────────────────────────
DIST = Path(__file__).resolve().parent.parent / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str, request: Request) -> Response:
        if full_path.startswith("api/") or full_path in {"docs", "openapi.json", "redoc"}:
            return Response(status_code=404)
        # file dari public/ (favicon, dst.) ikut ke root dist — jangan dijawab index.html
        file = (DIST / full_path).resolve()
        if full_path and file.is_file() and file.is_relative_to(DIST):
            return FileResponse(file)
        index = DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        return Response('Jalanin "npm run build" dulu, atau pakai "npm run dev".', status_code=404)


@app.on_event("startup")
async def on_startup() -> None:
    port = os.environ.get("PORT", "8787")
    host = os.environ.get("HOST", "127.0.0.1")
    llm = [id_ for id_ in MODELS if key_for(id_)]
    speech_key = (os.environ.get("AZURE_SPEECH_KEY") or "").strip()
    speech_region = (os.environ.get("AZURE_SPEECH_REGION") or "").strip()
    tracing = (os.environ.get("LANGSMITH_TRACING") or "").lower() == "true"

    print(f"\n  Zii Talk API  →  http://{host}:{port}")
    print(f"  LLM siap      →  {', '.join(llm) if llm else 'BELUM ADA (isi .env)'}")
    print(f"  Azure Speech  →  {speech_region if speech_key and speech_region else 'BELUM ADA (isi .env)'}")
    if env_voice() and not is_voice_id(env_voice()):
        print(f"  Suara default →  AZURE_TTS_VOICE={env_voice()} nggak ada di server/voices.py, pakai {DEFAULT_VOICE}")
    if tracing:
        print(f"  LangSmith     →  tracing ON → project \"{os.environ.get('LANGSMITH_PROJECT', 'default')}\"")
    else:
        print("  LangSmith     →  tracing OFF (set LANGSMITH_TRACING=true + LANGSMITH_API_KEY)")

    try:
        await db.pool()
        print(f"  Postgres      →  {db.where()}")
    except db.DatabaseDown:
        print(f"  Postgres      →  GAGAL nyambung ke {db.where()} (npm run db:up)")

    bridge_path = Path(__file__).resolve().parent.parent / ".bridge.json"
    try:
        state = json.loads(bridge_path.read_text())
        if str(state.get("target")) == str(port):
            print(f"  Lewat tailnet →  {state.get('url')}")
    except (FileNotFoundError, json.JSONDecodeError):
        pass  # bridge belum nyala
    print("")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await db.close()


if __name__ == "__main__":
    # Jalan lewat `python -m server.main` (dipakai npm run dev/start) biar HOST & PORT
    # dari .env beneran kepakai. `uvicorn server.main:app` langsung nggak baca .env
    # buat host/port — dulu HOST=0.0.0.0 cuma ngubah banner, servernya tetap 127.0.0.1.
    import sys

    import uvicorn

    uvicorn.run(
        "server.main:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8787")),
        reload="--reload" in sys.argv,
    )
