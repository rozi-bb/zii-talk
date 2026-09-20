import type { ReviewResult } from './api';

/* Nilai jawaban latihan ulang. Sengaja longgar: yang dilatih itu kemampuan
   ngomong, bukan hafal tanda baca. Huruf besar, tanda baca, aksen, dan
   singkatan ("I'd" vs "I would") dianggap sama. */

const SHORT: Record<string, string> = {
  "i'm": 'i am',
  "i've": 'i have',
  "i'd": 'i would',
  "i'll": 'i will',
  "it's": 'it is',
  "that's": 'that is',
  "he's": 'he is',
  "she's": 'she is',
  "we're": 'we are',
  "we'll": 'we will',
  "they're": 'they are',
  "you're": 'you are',
  "you'll": 'you will',
  "let's": 'let us',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
};

export function words(s: string): string[] {
  const clean = s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  return clean
    .split(' ')
    .flatMap((w) => (SHORT[w] ?? w).split(' '))
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/* jarak Levenshtein per KATA, bukan per huruf: satu kata ketuker = 1 salah,
   bukan sepanjang kata itu */
function distance(a: string[], b: string[]): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1, // hapus
        row[j - 1] + 1, // sisip
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // ganti
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** 0 = beda total, 1 = sama persis (setelah dinormalin). */
export function similarity(said: string, target: string): number {
  const a = words(said);
  const b = words(target);
  if (!a.length || !b.length) return 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

/** Petunjuk huruf awal: "I'd like to go" -> "I·· l··· t· g·". */
export function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}${'·'.repeat(w.length - 1)}`)
    .join(' ');
}

/** Nilai otomatis. Bisa ditimpa manual di layar latihan. */
export function grade(said: string, target: string): ReviewResult {
  const s = similarity(said, target);
  if (s >= 0.85) return 'pas';
  return s >= 0.5 ? 'hampir' : 'belum';
}
