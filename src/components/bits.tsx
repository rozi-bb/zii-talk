import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import type { ModelInfo, VoiceInfo } from '../lib/api';

type SpeechLib = typeof import('../lib/speech');

export function Orb({
  mode = 'idle',
  size = 62,
  rings = true,
}: {
  mode?: 'idle' | 'think' | 'talk' | 'hush';
  size?: number;
  rings?: boolean;
}) {
  const box = Math.round(size * 1.5);
  return (
    <div
      className={`orb-wrap${mode === 'talk' ? ' fast' : ''}`}
      style={{ width: box, height: box }}
    >
      {rings && (
        <>
          <div className="orb-ring" style={{ width: box, height: box }} />
          <div className="orb-ring b" style={{ width: box, height: box }} />
        </>
      )}
      <div className={`orb ${mode}`} style={{ width: size, height: size }} />
    </div>
  );
}

export function Wave({ levels, sky = false }: { levels: number[]; sky?: boolean }) {
  return (
    <div className={`wave${sky ? ' sky' : ''}`} aria-hidden="true">
      {levels.map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </div>
  );
}

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const active = models.find((m) => m.id === value);
  return (
    <div className="picker">
      <span
        className="dot"
        style={{ background: active?.ready ? 'var(--teal)' : 'var(--faint)' }}
        title={active?.ready ? 'API key kebaca' : 'API key belum diisi'}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <label htmlFor="model">MODEL LLM</label>
        <select id="model" value={value} onChange={(e) => onChange(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.ready ? '' : ' — belum ada key'}
            </option>
          ))}
        </select>
      </div>
      <Icon name="chevron" size={16} />
    </div>
  );
}

/* Ganti suara = langsung dengerin contohnya, biar nggak milih dari nama doang.
   SDK Azure-nya gede, jadi baru di-import pas contoh pertama diputer — Home
   tetap enteng. */
export function VoicePicker({
  voices,
  value,
  ready,
  onChange,
}: {
  voices: VoiceInfo[];
  value: string;
  ready: boolean;
  onChange: (id: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const lib = useRef<SpeechLib | null>(null);
  /* naik tiap contoh baru / stop — speak() lama yang telat kelar nggak ngubah tombol */
  const tok = useRef(0);

  useEffect(
    () => () => {
      tok.current++;
      lib.current?.stopSpeaking(); // pindah layar / mulai sesi = contohnya berhenti
    },
    [],
  );

  async function preview(id: string) {
    const v = voices.find((x) => x.id === id);
    if (!ready || !v) return;
    const mine = ++tok.current;
    setStatus('loading');
    try {
      lib.current ??= await import('../lib/speech');
      if (tok.current !== mine) return;
      setStatus('playing');
      await lib.current.speak(`Hi, I'm ${v.name}. Ready to practice some English?`, id);
    } catch {
      /* contoh gagal bunyi nggak ngalangin milih suara */
    }
    if (tok.current === mine) setStatus('idle');
  }

  function stop() {
    tok.current++;
    lib.current?.stopSpeaking();
    setStatus('idle');
  }

  const group = (g: VoiceInfo['gender']) =>
    voices
      .filter((v) => v.gender === g)
      .map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
          {v.hint ? ` — ${v.hint}` : ''}
        </option>
      ));

  const busy = status !== 'idle';
  return (
    <div className="picker">
      <span
        className="dot"
        style={{ background: ready ? 'var(--teal)' : 'var(--faint)' }}
        title={ready ? 'Azure Speech kebaca' : 'Azure Speech belum diisi'}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <label htmlFor="voice">SUARA ZII</label>
        <select
          id="voice"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            void preview(e.target.value);
          }}
        >
          <optgroup label="Perempuan">{group('female')}</optgroup>
          <optgroup label="Laki-laki">{group('male')}</optgroup>
        </select>
      </div>
      <Icon name="chevron" size={16} />
      {ready && (
        <button
          type="button"
          className={`picker-play${busy ? ' on' : ''}`}
          onClick={() => (busy ? stop() : void preview(value))}
          aria-label={busy ? 'Stop contoh suara' : 'Dengerin contoh suara'}
          title={busy ? 'Stop' : 'Dengerin contoh'}
        >
          <Icon name={busy ? 'stop' : 'speakerSmall'} size={16} />
        </button>
      )}
    </div>
  );
}

export function Beats({ done, total }: { done: number; total: number }) {
  return (
    <div className="beats" aria-label={`${done} dari ${total} pertanyaan dijawab`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? 'on' : ''} />
      ))}
    </div>
  );
}
