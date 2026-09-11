export type ModelInfo = { id: string; label: string; hint: string; ready: boolean; keyEnv: string };
export type AppConfig = {
  models: ModelInfo[];
  speech: { ready: boolean; region: string | null; voice: string };
};

export type Correction = { wrong: string; right: string; why: string };
export type Phrase = { en: string; id: string };
/* Bengkel: tiap gaya dapet beberapa pilihan (biasanya 3), yang pertama paling natural */
export type Translation = { formal: string[]; casual: string[]; note: string };
export type Turn = { role: 'ai' | 'me'; text: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}) as Record<string, unknown>);
  if (!r.ok) throw new Error(String((j as { error?: string }).error ?? `Gagal (${r.status})`));
  return j as T;
}

export async function loadConfig(): Promise<AppConfig> {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error('Server API nggak nyaut. Udah jalanin "npm run dev"?');
  return r.json();
}

export type ReviewOut = { correction: Correction | null; phrase: Phrase | null };

/**
 * Balasan Zii, di-stream.
 * `onDelta` kepanggil tiap potongan teks nyampe.
 * `onReview` kepanggil sekali kalau koreksi/frasa nyusul — graph-nya
 * ngerjain itu paralel, jadi datengnya belakangan di stream yang SAMA.
 */
export async function chatStream(
  p: { model: string; topic: string; situation: string; history: Turn[] },
  onDelta: (chunk: string) => void,
  onReview?: (r: ReviewOut) => void,
  signal?: AbortSignal,
): Promise<string> {
  const r = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
    signal,
  });

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
        const j = JSON.parse(line) as { d?: string; e?: string; review?: ReviewOut };
        if (j.d) {
          full += j.d;
          onDelta(j.d);
        }
        if (j.review) onReview?.(j.review);
        if (j.e) soft = j.e;
      } catch {
        /* baris nggak utuh */
      }
    }
  }

  if (soft && !full) throw new Error(soft);
  return full;
}

export const translate = (p: { model: string; text: string; topic: string }) =>
  post<Translation>('/api/translate', p);
