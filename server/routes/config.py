"""Status server: model apa aja yang siap, Azure Speech, dan LangSmith tracing."""

from __future__ import annotations

import os

from fastapi import APIRouter
from pydantic import BaseModel

from server.agent.models import MODELS, key_for
from server.runlog import MIN_ANSWERS
from server.voices import VOICES, Gender

router = APIRouter(prefix="/api", tags=["Config"])


def _speech_key() -> str:
    return (os.environ.get("AZURE_SPEECH_KEY") or "").strip()


def _speech_region() -> str:
    return (os.environ.get("AZURE_SPEECH_REGION") or "").strip()


class ModelInfo(BaseModel):
    id: str
    label: str
    hint: str
    ready: bool
    keyEnv: str


class VoiceInfo(BaseModel):
    id: str
    name: str
    gender: Gender
    hint: str


class SpeechInfo(BaseModel):
    ready: bool
    region: str | None
    voices: list[VoiceInfo]  # yang bisa dipilih; yang lagi dipakai ada di /api/state


class TracingInfo(BaseModel):
    on: bool
    project: str


class AppConfig(BaseModel):
    models: list[ModelInfo]
    speech: SpeechInfo
    tracing: TracingInfo
    minAnswers: int  # jawaban minimal biar satu sesi kesimpan sebagai tes


@router.get("/config", response_model=AppConfig, summary="Status model, speech, dan tracing")
def get_config() -> AppConfig:
    return AppConfig(
        models=[
            ModelInfo(
                id=id_,
                label=spec.label,
                hint=spec.hint,
                ready=bool(key_for(id_)),
                keyEnv=spec.key_env,
            )
            for id_, spec in MODELS.items()
        ],
        speech=SpeechInfo(
            ready=bool(_speech_key() and _speech_region()),
            region=_speech_region() or None,
            voices=[VoiceInfo(id=id_, name=v.name, gender=v.gender, hint=v.hint) for id_, v in VOICES.items()],
        ),
        tracing=TracingInfo(
            on=(os.environ.get("LANGSMITH_TRACING") or "").lower() == "true",
            project=os.environ.get("LANGSMITH_PROJECT") or "default",
        ),
        minAnswers=MIN_ANSWERS,
    )
