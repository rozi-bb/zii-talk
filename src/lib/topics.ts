/* Logika daftar topik yang dipakai Latihan & halaman Topik:
   cari, filter, urutkan, dan milih rekomendasi. Sengaja murni (tanpa React)
   biar gampang dites dan nggak beda hasil antar layar. */

import type { Topic } from './api';
import { ago } from './format';

export type Status = 'all' | 'untested' | 'tested';
export type Sort = 'default' | 'stale' | 'recent' | 'most' | 'az';

export const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'untested', label: 'Belum dicoba' },
  { id: 'tested', label: 'Sudah tersimpan' },
];

export const SORTS: { id: Sort; label: string }[] = [
  { id: 'default', label: 'Urutan bawaan' },
  { id: 'stale', label: 'Paling lama nggak dilatih' },
  { id: 'recent', label: 'Terakhir dilatih' },
  { id: 'most', label: 'Paling sering dilatih' },
  { id: 'az', label: 'Nama A–Z' },
];

/** Waktu sesi tersimpan terakhir (ms). Belum pernah = 0, jadi selalu "paling lama". */
export const lastMs = (t: Topic) => (t.lastTestedAt ? Date.parse(t.lastTestedAt) : 0);

export function statusText(t: Topic): string {
  if (!t.tests || !t.lastTestedAt) return 'Belum dicoba';
  return `${t.tests} sesi tersimpan · ${ago(t.lastTestedAt)}`;
}

/* huruf kecil + tanpa aksen, biar "cafe" nemu "Café" */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filterTopics(
  topics: Topic[],
  { q, category, status }: { q: string; category: string | null; status: Status },
): Topic[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return topics.filter((t) => {
    if (category && t.categoryId !== category) return false;
    if (status === 'untested' && t.tests) return false;
    if (status === 'tested' && !t.tests) return false;
    if (!words.length) return true;
    const hay = norm(`${t.name} ${t.blurb}`);
    return words.every((w) => hay.includes(w));
  });
}

export function sortTopics(topics: Topic[], sort: Sort): Topic[] {
  const list = [...topics]; // sort bawaan JS stabil: yang nilainya sama tetap di urutan bawaan
  switch (sort) {
    case 'stale':
      return list.sort((a, b) => lastMs(a) - lastMs(b));
    case 'recent':
      return list.sort((a, b) => lastMs(b) - lastMs(a));
    case 'most':
      return list.sort((a, b) => b.tests - a.tests || b.questions - a.questions);
    case 'az':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    default:
      return list;
  }
}

/** Topik dengan sesi tersimpan paling baru. */
export function lastPracticed(topics: Topic[]): Topic | null {
  let best: Topic | null = null;
  for (const t of topics) if (t.tests && (!best || lastMs(t) > lastMs(best))) best = t;
  return best;
}

/* nomor hari di zona waktu lokal — ganti tengah malam, bukan jam 7 pagi (UTC) */
function dayNumber(d = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/**
 * Rekomendasi hari ini. Kandidatnya 5 topik yang paling perlu dilatih
 * (belum pernah dicoba duluan, lalu yang paling lama nggak disentuh), dan
 * yang kepilih ditentuin tanggal: sama seharian, ganti besoknya.
 * Kalau topik itu keburu dilatih, dia keluar dari kandidat dan rekomendasinya
 * geser ke topik berikutnya — itu disengaja.
 */
export function pickOfDay(topics: Topic[], exclude?: string | null): Topic | null {
  const pool = sortTopics(topics, 'stale')
    .filter((t) => t.id !== exclude)
    .slice(0, 5);
  return pool.length ? pool[dayNumber() % pool.length] : null;
}
