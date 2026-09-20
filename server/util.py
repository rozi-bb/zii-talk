"""Helper kecil dipakai bareng-bareng antar route."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from fastapi import Request
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


async def json_body(req: Request) -> dict[str, Any] | None:
    """Body JSON sebagai dict, atau None kalau rusak / bukan objek.

    Dua route (chat & translate) baca body-nya manual, bukan lewat model
    pydantic. Tanpa ini, body yang kepotong di tengah jalan bikin 500 yang
    isinya HTML — padahal frontend nunggu {"error": "..."}."""
    try:
        body = await req.json()
    except Exception:  # noqa: BLE001 — JSON rusak, bukan urusan kita kenapanya
        return None
    return body if isinstance(body, dict) else None


def clean(s: object, max_len: int = 400) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()[:max_len]


def slug(name: str, fallback: str) -> str:
    """Nama -> id yang aman di URL: "Pesan & Beli" -> "pesan-beli"."""
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")[:40].strip("-")
    return s or fallback


def to_messages(history: object) -> list[BaseMessage]:
    """Riwayat obrolan dari client -> BaseMessage, 14 giliran terakhir aja."""
    if not isinstance(history, list):
        return []
    out: list[BaseMessage] = []
    for turn in history[-14:]:
        if not isinstance(turn, dict):
            continue
        text = clean(turn.get("text"), 500)
        role = turn.get("role")
        out.append(AIMessage(text) if role == "ai" else HumanMessage(text))
    return out
