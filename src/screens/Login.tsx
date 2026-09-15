import { useEffect, useState, type FormEvent } from 'react';
import { Orb } from '../components/bits';
import { Icon } from '../components/icons';
import { login, register, type User } from '../lib/api';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
/* sama kayak MIN_PASSWORD di server/auth.py — dicek di sini juga biar nggak nunggu server */
const MIN_PASSWORD = 8;

type Mode = 'login' | 'register';

/* Halaman Masuk / Daftar. Nongol di path mana pun selama belum login;
   habis masuk, halaman yang tadi dibuka langsung tampil. */
export function Login({ firstAccount, onDone }: { firstAccount: boolean; onDone: (u: User) => void }) {
  /* belum ada akun sama sekali = pasti mau daftar */
  const [mode, setMode] = useState<Mode>(firstAccount ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${mode === 'login' ? 'Masuk' : 'Daftar'} — Zii Talk`;
  }, [mode]);

  function pick(m: Mode) {
    setMode(m);
    setErr(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setErr('Isi email dan password-nya dulu');
      return;
    }
    if (mode === 'register' && password.length < MIN_PASSWORD) {
      setErr(`Password minimal ${MIN_PASSWORD} karakter`);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      onDone(await (mode === 'login' ? login : register)(email.trim(), password));
    } catch (e) {
      setErr(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <main className="auth-card">
        <div className="auth-brand">
          <Orb size={30} rings={false} />
          <b>Zii Talk</b>
        </div>

        <h1>{mode === 'login' ? 'Masuk dulu, yuk' : 'Bikin akun'}</h1>
        <p className="auth-lede">
          {mode === 'login'
            ? 'Lanjut latihan ngobrol bahasa Inggris bareng Zii.'
            : 'Frasa, momentum, dan riwayat sesimu kesimpan di akun ini.'}
        </p>

        <div className="seg auth-seg">
          <button type="button" className={mode === 'login' ? 'on' : ''} aria-pressed={mode === 'login'} onClick={() => pick('login')}>
            Masuk
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'on' : ''}
            aria-pressed={mode === 'register'}
            onClick={() => pick('register')}
          >
            Daftar
          </button>
        </div>

        {mode === 'register' && firstAccount && (
          <div className="auth-note">
            <Icon name="info" size={17} />
            <span>
              <b>Belum ada akun di sini.</b> Akun pertama otomatis jadi admin dan dapet semua data latihan yang udah
              ada.
            </span>
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <label className="fld">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </label>

          <label className="fld">
            <span>
              Password
              {mode === 'register' && <em>minimal {MIN_PASSWORD} karakter</em>}
            </span>
            <div className="pw">
              <input
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-eye"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Sembunyikan password' : 'Lihat password'}
                aria-pressed={show}
                title={show ? 'Sembunyikan' : 'Lihat'}
              >
                <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </label>

          {err && (
            <div className="err" role="alert">
              {err}
            </div>
          )}

          <button className="btn primary auth-go" disabled={busy}>
            {busy ? <span className="spin" /> : mode === 'login' ? 'Masuk' : 'Daftar & masuk'}
          </button>
        </form>
      </main>
    </div>
  );
}
