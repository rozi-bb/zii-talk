from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from server.agent.models import chat_model, pick_model, structured
from server.agent.prompts import WORKSHOP_SYSTEM


class TranslateOut(BaseModel):
    formal: str = Field(description="polite version, safe for a client or manager")
    casual: str = Field(description="shorter relaxed version, for a teammate")
    note: str = Field(description="ONE short Indonesian sentence on when to pick which")


class WorkshopState(TypedDict):
    text: str
    topic: str
    model: str
    formal: str
    casual: str
    note: str


async def translate(state: WorkshopState) -> dict:
    said = (state.get("text") or "").strip()
    if not said:
        return {}

    id_ = pick_model(state.get("model"))
    model = structured(chat_model(id_, answer_tokens=300, tags=["workshop"]), TranslateOut, "translate", id_)

    messages: list[BaseMessage] = [SystemMessage(WORKSHOP_SYSTEM)]
    topic = state.get("topic")
    if topic:
        messages.append(SystemMessage(f"Conversation context: {topic}"))
    messages.append(HumanMessage(said))

    out: TranslateOut = await model.ainvoke(messages)
    return {
        "formal": out.formal,
        "casual": out.casual or out.formal,
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
