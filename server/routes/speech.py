"""Token sementara buat Azure Speech (10 menit, aman dikirim ke browser)."""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/speech", tags=["Speech"])


def _speech_key() -> str:
    return (os.environ.get("AZURE_SPEECH_KEY") or "").strip()


def _speech_region() -> str:
    return (os.environ.get("AZURE_SPEECH_REGION") or "").strip()


class TokenOut(BaseModel):
    token: str
    region: str


@router.get("/token", response_model=TokenOut, summary="Mint token Azure Speech (STT/TTS)")
async def get_token():
    key, region = _speech_key(), _speech_region()
    if not key or not region:
        return JSONResponse(
            status_code=503,
            content={"error": "Azure Speech belum diisi. Set AZURE_SPEECH_KEY & AZURE_SPEECH_REGION di .env"},
        )

    url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, headers={"Ocp-Apim-Subscription-Key": key, "Content-Length": "0"})
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"error": f"Nggak bisa nyambung ke Azure: {e}"})

    if r.status_code >= 400:
        return JSONResponse(
            status_code=r.status_code,
            content={"error": f"Azure nolak key-nya ({r.status_code}). Cek key & region."},
        )
    return TokenOut(token=r.text, region=region)
