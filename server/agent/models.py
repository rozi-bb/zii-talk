"""
Daftar model. Sengaja cuma yang cepat & ringan.
DeepSeek OpenAI-compatible, jadi dua-duanya pakai ChatOpenAI
— bedanya cuma base_url. (Nggak ada ChatDeepSeek resmi di Python juga,
tapi ChatOpenAI cukup karena DeepSeek nurutin format API OpenAI.)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Type, TypeVar

from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import BaseModel

ModelId = Literal["gpt-5.6-luna", "deepseek-v4-flash"]

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class Spec:
    label: str
    hint: str
    key_env: str
    base_url: str | None = None
    temperature: float | None = None
    # Token buat "mikir" sebelum nulis jawaban. V4 Flash itu model
    # penalaran: kalau budget-nya pas-pasan, jawabannya balik KOSONG.
    reason_budget: int = 0
    # Cara maksa output terstruktur. DeepSeek NOLAK response_format
    # json_schema ("This response_format type is unavailable now"), DAN
    # mode thinking-nya nolak tool_choice yang dipaksa. Sisanya
    # json_mode — yang butuh bentuk JSON-nya ditulis di prompt.
    structured: Literal["json_schema", "json_mode"] = "json_schema"


MODELS: dict[ModelId, Spec] = {
    "gpt-5.6-luna": Spec(
        label="GPT-5.6 Luna",
        hint="Paling responsif — disaranin",
        key_env="OPENAI_API_KEY",
        reason_budget=0,
        structured="json_schema",
    ),
    "deepseek-v4-flash": Spec(
        label="DeepSeek V4 Flash",
        hint="Paling murah, tapi mikir dulu",
        key_env="DEEPSEEK_API_KEY",
        base_url="https://api.deepseek.com",
        temperature=0.7,
        reason_budget=900,
        structured="json_mode",
    ),
}


def is_model_id(v: object) -> bool:
    return isinstance(v, str) and v in MODELS


def key_for(id_: ModelId) -> str:
    return (os.environ.get(MODELS[id_].key_env) or "").strip()


def pick_model(v: object) -> ModelId:
    if is_model_id(v):
        return v  # type: ignore[return-value]
    for id_ in MODELS:
        if key_for(id_):
            return id_
    return "gpt-5.6-luna"


def chat_model(id_: ModelId, *, answer_tokens: int = 220, tags: list[str] | None = None) -> ChatOpenAI:
    """Bikin chat model. `answer_tokens` = jatah buat jawaban, jatah mikir ditambahin sendiri."""
    m = MODELS[id_]
    key = key_for(id_)
    if not key:
        raise RuntimeError(f"{m.label} belum ada API key-nya. Isi {m.key_env} di .env")

    kwargs: dict = {
        "model": id_,
        "api_key": key,
        "max_tokens": answer_tokens + m.reason_budget,
    }
    if m.temperature is not None:
        kwargs["temperature"] = m.temperature
    if tags:
        kwargs["tags"] = tags
    if m.base_url:
        kwargs["base_url"] = m.base_url

    return ChatOpenAI(**kwargs)


def structured(model: BaseChatModel, schema: Type[T], name: str, id_: ModelId):
    """Output terstruktur, pakai cara yang didukung provider-nya."""
    method = MODELS[id_].structured
    return model.with_structured_output(schema, method=method)
