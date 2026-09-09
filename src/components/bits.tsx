import { Icon } from './icons';
import type { ModelInfo } from '../lib/api';

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

export function Beats({ done, total = 6 }: { done: number; total?: number }) {
  return (
    <div className="beats" aria-label={`${done} dari ${total} giliran`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? 'on' : ''} />
      ))}
    </div>
  );
}
