import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';

import { graph as conversation } from '../src/agent/conversation';
import { graph as workshop } from '../src/agent/workshop';
import { MODELS, keyFor, pickModel, type ModelId } from '../src/agent/models';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '512kb' }));

const speechKey = () => (process.env.AZURE_SPEECH_KEY ?? '').trim();
const speechRegion = () => (process.env.AZURE_SPEECH_REGION ?? '').trim();
const clean = (s: unknown, max = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/* ── apa yang siap dipakai ─────────────────────────────── */
app.get('/api/config', (_req, res) => {
  res.json({
    models: (Object.keys(MODELS) as ModelId[]).map((id) => ({
      id,
      label: MODELS[id].label,
      hint: MODELS[id].hint,
      ready: Boolean(keyFor(id)),
      keyEnv: MODELS[id].keyEnv,
    })),
    speech: {
      ready: Boolean(speechKey() && speechRegion()),
      region: speechRegion() || null,
      voice: (process.env.AZURE_TTS_VOICE ?? 'en-US-AriaNeural').trim(),
    },
    tracing: {
      on: String(process.env.LANGSMITH_TRACING ?? '').toLowerCase() === 'true',
      project: process.env.LANGSMITH_PROJECT ?? 'default',
    },
  });
});

/* ── token Azure Speech (10 menit, aman dikirim ke browser) ── */
app.get('/api/speech/token', async (_req, res) => {
  const key = speechKey();
  const region = speechRegion();
  if (!key || !region) {
    return res.status(503).json({
      error: 'Azure Speech belum diisi. Set AZURE_SPEECH_KEY & AZURE_SPEECH_REGION di .env',
    });
  }
  try {
    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: `Azure nolak key-nya (${r.status}). Cek key & region.` });
    }
    res.json({ token: await r.text(), region });
  } catch (e) {
    res.status(502).json({ error: `Nggak bisa nyambung ke Azure: ${(e as Error).message}` });
  }
});

/* ── satu giliran ngobrol ───────────────────────────────
   Graph-nya jalanin `respond` dan `review` PARALEL, dan
   dua-duanya keluar lewat SATU stream ini:
     {"d": "..."}       potongan balasan Zii
     {"review": {...}}  koreksi + frasa, nyusul belakangan
   ────────────────────────────────────────────────────── */
type Turn = { role: 'ai' | 'me'; text: string };

const toMessages = (history: unknown): BaseMessage[] =>
  (Array.isArray(history) ? (history as Turn[]) : [])
    .slice(-14)
    .map((t) =>
      t.role === 'ai' ? new AIMessage(clean(t.text, 500)) : new HumanMessage(clean(t.text, 500)),
    );

app.post('/api/chat/stream', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const model = pickModel(body.model);
  if (!keyFor(model)) {
    return res
      .status(503)
      .json({ error: `${MODELS[model].label} belum ada API key-nya. Isi ${MODELS[model].keyEnv} di .env` });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // jangan dibuffer proxy
  res.flushHeaders?.();

  const line = (obj: unknown) => {
    res.write(`${JSON.stringify(obj)}\n`);
    (res as unknown as { flush?: () => void }).flush?.();
  };

  try {
    let got = 0;

    for await (const [mode, chunk] of await conversation.stream(
      {
        messages: toMessages(body.history),
        topic: clean(body.topic, 80),
        situation: clean(body.situation, 300),
        model,
      },
      { streamMode: ['messages', 'updates'] },
    )) {
      if (mode === 'messages') {
        const [msg, meta] = chunk as [{ text?: string }, { langgraph_node?: string }];
        // HANYA token dari node `respond`. Node `review` juga manggil LLM,
        // dan buat DeepSeek itu termasuk monolog "thinking" — jangan sampai
        // kekirim ke user (atau keucap sama TTS).
        if (meta?.langgraph_node === 'respond' && msg?.text) {
          got += msg.text.length;
          line({ d: msg.text });
        }
      }

      if (mode === 'updates') {
        const upd = chunk as Record<string, { correction?: unknown; phrase?: unknown }>;
        if (upd.review && (upd.review.correction || upd.review.phrase)) {
          line({ review: { correction: upd.review.correction ?? null, phrase: upd.review.phrase ?? null } });
        }
      }
    }

    if (!got) line({ e: `${MODELS[model].label} nggak ngasih jawaban. Coba lagi atau ganti model.` });
    line({ done: true });
    res.end();
  } catch (e) {
    line({ e: `Stream putus: ${(e as Error).message}` });
    res.end();
  }
});

/* ── Bengkel Kalimat ───────────────────────────────────── */
app.post('/api/translate', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const said = clean(body.text, 500);
  if (!said) return res.status(400).json({ error: 'Belum ada yang mau diterjemahin' });

  const model = pickModel(body.model);
  if (!keyFor(model)) {
    return res
      .status(503)
      .json({ error: `${MODELS[model].label} belum ada API key-nya. Isi ${MODELS[model].keyEnv} di .env` });
  }

  try {
    const out = await workshop.invoke({ text: said, topic: clean(body.topic, 120), model });
    res.json({
      formal: clean(out.formal, 240),
      casual: clean(out.casual, 240) || clean(out.formal, 240),
      note: clean(out.note, 200),
    });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

/* ── frontend hasil build ──────────────────────────────── */
const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(404).send('Jalanin "npm run build" dulu, atau pakai "npm run dev".');
  });
});

const port = Number(process.env.PORT) || 8787;
/* Default cuma localhost: yang buka pintu ke tailnet itu `tailscale serve`,
   bukan server ini. HOST=0.0.0.0 kalau mau ekspos langsung ke LAN — tapi
   tanpa HTTPS mikrofon browser nggak mau jalan. */
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  const llm = (Object.keys(MODELS) as ModelId[]).filter((id) => keyFor(id));
  const tracing = String(process.env.LANGSMITH_TRACING ?? '').toLowerCase() === 'true';
  console.log(`\n  Zii Talk API  →  http://${host}:${port}`);
  console.log(`  LLM siap      →  ${llm.length ? llm.join(', ') : 'BELUM ADA (isi .env)'}`);
  console.log(`  Azure Speech  →  ${speechKey() && speechRegion() ? speechRegion() : 'BELUM ADA (isi .env)'}`);
  console.log(
    `  LangSmith     →  ${
      tracing
        ? `tracing ON → project "${process.env.LANGSMITH_PROJECT ?? 'default'}"`
        : 'tracing OFF (set LANGSMITH_TRACING=true + LANGSMITH_API_KEY)'
    }`,
  );
  try {
    const s = JSON.parse(readFileSync(path.join(__dirname, '..', '.bridge.json'), 'utf8'));
    if (Number(s.target) === port) console.log(`  Lewat tailnet →  ${s.url}`);
  } catch {
    /* bridge belum nyala */
  }
  console.log('');
});
