"""Nilai jawaban latihan berdasarkan makna, grammar, dan kelaziman — bukan sama persis."""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from server.agent.models import ModelId, chat_model, structured
from server.agent.prompts import GRADE_SYSTEM


class GradeOut(BaseModel):
    result: Literal["pas", "hampir", "belum"]
    why: str = Field(description="ONE short Indonesian sentence")
    better: str | None = Field(default=None, description="the learner's own sentence, fixed; null when pas")


async def grade(model_id: ModelId, meaning: str, target: str, answer: str) -> GradeOut:
    model = structured(chat_model(model_id, answer_tokens=200, tags=["grade"]), GradeOut, "grade", model_id)
    parts = [
        f"Indonesian meaning: {meaning}" if meaning else "Indonesian meaning: (not given — use the reference)",
        f"Reference sentence: {target}",
        f"Learner's answer: {answer}",
    ]
    return await model.ainvoke([SystemMessage(GRADE_SYSTEM), HumanMessage("\n".join(parts))])
