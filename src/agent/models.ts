import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { z } from 'zod';

/* ────────────────────────────────────────────────────────────
   Daftar model. Sengaja cuma yang cepat & ringan.
   DeepSeek OpenAI-compatible, jadi dua-duanya pakai ChatOpenAI
   — bedanya cuma baseURL. (Nggak ada ChatDeepSeek buat JS.)
   ──────────────────────────────────────────────────────────── */
export type ModelId = 'gpt-5.6-luna' | 'deepseek-v4-flash';

type Spec = {
  label: string;
  hint: string;
  keyEnv: string;
  baseURL?: string;
  temperature?: number;
  /** Token buat "mikir" sebelum nulis jawaban. V4 Flash itu model
      penalaran: kalau budget-nya pas-pasan, jawabannya balik KOSONG. */
  reasonBudget: number;
  /** Cara maksa output terstruktur. DeepSeek NOLAK response_format
      json_schema ("This response_format type is unavailable now"), DAN
      mode thinking-nya nolak tool_choice yang dipaksa. Sisanya
      json_object — yang butuh bentuk JSON-nya ditulis di prompt. */
  structured: 'jsonSchema' | 'jsonMode';
};

export const MODELS: Record<ModelId, Spec> = {
  'gpt-5.6-luna': {
    label: 'GPT-5.6 Luna',
    hint: 'Paling responsif — disaranin',
    keyEnv: 'OPENAI_API_KEY',
    reasonBudget: 0,
    structured: 'jsonSchema',
  },
  'deepseek-v4-flash': {
    label: 'DeepSeek V4 Flash',
    hint: 'Paling murah, tapi mikir dulu',
    keyEnv: 'DEEPSEEK_API_KEY',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.7,
    reasonBudget: 900,
    structured: 'jsonMode',
  },
};

export const isModelId = (v: unknown): v is ModelId =>
  typeof v === 'string' && v in MODELS;

export const keyFor = (id: ModelId) => (process.env[MODELS[id].keyEnv] ?? '').trim();

export function pickModel(v: unknown): ModelId {
  if (isModelId(v)) return v;
  const ready = (Object.keys(MODELS) as ModelId[]).find((id) => keyFor(id));
  return ready ?? 'gpt-5.6-luna';
}

/** Bikin chat model. `answerTokens` = jatah buat jawaban, jatah mikir ditambahin sendiri. */
export function chatModel(
  id: ModelId,
  opts: { answerTokens?: number; tags?: string[] } = {},
) {
  const m = MODELS[id];
  const key = keyFor(id);
  if (!key) {
    throw new Error(`${m.label} belum ada API key-nya. Isi ${m.keyEnv} di .env`);
  }

  return new ChatOpenAI({
    model: id,
    apiKey: key,
    maxTokens: (opts.answerTokens ?? 220) + m.reasonBudget,
    ...(m.temperature !== undefined ? { temperature: m.temperature } : {}),
    ...(opts.tags ? { tags: opts.tags } : {}),
    ...(m.baseURL ? { configuration: { baseURL: m.baseURL } } : {}),
  });
}

/** Output terstruktur, pakai cara yang didukung provider-nya. */
export function structured<T extends z.ZodTypeAny>(
  model: BaseChatModel,
  schema: T,
  name: string,
  id: ModelId,
) {
  return model.withStructuredOutput(schema, {
    name,
    method: MODELS[id].structured,
  });
}
