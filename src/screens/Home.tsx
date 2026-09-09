import { TOPICS, byId, type Topic } from '../data/topics';
import { Icon, Flame, Cards } from '../components/icons';
import { ModelPicker } from '../components/bits';
import type { AppConfig } from '../lib/api';
import type { State } from '../lib/store';

const OF_DAY = 'macet';

export function Home({
  cfg,
  state,
  picked,
  onPick,
  onStart,
  onModel,
}: {
  cfg: AppConfig;
  state: State;
  picked: string | null;
  onPick: (id: string | null) => void;
  onStart: (id: string) => void;
  onModel: (id: string) => void;
}) {
  const hero = byId(OF_DAY);
  const daily = TOPICS.filter((t) => t.group === 'daily' && t.id !== OF_DAY);
  const work = TOPICS.filter((t) => t.group === 'work');

  const modelReady = cfg.models.some((m) => m.ready);
  const missing: string[] = [];
  if (!modelReady) missing.push('LLM');
  if (!cfg.speech.ready) missing.push('Azure Speech');

  const card = (t: Topic) => {
    const done = state.progress[t.id] ?? 0;
    return (
      <button
        key={t.id}
        className={`topic${picked === t.id ? ' on' : ''}`}
        onClick={() => onPick(picked === t.id ? null : t.id)}
        onDoubleClick={() => onStart(t.id)}
      >
        <div className="topic-ico" style={{ background: t.tint, color: t.ink }}>
          <Icon name={t.icon} size={21} />
        </div>
        <div className="topic-name">{t.name}</div>
        <div className="topic-meta">
          <div className="bar">
            <i style={{ width: `${Math.min(100, (done / 8) * 100)}%` }} />
          </div>
          <span>{done ? `${done}/8` : 'baru'}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="home">
      <div className="home-top safe-top">
        <div className="stat">
          <Flame className="flame" />
          <b>{state.momentum}</b>
          <span>hari</span>
        </div>
        <div className="stat" style={{ marginLeft: 'auto' }}>
          <Cards />
          <b>{state.collection.length}</b>
          <span>frasa</span>
        </div>
      </div>

      <div className="home-body scroll">
        <div className="home-hi">
          Mau ngobrol apa
          <br />
          hari ini?
        </div>
        <div className="home-sub">Pilih yang paling bikin kamu penasaran.</div>

        {missing.length > 0 && (
          <div className="warn" style={{ marginTop: 16 }}>
            <Icon name="info" size={18} />
            <div>
              <b>{missing.join(' & ')} belum kebaca.</b> Copy <code>.env.example</code> jadi{' '}
              <code>.env</code>, isi key-nya, terus restart <code>npm run dev</code>.
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <ModelPicker models={cfg.models} value={state.model} onChange={onModel} />
        </div>

        <button className="hero b3d" onClick={() => onStart(hero.id)}>
          <div className="hero-deco" aria-hidden="true">
            <svg width="136" height="136" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.1">
              <circle cx="12" cy="12" r="9.2" />
              <circle cx="12" cy="12" r="3.9" />
              <path d="M5.5 5.5 9.2 9.2M18.5 5.5 14.8 9.2M5.5 18.5 9.2 14.8M18.5 18.5 14.8 14.8" />
            </svg>
          </div>
          <div className="hero-kicker">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <path d="M12 2.6l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6L3.4 8.8l6.1-.6L12 2.6Z" />
            </svg>
            PILIHAN HARI INI
          </div>
          <div className="hero-title">{hero.name}</div>
          <div className="hero-desc">{hero.blurb}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 15 }}>
            <span className="hero-go">Mulai</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.85 }}>± 4 menit</span>
          </div>
        </button>

        <div className="sec">
          <b>Sehari-hari</b>
          <span>{daily.length} topik</span>
        </div>
        <div className="grid">{daily.map(card)}</div>

        <div className="sec">
          <b>Buat Kerja</b>
          <span>{work.length} topik</span>
        </div>
        <div className="grid">{work.map(card)}</div>

        <div style={{ height: 10 }} />
      </div>

      <div className="home-foot">
        <button
          className="cta b3d"
          disabled={!modelReady}
          onClick={() => onStart(picked ?? hero.id)}
        >
          <Icon name="mic" size={20} />
          <b>{picked ? `Mulai: ${byId(picked).name}` : 'Mulai Pilihan Hari Ini'}</b>
        </button>
        <div className="hint">Ngobrolnya pakai suara — tekan &amp; tahan buat ngomong</div>
      </div>
    </div>
  );
}
