import { StateGraph, StateSchema, START, END, type GraphNode } from '@langchain/langgraph';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { chatModel, pickModel, structured } from './models';
import { WORKSHOP_SYSTEM } from './prompts';

const TranslateOut = z.object({
  formal: z.string().describe('polite version, safe for a client or manager'),
  casual: z.string().describe('shorter relaxed version, for a teammate'),
  note: z.string().describe('ONE short Indonesian sentence on when to pick which'),
});

export const WorkshopState = new StateSchema({
  text: z.string().default(''),
  topic: z.string().default(''),
  model: z.string().default(''),
  formal: z.string().default(''),
  casual: z.string().default(''),
  note: z.string().default(''),
});

const translate: GraphNode<typeof WorkshopState> = async (state) => {
  const said = state.text.trim();
  if (!said) return {};

  const id = pickModel(state.model);
  const model = structured(
    chatModel(id, { answerTokens: 300, tags: ['workshop'] }),
    TranslateOut,
    'translate',
    id,
  );

  const out = await model.invoke([
    new SystemMessage(WORKSHOP_SYSTEM),
    ...(state.topic ? [new SystemMessage(`Conversation context: ${state.topic}`)] : []),
    new HumanMessage(said),
  ]);

  return {
    formal: out.formal,
    casual: out.casual || out.formal,
    note: out.note,
  };
};

export const graph = new StateGraph(WorkshopState)
  .addNode('translate', translate)
  .addEdge(START, 'translate')
  .addEdge('translate', END)
  .compile();

graph.name = 'workshop';
