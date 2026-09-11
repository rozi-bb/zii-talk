from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import Response

load_dotenv()

from server.agent.models import MODELS, key_for  # noqa: E402  (butuh .env kemuat duluan)
from server.routes import chat, config, speech, translate  # noqa: E402

# ── grouping buat Swagger (/docs) ──────────────────────────────────
TAGS_METADATA = [
    {"name": "Config", "description": "Status server: model apa aja yang siap, Azure Speech, LangSmith tracing."},
    {"name": "Speech", "description": "Token sementara buat Azure Speech SDK (STT & TTS) di browser."},
    {"name": "Chat", "description": "Obrolan sama Zii — streaming NDJSON, respond + review paralel."},
    {"name": "Bengkel Kalimat", "description": "Jeda obrolan, terjemahin Indonesia -> Inggris (formal & casual)."},
]

app = FastAPI(
    title="Zii Talk API",
    description="Backend Zii Talk — latihan ngobrol Inggris pakai suara, ditemenin AI.",
    version="0.1.0",
    openapi_tags=TAGS_METADATA,
)

app.include_router(config.router)
app.include_router(speech.router)
app.include_router(chat.router)
app.include_router(translate.router)

# ── frontend hasil build ────────────────────────────────────────────
DIST = Path(__file__).resolve().parent.parent / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str, request: Request) -> Response:
        if full_path.startswith("api/") or full_path in {"docs", "openapi.json", "redoc"}:
            return Response(status_code=404)
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
    if tracing:
        print(f"  LangSmith     →  tracing ON → project \"{os.environ.get('LANGSMITH_PROJECT', 'default')}\"")
    else:
        print("  LangSmith     →  tracing OFF (set LANGSMITH_TRACING=true + LANGSMITH_API_KEY)")

    bridge_path = Path(__file__).resolve().parent.parent / ".bridge.json"
    try:
        state = json.loads(bridge_path.read_text())
        if str(state.get("target")) == str(port):
            print(f"  Lewat tailnet →  {state.get('url')}")
    except (FileNotFoundError, json.JSONDecodeError):
        pass  # bridge belum nyala
    print("")


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
