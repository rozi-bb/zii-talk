import { shown } from './expr';

export type ModelInfo = { id: string; label: string; hint: string; ready: boolean; keyEnv: string };
/* daftar suara dipegang server (server/voices.py) — yang aman dipakai di region-nya */
export type VoiceInfo = { id: string; name: string; gender: 'female' | 'male'; hint: string };
export type AppConfig = {
  models: ModelInfo[];
  speech: { ready: boolean; region: string | null; voices: VoiceInfo[] };
  tracing: { on: boolean; project: string; keyed: boolean };
  /* jawaban minimal biar satu sesi kesimpan sebagai tes */
  minAnswers: number;
};

/* `topics` = jumlah topik di kategori itu, dihitung server */
export type Category = { id: string; name: string; topics: number };
export type Topic = {
  id: string;
  name: string;
  categoryId: string;
  icon: string;
  tint: string;
  ink: string;
  blurb: string;
  situations: string[];
  /* dihitung server dari riwayat tes, bukan flag yang disimpan */
  tests: number;
  questions: number;
  lastTestedAt: string | null;
};
export type NewTopic = Pick<Topic, 'name' | 'categoryId' | 'blurb' | 'situations' | 'icon' | 'tint' | 'ink'>;

/* `voice` selalu valid: kalau belum pernah milih, server ngisi default-nya.
   `due` = frasa yang waktunya diulang hari ini. */
export type AppState = {
  model: string;
  voice: string;
  momentum: number;
  lastPlayed: string | null;
  phrases: number;
  due: number;
};

export type Correction = { wrong: string; right: string; why: string };
export type Phrase = { en: string; id: string };
/* Bengkel: tiap gaya dapet beberapa pilihan (biasanya 3), yang pertama paling natural */
export type Translation = { formal: string[]; casual: string[]; note: string };
/* `at` = kapan barisnya nongol di layar (ms) — jadi timestamp di riwayat tes */
export type Turn = { role: 'ai' | 'me'; text: string; at: number; correction?: Correction | null };

/* sesi yang udah kesimpan sebagai tes */
export type SavedRun = { attempt: number; questions: number };
export type Run = {
  id: string;
  topicId: string;
  attempt: number;
  situation: string;
  model: string;
  questions: number;
  /* jumlah kartu koreksi di sesi itu — dipakai ringkasan sesi buat mbandingin */
  corrections: number;
  startedAt: string;
  endedAt: string;
};
export type RunMessage = { role: 'ai' | 'me'; text: string; correction: Correction | null; at: string };
export type RunDetail = Run & { messages: RunMessage[] };

export type User = { id: number; email: string; role: 'admin' | 'user' };
/* `firstAccount` = belum ada akun sama sekali; yang daftar duluan jadi admin */
export type AuthInfo = { user: User | null; firstAccount: boolean };

/* Server bilang belum login / sesinya habis. App dengerin event-nya dan balik
   ke halaman Masuk — jadi layar mana pun nggak perlu ngurus ini sendiri. */
export const SIGNED_OUT = 'zii:signed-out';
export class SignedOut extends Error {}
export function signedOut(): SignedOut {
  window.dispatchEvent(new Event(SIGNED_OUT));
  return new SignedOut('Sesi login habis. Masuk lagi ya.');
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  /* 401 dari /api/auth/* = salah password, bukan sesi habis */
  if (r.status === 401 && !url.startsWith('/api/auth/')) throw signedOut();
  const j = await r.json().catch(() => ({}) as Record<string, unknown>);
  if (!r.ok) throw new Error(String((j as { error?: string }).error ?? `Gagal (${r.status})`));
  return j as T;
}

const get = <T>(url: string) => call<T>('GET', url);
const post = <T>(url: string, body: unknown = {}) => call<T>('POST', url, body);

const DOWN = 'Server API nggak nyaut. Udah jalanin "npm run dev"?';

/* request pertama waktu app dibuka, jadi pesan "server mati" pindah ke sini */
export async function loadMe(): Promise<AuthInfo> {
  const r = await fetch('/api/auth/me').catch(() => null);
  const j = r && ((await r.json().catch(() => null)) as (AuthInfo & { error?: string }) | null);
  if (!r?.ok || !j) throw new Error(j?.error ?? DOWN);
  return j;
}
export const login = (email: string, password: string) => post<User>('/api/auth/login', { email, password });
export const register = (email: string, password: string) => post<User>('/api/auth/register', { email, password });
export const logout = () => post<{ ok: boolean }>('/api/auth/logout');

