import { useEffect, useRef } from 'react';

/**
 * SPASI = tahan buat ngomong, lepas buat berhenti — sama kayak di obrolan
 * utama dan Bengkel. Buat layar latihan yang punya kolom jawaban:
 * spasi cuma jadi mic kalau kolomnya masih kosong (atau fokusnya di luar
 * kolom), jadi ngetik kalimat biasa tetap bisa pakai spasi.
 */
export function useSpaceToTalk(enabled: boolean, start: () => void, stop: () => void) {
  const fns = useRef({ start, stop });
  fns.current = { start, stop };
  /* lepas spasi cuma berhenti kalau tadi mulainya dari spasi juga — kolomnya
     udah keisi teks sementara dari mic, jadi nggak bisa dicek dari situ */
  const holding = useRef(false);

  useEffect(() => {
    if (!enabled) {
      holding.current = false;
      return;
    }
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
      return el.tagName === 'INPUT' && (el as HTMLInputElement).value !== '';
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (holding.current) {
        e.preventDefault(); // tahan = auto-repeat, jangan nyelip jadi spasi
        return;
      }
      if (e.repeat || typing(e.target)) return;
      /* tombol yang lagi fokus jangan ikut "keklik" sama spasi */
      e.preventDefault();
      holding.current = true;
      fns.current.start();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !holding.current) return;
      e.preventDefault();
      holding.current = false;
      fns.current.stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled]);
}
