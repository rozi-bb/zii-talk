import type { Phrase } from './api';

const KEY = 'zii-talk-v1';

export type Saved = Phrase & { at: number; topic: string };

export type State = {
  model: string;
  collection: Saved[];
  lastPlayed: string | null; // tanggal ISO (YYYY-MM-DD)
  momentum: number;
  progress: Record<string, number>;
};

const EMPTY: State = { model: '', collection: [], lastPlayed: null, momentum: 0, progress: {} };

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    return { ...EMPTY };
  }
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage penuh atau diblokir — nggak fatal */
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/* Momentum, bukan streak: bolos sehari nggak ngapus apa-apa,
   dan baru mengecil kalau nganggur lebih dari 2 hari. */
export function touchMomentum(s: State): State {
  const now = today();
  if (s.lastPlayed === now) return s;
  const gap = s.lastPlayed ? daysBetween(s.lastPlayed, now) : 1;
  const next = gap <= 2 ? s.momentum + 1 : Math.max(1, Math.round(s.momentum / 2));
  return { ...s, momentum: next, lastPlayed: now };
}

export function addPhrase(s: State, p: Phrase, topic: string): State {
  const dup = s.collection.some((c) => c.en.toLowerCase() === p.en.toLowerCase());
  if (dup) return s;
  return { ...s, collection: [{ ...p, topic, at: Date.now() }, ...s.collection].slice(0, 300) };
}
