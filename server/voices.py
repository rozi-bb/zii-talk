"""
Suara Zii: HD voice Azure (DragonHD) beraksen Amerika yang statusnya GA.

Daftarnya ditulis tangan dari daftar voice region `southeastasia`
(GET /cognitiveservices/voices/list, dicek September 2026). Jangan
nebak dari dokumentasi: `en-US-Emma2` misalnya ada di docs tapi nggak
ada di daftar region. Nama yang nggak dikenal ditolak Azure dengan
"Unsupported voice", jadi yang disimpan harus lolos `is_voice_id` dulu.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

Gender = Literal["female", "male"]


@dataclass(frozen=True)
class Voice:
    name: str
    gender: Gender
    # Dari TailoredScenarios-nya Azure. Kosong kalau Azure nggak ngasih
    # — sengaja nggak dikarang-karang.
    hint: str = ""


def _hd(name: str) -> str:
    return f"en-US-{name}:DragonHDLatestNeural"


VOICES: dict[str, Voice] = {
    _hd(v.name): v
    for v in (
        # perempuan
        Voice("Aria", "female", "ekspresif"),
        Voice("Ava", "female", "jernih"),
        Voice("Bree", "female", "gaya podcast"),
        Voice("Emma", "female", "buat belajar"),
        Voice("Evelyn", "female"),
        Voice("Jane", "female"),
        Voice("Jenny", "female", "gaya asisten"),
        Voice("Mila", "female"),
        Voice("Nova", "female"),
        Voice("Phoebe", "female"),
        Voice("Serena", "female"),
        Voice("Tessa", "female"),
        Voice("Tiana", "female"),
        # laki-laki
        Voice("Adam", "male"),
        Voice("Alloy", "male"),
        Voice("Andrew", "male", "ekspresif"),
        Voice("Brian", "male", "gaya podcast"),
        Voice("Davis", "male", "tenang"),
        Voice("Jimmie", "male"),
        Voice("Juno", "male"),
        Voice("Steffan", "male", "gaya narator"),
        Voice("Tyler", "male"),
        Voice("Vance", "male"),
    )
}

DEFAULT_VOICE = _hd("Emma")


def is_voice_id(v: object) -> bool:
    return isinstance(v, str) and v in VOICES


def env_voice() -> str:
    return (os.environ.get("AZURE_TTS_VOICE") or "").strip()


def default_voice() -> str:
    """Suara buat yang belum pernah milih: AZURE_TTS_VOICE kalau valid, selain itu Emma."""
    env = env_voice()
    return env if is_voice_id(env) else DEFAULT_VOICE


def pick_voice(v: object) -> str:
    return v if is_voice_id(v) else default_voice()  # type: ignore[return-value]
