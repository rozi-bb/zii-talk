import { useEffect, type ReactNode } from 'react';
import { ModelPicker, VoicePicker } from '../components/bits';
import type { AppConfig, AppState } from '../lib/api';

/* Semua yang sifatnya "atur sekali": suara, model, dan status sistem.
   Dulu nongol di atas daftar topik di Home. */
export function Settings({
  cfg,
  state,
  onModel,
  onVoice,
}: {
  cfg: AppConfig;
  state: AppState;
  onModel: (id: string) => void;
  onVoice: (id: string) => void;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Pengaturan — Zii Talk';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p>Suara Zii, model AI, dan status sistem.</p>
        </div>
      </header>

      <section className="set-card">
        <h2>Suara Zii</h2>
        <p>Dipakai waktu Zii ngobrol dan di Bengkel Kalimat. Ganti suara = langsung dengerin contohnya.</p>
        <VoicePicker voices={cfg.speech.voices} value={state.voice} ready={cfg.speech.ready} onChange={onVoice} />
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
            state={cfg.tracing.on ? 'ok' : 'off'}
            title="Tracing · LangSmith"
            detail={cfg.tracing.on ? `Aktif, project "${cfg.tracing.project}"` : 'Mati — opsional, buat debug'}
          />
        </ul>
      </section>
    </div>
  );
}

const LABEL = { ok: 'Siap', bad: 'Belum siap', off: 'Mati' } as const;

function Sys({ state, title, detail }: { state: keyof typeof LABEL; title: string; detail: ReactNode }) {
  return (
    <li>
      <i className={`sys-dot ${state}`} aria-hidden="true" />
      <div>
        <b>{title}</b>
        <span>{detail}</span>
      </div>
      <em className={`sys-state ${state}`}>{LABEL[state]}</em>
    </li>
  );
}
