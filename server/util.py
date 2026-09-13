"""Helper kecil dipakai bareng-bareng antar route."""

from __future__ import annotations

import re
import unicodedata

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


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
