"""Status server: model apa aja yang siap, Azure Speech, dan LangSmith tracing."""

from __future__ import annotations

import os

from fastapi import APIRouter
from pydantic import BaseModel

from server.agent.models import MODELS, key_for

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


class SpeechInfo(BaseModel):
    ready: bool
    region: str | None
    voice: str


class TracingInfo(BaseModel):
    on: bool
    project: str


class AppConfig(BaseModel):
    models: list[ModelInfo]
    speech: SpeechInfo
    tracing: TracingInfo


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
            voice=(os.environ.get("AZURE_TTS_VOICE") or "en-US-AriaNeural").strip(),
        ),
        tracing=TracingInfo(
            on=(os.environ.get("LANGSMITH_TRACING") or "").lower() == "true",
            project=os.environ.get("LANGSMITH_PROJECT") or "default",
        ),
    )
