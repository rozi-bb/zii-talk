/* Tag ekspresi suara di balasan Zii: [laughter], [excited], dst.
   Server udah nyaring cuma tag yang diizinin (server/expressions.py) dan
   ngirim tiap tag utuh — jadi di sini nggak ada tag setengah jadi.
   Ke Azure dikirim apa adanya (HD voice yang ngerti), di layar dibuang.
   Sengaja nggak import SDK Azure: aman dipakai di layar mana pun. */

const TAG = /\[[a-z_]+\]/gi;

/** Teks buat ditampilkan: tanpa tag, spasi bekas tag dirapiin. */
export function shown(text: string): string {
  return text
    .replace(TAG, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?…])/g, '$1')
    .trim();
}

/* Word boundary Azure ikut ngirim tag sebagai "kata": "[" sendirian, atau
   nempel ke kata berikutnya ("laughter] That's"). */
const TAG_BITS = /\[[a-z_]*\]?|^[a-z_]*\]/gi;

/** Event word boundary ini beneran kata yang diucapin, bukan pecahan tag? */
export const isSpoken = (word: string) => word.replace(TAG_BITS, '').trim() !== '';
