/* Format waktu yang dipakai bareng-bareng antar layar. */

export const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const rel = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

/** "barusan", "3 jam yang lalu", "kemarin" — lewat sebulan jadi tanggal. */
export function ago(iso: string): string {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return 'barusan';
  if (abs < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rel.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rel.format(Math.round(s / 86400), 'day');
  return dateTime.format(new Date(iso));
}
