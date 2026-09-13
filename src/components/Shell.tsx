import type { ReactNode } from 'react';
import { Cards, Flame, Icon } from './icons';
import { Orb } from './bits';
import { linkTo, type Go } from '../lib/nav';

const NAV = [
  { to: '/', label: 'Latihan', icon: 'home' },
  { to: '/topik', label: 'Topik', icon: 'grid' },
  { to: '/dashboard', label: 'Dashboard', icon: 'chart' },
  { to: '/pengaturan', label: 'Pengaturan', icon: 'gear' },
];

/* Kerangka semua halaman kecuali sesi: sidebar di laptop, tab bar di HP.
   Sesi sengaja nggak dibungkus — di sana fokusnya cuma ngobrol. */
export function Shell({
  path,
  go,
  momentum,
  phrases,
  needsSetup,
  children,
}: {
  path: string;
  go: Go;
  momentum: number;
  phrases: number;
  /* ada yang belum siap (API key / Azure) — titik oranye di Pengaturan */
  needsSetup: boolean;
  children: ReactNode;
}) {
  const item = (n: (typeof NAV)[number], cls: 'nav-item' | 'tab') => {
    const on = path === n.to;
    return (
      <a key={n.to} className={`${cls}${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} {...linkTo(n.to, go)}>
        <Icon name={n.icon} size={cls === 'tab' ? 21 : 19} />
        <span>{n.label}</span>
        {n.to === '/pengaturan' && needsSetup && <i className="nav-dot" title="Ada yang belum siap" />}
      </a>
    );
  };

  return (
    <div className="shell">
      <aside className="side-nav">
        <div className="brand">
          <Orb size={28} rings={false} />
          <b>Zii Talk</b>
        </div>
        <nav aria-label="Navigasi utama">{NAV.map((n) => item(n, 'nav-item'))}</nav>
        <div className="side-stats">
          <div className="side-stat" title="Naik tiap hari kamu latihan, menyusut kalau lama nggak latihan">
            <Flame size={20} />
            <div>
              <b>{momentum}</b>
              <span>momentum</span>
            </div>
          </div>
          <div className="side-stat" title="Frasa yang udah kamu simpan">
            <Cards size={20} />
            <div>
              <b>{phrases}</b>
              <span>frasa tersimpan</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="shell-main">{children}</main>

      <nav className="tab-bar" aria-label="Navigasi utama">
        {NAV.map((n) => item(n, 'tab'))}
      </nav>
    </div>
  );
}
