import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/icons';
import { Orb } from '../components/bits';
import {
  createTopic,
  loadRun,
  loadRuns,
  type AppConfig,
  type Group,
  type Run,
  type RunDetail,
  type Topic,
} from '../lib/api';
import { linkTo, type Go } from '../lib/nav';

type Filter = 'all' | 'untested' | 'tested';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'untested', label: 'Belum dites' },
  { id: 'tested', label: 'Sudah dites' },
];
const GROUP_LABEL: Record<Group, string> = { daily: 'Sehari-hari', work: 'Buat Kerja' };

/* pilihan di form tambah topik — diambil dari ikon & pasangan warna yang udah dipakai */
const ICONS = ['chat', 'cup', 'clock', 'heart', 'chart', 'people', 'case', 'badge', 'ring', 'bookmark', 'send', 'translate', 'keyboard', 'speaker'];
const COLORS = [
  { tint: '#E9E1FF', ink: '#6B36D6' },
  { tint: '#FFE8D8', ink: '#E0630F' },
  { tint: '#DCEEFF', ink: '#1573C4' },
  { tint: '#FFE0EA', ink: '#D63A73' },
  { tint: '#D7F4E7', ink: '#0A8A61' },
  { tint: '#FFF0CE', ink: '#B87C00' },
];

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const rel = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function ago(iso: string): string {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return 'barusan';
  if (abs < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rel.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rel.format(Math.round(s / 86400), 'day');
  return dateTime.format(new Date(iso));
}

function duration(from: string, to: string): string {
  const m = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
  if (m < 1) return '< 1 menit';
  return m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
}

export function Dashboard({
  cfg,
  topics,
  onRefresh,
  onStart,
  go,
}: {
  cfg: AppConfig;
  topics: Topic[];
  onRefresh: () => Promise<void>;
  onStart: (id: string) => void;
  go: Go;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  /* topik yang dipilih ikut di URL: balik dari sesi (atau reload) tetap di topik yang sama */
  const [sel, setSel] = useState<string | null>(() => new URLSearchParams(location.search).get('topic'));
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const body = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Dashboard — Zii Talk';
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const url = sel ? `/dashboard?topic=${encodeURIComponent(sel)}` : '/dashboard';
    if (location.pathname + location.search !== url) history.replaceState(null, '', url);
  }, [sel]);

  /* Dashboard enaknya dibuka di tab sendiri sambil latihan di tab lain —
     jadi tiap tab-nya dilihat lagi, angkanya disegerin. */
  const refresh = useCallback(() => {
    onRefresh()
      .then(() => setErr(null))
      .catch((e) => setErr(errText(e)));
  }, [onRefresh]);

  useEffect(() => {
    refresh();
    const on = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [refresh]);

  const pick = (id: string | null) => {
    setSel(id);
    // di HP detail-nya gantiin daftar, jadi mulai lagi dari atas
    if (window.matchMedia('(max-width: 1023px)').matches) body.current?.scrollTo({ top: 0 });
  };

  const tested = topics.filter((t) => t.tests > 0);
  const counts: Record<Filter, number> = {
    all: topics.length,
    untested: topics.length - tested.length,
    tested: tested.length,
  };
  const shown = filter === 'all' ? topics : filter === 'tested' ? tested : topics.filter((t) => !t.tests);
  const topic = topics.find((t) => t.id === sel) ?? null;

  return (
    <div className="dash">
      <header className="dash-top safe-top">
        <a className="icon-btn" aria-label="Balik ke Home" {...linkTo('/', go)}>
          <Icon name="back" size={19} />
        </a>
        <div className="dash-title">
          <b>Dashboard</b>
          <span>Topik, status tes, dan riwayatnya</span>
        </div>
        <button className="dash-add b3d" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          <b>Tambah topik</b>
        </button>
      </header>

      <div ref={body} className="dash-body scroll">
        <div className="dash-in">
          {err && <div className="err dash-err">{err}</div>}

          <section className="tiles" aria-label="Ringkasan">
            <Tile label="Total topik" value={topics.length} />
            <Tile label="Sudah dites" value={tested.length} sub={`dari ${topics.length} topik`} tone="teal" />
            <Tile label="Belum dites" value={counts.untested} sub="nunggu dicoba" tone="tang" />
            <Tile label="Total tes" value={topics.reduce((n, t) => n + t.tests, 0)} tone="violet" />
            <Tile label="Total pertanyaan" value={topics.reduce((n, t) => n + t.questions, 0)} tone="amber" />
          </section>

          <div className={`dash-cols${topic ? ' has-sel' : ''}`}>
            <section className="dash-list" aria-label="Daftar topik">
              <div className="seg" role="tablist">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    className={filter === f.id ? 'on' : ''}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                    <i>{counts[f.id]}</i>
                  </button>
                ))}
              </div>

              <div className="trow thead" aria-hidden="true">
                <span>Topik</span>
                <span>Status</span>
                <span className="num">Tes</span>
                <span className="num">Pertanyaan</span>
                <span>Terakhir dites</span>
              </div>

              {shown.map((t) => (
                <button
                  key={t.id}
                  className={`trow${sel === t.id ? ' on' : ''}`}
                  onClick={() => pick(t.id)}
                  aria-current={sel === t.id}
                >
                  <span className="t-name">
                    <i style={{ background: t.tint, color: t.ink }}>
                      <Icon name={t.icon} size={17} />
                    </i>
                    <span>
                      <b>{t.name}</b>
                      <small>{GROUP_LABEL[t.group]}</small>
                    </span>
                  </span>
                  <span className="t-status">
                    <Status tests={t.tests} />
                  </span>
                  <span className="t-stats">
                    <span className="num">
                      <b>{t.tests}</b>
                      <small>tes</small>
                    </span>
                    <span className="num">
                      <b>{t.questions}</b>
                      <small>pertanyaan</small>
                    </span>
                    <span className="t-last">{t.lastTestedAt ? ago(t.lastTestedAt) : '—'}</span>
                  </span>
                </button>
              ))}

              {shown.length === 0 && (
                <div className="dash-empty">
                  {filter === 'tested' ? 'Belum ada topik yang dites.' : 'Semua topik udah pernah dites.'}
                </div>
              )}
            </section>

            <aside className="dash-detail">
              {topic ? (
                <TopicDetail
                  key={topic.id}
                  cfg={cfg}
                  topic={topic}
                  onBack={() => pick(null)}
                  onStart={() => onStart(topic.id)}
                />
              ) : (
                <div className="dash-pick">
                  <Orb size={44} rings={false} />
                  <b>Pilih satu topik</b>
                  <span>Riwayat tes dan tombol retest-nya muncul di sini.</span>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {adding && (
        <TopicForm
          onClose={() => setAdding(false)}
          onSaved={(t) => {
            setAdding(false);
            setFilter('all');
            refresh();
            pick(t.id);
          }}
        />
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = '',
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: '' | 'teal' | 'tang' | 'violet' | 'amber';
}) {
  return (
    <div className={`tile ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Status({ tests }: { tests: number }) {
  return <span className={`st ${tests ? 'yes' : 'no'}`}>{tests ? 'Sudah dites' : 'Belum dites'}</span>;
}

function TopicDetail({
  cfg,
  topic,
  onBack,
  onStart,
}: {
  cfg: AppConfig;
  topic: Topic;
  onBack: () => void;
  onStart: () => void;
}) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  /* muat ulang tiap angka topiknya berubah (ada tes baru masuk) */
  useEffect(() => {
    let alive = true;
    loadRuns(topic.id)
      .then((r) => {
        if (!alive) return;
        setRuns(r);
        setErr(null);
      })
      .catch((e) => alive && setErr(errText(e)));
    return () => {
      alive = false;
    };
  }, [topic.id, topic.tests, topic.questions, topic.lastTestedAt]);

  const modelLabel = (id: string) => cfg.models.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="td">
      <button className="td-back" onClick={onBack}>
        <Icon name="back" size={15} />
        Semua topik
      </button>

      <div className="td-head">
        <i style={{ background: topic.tint, color: topic.ink }}>
          <Icon name={topic.icon} size={24} />
        </i>
        <div>
          <b>{topic.name}</b>
          <span>
            {GROUP_LABEL[topic.group]}
            <Status tests={topic.tests} />
          </span>
        </div>
      </div>
      {topic.blurb && <p className="td-blurb">{topic.blurb}</p>}

      <div className="td-nums">
        <div>
          <b>{topic.tests}</b>
          <span>kali dites</span>
        </div>
        <div>
          <b>{topic.questions}</b>
          <span>total pertanyaan</span>
        </div>
        <div>
          <b>{topic.tests ? Math.round(topic.questions / topic.tests) : 0}</b>
          <span>rata-rata per tes</span>
        </div>
      </div>

      <button className="cta b3d td-go" onClick={onStart}>
        <Icon name={topic.tests ? 'replay' : 'mic'} size={19} />
        <b>{topic.tests ? `Retest — tes ke-${topic.tests + 1}` : 'Mulai tes pertama'}</b>
      </button>
      <div className="td-hint">Minimal {cfg.minAnswers} pertanyaan dijawab biar tesnya kesimpan.</div>

      <details className="td-sit">
        <summary>Skenario buat Zii ({topic.situations.length})</summary>
        <ul>
          {topic.situations.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </details>

      <div className="td-sec">
        <b>Riwayat tes</b>
        {runs && <span>{runs.length}</span>}
      </div>

      {err && <div className="err">{err}</div>}
      {!runs && !err && (
        <div className="td-loading">
          <span className="spin dark" />
        </div>
      )}
      {runs?.length === 0 && <div className="dash-empty">Belum pernah dites.</div>}
      {runs && runs.length > 0 && (
        <ol className="runs">
          {runs.map((r) => (
            <li key={r.id} className={open === r.id ? 'open' : ''}>
              <button className="run" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                <span className="run-no">#{r.attempt}</span>
                <span className="run-main">
                  <b>{r.questions} pertanyaan</b>
                  <small>
                    {dateTime.format(new Date(r.startedAt))} · {duration(r.startedAt, r.endedAt)} ·{' '}
                    {modelLabel(r.model)}
                  </small>
                </span>
                <Icon name="chevron" size={16} className={open === r.id ? 'rot' : ''} />
              </button>
              {open === r.id && <Transcript id={r.id} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Transcript({ id }: { id: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadRun(id)
      .then((r) => alive && setRun(r))
      .catch((e) => alive && setErr(errText(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  if (err) return <div className="err tx-err">{err}</div>;
  if (!run) {
    return (
      <div className="td-loading">
        <span className="spin dark" />
      </div>
    );
  }

  let answer = 0;
  return (
    <div className="tx">
      {run.situation && (
        <div className="tx-sit">
          <b>Skenario</b>
          {run.situation}
        </div>
      )}
      {run.messages.map((m, i) => (
        <div key={i} className={`tx-line ${m.role}`}>
          <div className="tx-bubble">{m.text}</div>
          {m.correction && (
            <div className="tx-fix">
              {m.correction.wrong && <s>{m.correction.wrong}</s>} → <b>{m.correction.right}</b>
              {m.correction.why && <span>{m.correction.why}</span>}
            </div>
          )}
          <time dateTime={m.at}>
            {m.role === 'me' ? `Jawaban ${++answer}` : 'Zii'} · {clock.format(new Date(m.at))}
          </time>
        </div>
      ))}
    </div>
  );
}

function TopicForm({ onClose, onSaved }: { onClose: () => void; onSaved: (t: Topic) => void }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<Group>('daily');
  const [blurb, setBlurb] = useState('');
  const [text, setText] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const situations = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const tooMany = situations.length > 5;
  const ready = name.trim() !== '' && situations.length > 0 && !tooMany && !busy;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [busy, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      onSaved(await createTopic({ name: name.trim(), group, blurb: blurb.trim(), situations, icon, ...COLORS[color] }));
    } catch (e2) {
      setErr(errText(e2));
      setBusy(false);
    }
  }

  return (
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form className="sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="tf-title">
        <div className="handle" />
        <div className="bk-head">
          <div style={{ flex: 1 }}>
            <b id="tf-title">Tambah topik</b>
            <p>Langsung muncul di Home dan dashboard.</p>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="tf-grid">
          <div className="tf-fields">
            <label className="fld">
              <span>Nama topik</span>
              <input
                autoFocus
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Telepon & Voice Note"
              />
            </label>

            <div className="fld">
              <span>Grup</span>
              <div className="seg">
                {(['daily', 'work'] as Group[]).map((g) => (
                  <button type="button" key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>
                    {GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>

            <label className="fld">
              <span>
                Deskripsi singkat <em>{blurb.length}/160</em>
              </span>
              <input
                maxLength={160}
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder="Angkat telepon, minta diulang, tutup dengan sopan."
              />
            </label>

            <label className="fld">
              <span>
                Skenario buat Zii <em>satu per baris · maks 5</em>
              </span>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="You call the learner about a late delivery. Ask them to confirm the address."
              />
              <small>Tulis dalam bahasa Inggris. Tiap sesi, Zii pilih satu secara acak.</small>
            </label>

            <div className="fld">
              <span>Ikon</span>
              <div className="swatches">
                {ICONS.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`ico-pick${icon === n ? ' on' : ''}`}
                    onClick={() => setIcon(n)}
                    aria-label={`Ikon ${n}`}
                    aria-pressed={icon === n}
                  >
                    <Icon name={n} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="fld">
              <span>Warna</span>
              <div className="swatches">
                {COLORS.map((c, i) => (
                  <button
                    type="button"
                    key={c.ink + c.tint}
                    className={`clr-pick${color === i ? ' on' : ''}`}
                    style={{ background: c.tint, color: c.ink }}
                    onClick={() => setColor(i)}
                    aria-label={`Warna ${i + 1}`}
                    aria-pressed={color === i}
                  >
                    <i style={{ background: c.ink }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="tf-preview" aria-hidden="true">
            <span className="tf-lbl">Pratinjau di Home</span>
            <div className="topic">
              <div className="topic-ico" style={{ background: COLORS[color].tint, color: COLORS[color].ink }}>
                <Icon name={icon} size={21} />
              </div>
              <div className="topic-name">{name.trim() || 'Nama topik'}</div>
              <div className="topic-meta">
                <div className="bar">
                  <i style={{ width: 0 }} />
                </div>
                <span>baru</span>
              </div>
            </div>
          </div>
        </div>

        {tooMany && <div className="err">Skenario maksimal 5 — sekarang ada {situations.length}.</div>}
        {err && <div className="err">{err}</div>}

        <button className="use b3d" type="submit" disabled={!ready}>
          {busy ? <span className="spin" /> : <Icon name="check" size={20} />}
          <b>Simpan topik</b>
        </button>
      </form>
    </div>
  );
}
