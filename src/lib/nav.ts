import { useCallback, useEffect, useState, type MouseEvent } from 'react';

/* Router seukuran kebutuhan: cuma "/" dan "/dashboard".
   Pindah halaman lewat pushState, BUKAN reload. Kalau reload, browser lupa
   kamu barusan ngeklik halaman ini — dan salam pembuka Zii (yang langsung
   bersuara begitu sesi kebuka) bisa diblok aturan autoplay. */
const norm = (p: string) => p.replace(/\/+$/, '') || '/';

export type Go = (to: string) => void;

export function usePath(): [string, Go] {
  const [path, setPath] = useState(() => norm(location.pathname));

  useEffect(() => {
    const on = () => setPath(norm(location.pathname));
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const go = useCallback<Go>((to) => {
    if (location.pathname + location.search !== to) history.pushState(null, '', to);
    setPath(norm(new URL(to, location.origin).pathname));
  }, []);

  return [path, go];
}

/* Props buat <a>: klik biasa pindah tanpa reload, tapi Ctrl/Cmd/klik tengah
   tetap buka tab baru kayak link normal. */
export function linkTo(to: string, go: Go) {
  return {
    href: to,
    onClick: (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(to);
    },
  };
}
