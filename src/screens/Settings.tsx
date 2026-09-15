import { useEffect, useState, type ReactNode } from 'react';
import { ModelPicker, VoicePicker } from '../components/bits';
import { Icon } from '../components/icons';
import type { AppConfig, AppState, User } from '../lib/api';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* Semua yang sifatnya "atur sekali": akun, suara, model, dan status sistem.
   Dulu nongol di atas daftar topik di Home. */
export function Settings({
  cfg,
  state,
  user,
  onLogout,
  onModel,
  onVoice,
}: {
  cfg: AppConfig;
  state: AppState;
  user: User;
  onLogout: () => Promise<void>;
  onModel: (id: string) => void;
  onVoice: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [logoutErr, setLogoutErr] = useState<string | null>(null);

  async function leave() {
    setLeaving(true);
    setLogoutErr(null);
    try {
      await onLogout();
    } catch (e) {
      setLogoutErr(errText(e));
      setLeaving(false);
    }
  }

  useEffect(() => {
    const prev = document.title;
    document.title = 'Pengaturan — Zii Talk';
    return () => {
      document.title = prev;
    };
  }, []);

  /* sama kayak titik oranye di navigasi: sesi belum bisa jalan */
  const broken = !cfg.models.some((m) => m.ready) || !cfg.speech.ready;
  const tracing = !cfg.tracing.on ? 'off' : cfg.tracing.keyed ? 'ok' : 'bad';

  const status = (
    <section className="set-card">
      <h2>Status sistem</h2>
      <p>
        Buat ngecek kalau ada yang nggak jalan. Perubahan di file <code>.env</code> baru kebaca setelah server
        di-restart.
      </p>
      <ul className="sys">
        {cfg.models.map((m) => (
          <Sys
            key={m.id}
            state={m.ready ? 'ok' : 'bad'}
            title={`AI · ${m.label}`}
            detail={
              m.ready ? (
                'API key kebaca'
              ) : (
                <>
                  Isi <code>{m.keyEnv}</code> di <code>.env</code>
                </>
              )
            }
          />
        ))}
        <Sys
          state={cfg.speech.ready ? 'ok' : 'bad'}
          title="Mic & suara · Azure Speech"
          detail={
            cfg.speech.ready ? (
              `Aktif di region ${cfg.speech.region}`
            ) : (
              <>
                Isi <code>AZURE_SPEECH_KEY</code> dan <code>AZURE_SPEECH_REGION</code> di <code>.env</code>
              </>
            )
          }
        />
        <Sys
          state={tracing}
          title="Tracing · LangSmith"
          detail={
            tracing === 'off' ? (
              'Mati — opsional, buat debug'
            ) : tracing === 'ok' ? (
              `Aktif, project "${cfg.tracing.project}"`
            ) : (
              /* dulu tetap "Siap" walaupun key-nya kosong */
              <>
                Nyala tapi <code>LANGSMITH_API_KEY</code> kosong. Isi key-nya, atau set{' '}
                <code>LANGSMITH_TRACING=false</code>
              </>
            )
          }
        />
      </ul>
    </section>
  );

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p>Akun, suara Zii, model AI, dan status sistem.</p>
        </div>
      </header>

      {/* ada yang belum siap = orang ke sini buat nyari tahu kenapa, jadi statusnya paling atas */}
      {broken && status}

      <section className="set-card">
        <h2>Akun</h2>
        <div className="acct">
          <span className="avatar lg" aria-hidden="true">
            {user.email.charAt(0).toUpperCase()}
          </span>
          <div className="acct-id">
            <b>{user.email}</b>
            <span>{user.role === 'admin' ? 'Admin · akun pertama di app ini' : 'Pengguna'}</span>
          </div>
          <button className="btn ghost acct-out" onClick={() => void leave()} disabled={leaving}>
            {leaving ? <span className="spin dark" /> : <Icon name="logout" size={17} />}
            Keluar
          </button>
        </div>
        {logoutErr && <p className="set-note acct-err">{logoutErr}</p>}
      </section>

      <section className="set-card">
        <h2>Suara Zii</h2>
        <p>Dipakai waktu Zii ngobrol dan di Bengkel Kalimat. Ganti suara = langsung dengerin contohnya.</p>
        <VoicePicker voices={cfg.speech.voices} value={state.voice} ready={cfg.speech.ready} onChange={onVoice} />
        {!cfg.speech.ready && <p className="set-note">Contoh suara bisa didengerin setelah Azure Speech siap.</p>}
      </section>

      <section className="set-card">
        <h2>Model AI</h2>
        <p>Yang nyusun balasan Zii, kartu koreksi, dan terjemahan di Bengkel.</p>
        <ModelPicker models={cfg.models} value={state.model} onChange={onModel} />
        <ul className="model-notes">
          {cfg.models.map((m) => (
            <li key={m.id}>
              <b>{m.label}</b>
              {m.hint}
            </li>
          ))}
        </ul>
      </section>

      <section className="set-card">
        <h2>Aturan sesi</h2>
        <p>
          Satu sesi baru <b>selesai dan tersimpan</b> kalau kamu jawab minimal <b>{cfg.minAnswers} kali</b>. Keluar
          sebelum itu, sesinya dianggap nggak ada: nggak masuk riwayat dan nggak dihitung di Dashboard.
        </p>
      </section>

      {!broken && status}
    </div>
  );
}

const LABEL = { ok: 'Siap', bad: 'Belum siap', off: 'Mati' } as const;

function Sys({ state, title, detail }: { state: keyof typeof LABEL; title: string; detail: ReactNode }) {
  return (
    <li>
      <i className={`sys-dot ${state}`} aria-hidden="true" />
      <div>
        {/* label status sebaris sama judul; keterangannya dapet lebar penuh di bawah */}
        <div className="sys-head">
          <b>{title}</b>
          <em className={`sys-state ${state}`}>{LABEL[state]}</em>
        </div>
        <span>{detail}</span>
      </div>
    </li>
  );
}
