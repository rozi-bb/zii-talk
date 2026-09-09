import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
  type GraphNode,
} from '@langchain/langgraph';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { chatModel, pickModel, structured } from './models';
import { CHAT_SYSTEM, REVIEW_SYSTEM, contextLine } from './prompts';

export const Correction = z.object({
  wrong: z.string().describe("the learner's exact wrong fragment, verbatim"),
  right: z.string().describe('the corrected fragment'),
  why: z.string().describe('ONE short sentence in Indonesian'),
});

export const Phrase = z.object({
  en: z.string().describe('the reusable English phrase'),
  id: z.string().describe('its natural Indonesian meaning'),
});

const ReviewOut = z.object({
  correction: Correction.nullable().describe('null when nothing is worth correcting'),
  phrase: Phrase.nullable().describe('null when nothing is worth collecting'),
});

export const ConversationState = new StateSchema({
  messages: MessagesValue,
  topic: z.string().default(''),
  situation: z.string().default(''),
  model: z.string().default(''),
  correction: Correction.nullable().default(null),
  phrase: Phrase.nullable().default(null),
});

/* ── balasan Zii. Token-nya di-stream lewat streamMode "messages". ── */
const respond: GraphNode<typeof ConversationState> = async (state) => {
  const id = pickModel(state.model);
  const ctx = contextLine(state.topic, state.situation, state.messages.length === 0);

  const model = chatModel(id, { answerTokens: 220, tags: ['reply'] });
  const res = await model.invoke([
    new SystemMessage(CHAT_SYSTEM),
    ...(ctx ? [new SystemMessage(ctx)] : []),
    ...state.messages,
  ]);

  return { messages: [res] };
};

/* ── koreksi + frasa. Jalan PARALEL sama respond, bukan nunggu.
      Dia cuma butuh kalimat si murid, nggak butuh balasan Zii —
      jadi nggak ada alasan bikin dia nunggu. ── */
const review: GraphNode<typeof ConversationState> = async (state) => {
  const lastHuman = [...state.messages].reverse().find((m) => HumanMessage.isInstance(m));
  if (!lastHuman) return {}; // giliran pembuka: belum ada yang bisa dikoreksi

  const id = pickModel(state.model);
  const model = structured(
    chatModel(id, { answerTokens: 220, tags: ['review'] }),
    ReviewOut,
    'review',
    id,
  );

  try {
    const out = await model.invoke([
      new SystemMessage(REVIEW_SYSTEM),
      ...(state.topic ? [new SystemMessage(`Topic: ${state.topic}`)] : []),
      new HumanMessage(`Learner said: ${lastHuman.text}`),
    ]);
    return { correction: out.correction ?? null, phrase: out.phrase ?? null };
  } catch {
    // koreksi itu bonus — jangan sampai ngerusak obrolan
    return { correction: null, phrase: null };
  }
};

export const graph = new StateGraph(ConversationState)
  .addNode('respond', respond)
  .addNode('review', review)
  .addEdge(START, 'respond')
  .addEdge(START, 'review')
  .addEdge('respond', END)
  .addEdge('review', END)
  .compile();

graph.name = 'conversation';
