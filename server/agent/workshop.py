from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, field_validator

from server.agent.models import chat_model, pick_model, structured
from server.agent.prompts import WORKSHOP_SYSTEM

OPTIONS = 3


class TranslateOut(BaseModel):
    formal: list[str] = Field(description="3 different polite options, safe for a client or manager")
    casual: list[str] = Field(description="3 different relaxed options, for a teammate")
    note: str = Field(description="ONE short Indonesian sentence on when to pick which")

    @field_validator("formal", "casual", mode="before")
    @classmethod
    def _as_list(cls, v: object) -> object:
        # json_mode (DeepSeek) nggak maksa skema: kadang balik satu string, bukan daftar
        return [v] if isinstance(v, str) else v


def _options(xs: list[str]) -> list[str]:
    """Rapihin daftar pilihan: buang kosong & dobel (beda huruf besar doang
    dianggap sama), maksimal OPTIONS. Urutan dari model dipertahankan — yang
    pertama itu yang paling natural."""
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        t = " ".join(str(x).split()).strip().strip('"')
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:OPTIONS]


class WorkshopState(TypedDict):
    text: str
    topic: str
    model: str
    formal: list[str]
    casual: list[str]
    note: str


async def translate(state: WorkshopState) -> dict:
    said = (state.get("text") or "").strip()
    if not said:
        return {}

    id_ = pick_model(state.get("model"))
    # 6 kalimat + catatan: jatah lama (300) buat 2 kalimat bisa kepotong
    model = structured(chat_model(id_, answer_tokens=450, tags=["workshop"]), TranslateOut, "translate", id_)

    messages: list[BaseMessage] = [SystemMessage(WORKSHOP_SYSTEM)]
    topic = state.get("topic")
    if topic:
        messages.append(SystemMessage(f"Conversation context: {topic}"))
    messages.append(HumanMessage(said))

    out: TranslateOut = await model.ainvoke(messages)
    formal = _options(out.formal)
    return {
        "formal": formal,
        "casual": _options(out.casual) or formal,
        "note": out.note,
    }


graph = (
    StateGraph(WorkshopState)
    .add_node("translate", translate)
    .add_edge(START, "translate")
    .add_edge("translate", END)
    .compile()
)
graph.name = "workshop"