export const loadConfig = () => get<AppConfig>('/api/config');
export const loadState = () => get<AppState>('/api/state');
export const saveModel = (model: string) => call<AppState>('PUT', '/api/state/model', { model });
export const saveVoice = (voice: string) => call<AppState>('PUT', '/api/state/voice', { voice });
export const touchMomentum = () => post<AppState>('/api/state/touch');
export const addPhrase = (p: Phrase, topicId: string) => post<AppState>('/api/phrases', { ...p, topicId });

/* frasa di koleksi. `meaning` = arti / kalimat Indonesia-nya; `topicName` null kalau topiknya udah dihapus.
   `box` 1-5 = kotak Leitner; makin tinggi, makin jarang diulang. */
export type ReviewResult = 'pas' | 'hampir' | 'belum';
export type SavedPhrase = {
  id: number;
  en: string;
  meaning: string;
  topicId: string | null;
  topicName: string | null;
  createdAt: string;
  box: number;
  nextReviewAt: string;
  lastResult: ReviewResult | null;
  reviews: number;
};
export const loadPhrases = () => get<SavedPhrase[]>('/api/phrases');
export const deletePhrase = (id: number) => call<AppState>('DELETE', `/api/phrases/${id}`);
export const loadDuePhrases = (limit = 20) => get<SavedPhrase[]>(`/api/phrases/due?limit=${limit}`);
export const reviewPhrase = (id: number, result: ReviewResult) =>
  post<{ phrase: SavedPhrase; due: number }>(`/api/phrases/${id}/review`, { result });

/* metrik kelancaran buat Dashboard. `perTen` = koreksi per 10 jawaban (makin kecil makin lancar) */
export type Span = { sessions: number; answers: number; corrections: number; minutes: number; perTen: number | null };
export type Week = Span & { start: string };
export type Progress = {
  weeks: Week[]; // 8 minggu terakhir, paling lama duluan
  week: Span;
  prevWeek: Span;
  activeTopics: number;
  total: Span;
};
export const loadProgress = () => get<Progress>('/api/progress');

export const loadTopics = () => get<Topic[]>('/api/topics');
export const createTopic = (t: NewTopic) => post<Topic>('/api/topics', t);
export const loadCategories = () => get<Category[]>('/api/categories');
export const createCategory = (name: string) => post<Category>('/api/categories', { name });
export const loadRuns = (topicId: string) => get<Run[]>(`/api/topics/${encodeURIComponent(topicId)}/runs`);
export const loadRun = (id: string) => get<RunDetail>(`/api/runs/${encodeURIComponent(id)}`);
export const rewindRun = (id: string, keep: number) =>
  post<{ saved: SavedRun | null }>(`/api/runs/${encodeURIComponent(id)}/rewind`, { keep });

export type ReviewOut = { correction: Correction | null; phrase: Phrase | null };

/**
 * Balasan Zii, di-stream.
 * `delta` kepanggil tiap potongan teks nyampe.
 * `review` kepanggil sekali kalau koreksi/frasa nyusul — graph-nya
 * ngerjain itu paralel, jadi datengnya belakangan di stream yang SAMA.
 * `run` kepanggil kalau sesi ini (udah) kesimpan sebagai tes.
 * `warn` = gagal nyimpen ke database; obrolannya tetap jalan.
 */
export async function chatStream(
  p: { model: string; topicId: string; runId: string; situation: string; history: Turn[] },
  on: {
    delta: (chunk: string) => void;
    review?: (r: ReviewOut) => void;
    run?: (r: SavedRun) => void;
    warn?: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<string> {
  const r = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
    signal,
  });

  if (r.status === 401) throw signedOut();
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Gagal (${r.status})`);
  }
  if (!r.body) throw new Error('Browser ini nggak dukung streaming');

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  let soft: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line) as {
          d?: string;
          e?: string;
          review?: ReviewOut;
          run?: SavedRun;
          warn?: string;
        };
        if (j.d) {
          full += j.d;
          on.delta(j.d);
        }
        if (j.review) on.review?.(j.review);
        if (j.run) on.run?.(j.run);
        if (j.warn) on.warn?.(j.warn);
        if (j.e) soft = j.e;
      } catch {
        /* baris nggak utuh */
      }
    }
  }

  if (soft && !shown(full)) throw new Error(soft); // cuma tag suara = sama aja nggak jawab
  return full;
}

export const translate = (p: { model: string; text: string; topic: string }) =>
  post<Translation>('/api/translate', p);
