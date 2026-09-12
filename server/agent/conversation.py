from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field

from server.agent.models import chat_model, pick_model, structured
from server.agent.prompts import CHAT_SYSTEM, REVIEW_SYSTEM, context_line


class Correction(BaseModel):
    wrong: str = Field(description="the learner's exact wrong fragment, verbatim")
    right: str = Field(description="the corrected fragment")
    why: str = Field(description="ONE short sentence in Indonesian")


class Phrase(BaseModel):
    en: str = Field(description="the reusable English phrase")
    id: str = Field(description="its natural Indonesian meaning")


class ReviewOut(BaseModel):
    correction: Correction | None = Field(default=None, description="null when nothing is worth correcting")
    phrase: Phrase | None = Field(default=None, description="null when nothing is worth collecting")


class ConversationState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    topic: str
    situation: str
    model: str
    correction: Correction | None
    phrase: Phrase | None


# ── balasan Zii. Token-nya di-stream lewat stream_mode "messages". ──
async def respond(state: ConversationState) -> dict:
    id_ = pick_model(state.get("model"))
    ctx = context_line(state.get("topic", ""), state.get("situation", ""), len(state["messages"]) == 0)

    model = chat_model(id_, answer_tokens=220, tags=["reply"])
    messages: list[BaseMessage] = [SystemMessage(CHAT_SYSTEM)]
    if ctx:
        messages.append(SystemMessage(ctx))
    messages += state["messages"]

    res = await model.ainvoke(messages)
    return {"messages": [res]}


# ── koreksi + frasa. Jalan PARALEL sama respond, bukan nunggu.
#    Dia cuma butuh kalimat si murid, nggak butuh balasan Zii —
#    jadi nggak ada alasan bikin dia nunggu. ──
async def review(state: ConversationState) -> dict:
    last_human = next((m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None)
    if last_human is None:
        return {}  # giliran pembuka: belum ada yang bisa dikoreksi

    id_ = pick_model(state.get("model"))
    model = structured(chat_model(id_, answer_tokens=220, tags=["review"]), ReviewOut, "review", id_)

    try:
        messages: list[BaseMessage] = [SystemMessage(REVIEW_SYSTEM)]
        topic = state.get("topic")
        if topic:
            messages.append(SystemMessage(f"Topic: {topic}"))
        messages.append(HumanMessage(f"Learner said: {last_human.content}"))

        out: ReviewOut = await model.ainvoke(messages)
        # Jaminan di kode, bukan cuma di prompt: kartu Tangkap frasa di UI
        # cuma nempel ke kartu koreksi. Kalau nggak ada correction, phrase
        # nggak akan pernah kelihatan/bisa ditangkep — jadi buang aja di sini,
        # daripada percaya model selalu nurut instruksi di REVIEW_SYSTEM.
        phrase = out.phrase if out.correction else None
        return {"correction": out.correction, "phrase": phrase}
    except Exception:
        # koreksi itu bonus — jangan sampai ngerusak obrolan
        return {"correction": None, "phrase": None}


graph = (
    StateGraph(ConversationState)
    .add_node("respond", respond)
    .add_node("review", review)
    .add_edge(START, "respond")
    .add_edge(START, "review")
    .add_edge("respond", END)
    .add_edge("review", END)
    .compile()
)
graph.name = "conversation"
