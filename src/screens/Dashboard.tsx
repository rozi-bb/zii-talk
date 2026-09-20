import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/icons';
import { Orb } from '../components/bits';
import {
  loadProgress,
  loadRun,
  loadRuns,
  type AppConfig,
  type Category,
  type Progress,
  type Run,
  type RunDetail,
  type Topic,
  type Week,
} from '../lib/api';
import { ago, dateTime } from '../lib/format';
import { lastPracticed, STATUSES, type Status } from '../lib/topics';

const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function duration(from: string, to: string): string {
  const m = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
  if (m < 1) return '< 1 menit';
  return m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
}

/* Dashboard = laporan progres. Kelola topik (tambah, kategori) ada di halaman Topik,
   jadi di sini nggak ada tombol tambah lagi. Istilahnya ngikut Latihan & Topik:
   "sesi tersimpan", bukan "tes". */
export function Dashboard({
  cfg,
  topics,
  categories,
  onRefresh,
  onStart,
}: {
  cfg: AppConfig;
  topics: Topic[];
  categories: Category[];
  onRefresh: () => Promise<unknown>;
  onStart: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Status>('all');
  /* topik yang dipilih ikut di URL: balik dari sesi (atau reload) tetap di topik yang sama */
  const [sel, setSel] = useState<string | null>(() => new URLSearchParams(location.search).get('topic'));
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

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
    loadProgress()
      .then(setProg)
      .catch(() => {
        /* metriknya pelengkap — daftar topiknya tetap jalan */
      });
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
    if (window.matchMedia('(max-width: 1023px)').matches) root.current?.closest('.shell-main')?.scrollTo({ top: 0 });
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
  const tested = topics.filter((t) => t.tests > 0);
  const counts: Record<Status, number> = {
    all: topics.length,
    untested: topics.length - tested.length,
    tested: tested.length,
  };
  const shown = filter === 'all' ? topics : filter === 'tested' ? tested : topics.filter((t) => !t.tests);
  const topic = topics.find((t) => t.id === sel) ?? null;
  const sessions = topics.reduce((n, t) => n + t.tests, 0);
  const answers = topics.reduce((n, t) => n + t.questions, 0);
  const last = lastPracticed(topics);

  return (
    <div ref={root} className={`page dash-page${topic ? ' has-sel' : ''}`}>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Sesi tersimpan tiap topik, lengkap dengan transkripnya</p>
        </div>
      </header>

      {err && <div className="err dash-err">{err}</div>}

      <section className="tiles" aria-label="Ringkasan">
        <Tile label="Sesi tersimpan" value={sessions} sub={`di ${tested.length} dari ${topics.length} topik`} accent />
        <Tile
          label="Total jawaban"
          value={answers}
          sub={sessions ? `rata-rata ${Math.round(answers / sessions)} per sesi` : 'belum ada sesi'}
        />
        <Tile label="Belum dicoba" value={counts.untested} sub="topik nunggu dicoba" />
        <Tile
          label="Terakhir latihan"
          value={last?.lastTestedAt ? ago(last.lastTestedAt) : '—'}
          sub={last ? last.name : 'belum pernah'}
        />
      </section>

      {prog && prog.total.sessions > 0 && <Fluency p={prog} />}

      <div className={`dash-cols${topic ? ' has-sel' : ''}`}>
        <section className="dash-list" aria-label="Daftar topik">
          <div className="seg" role="group" aria-label="Status topik">
            {STATUSES.map((f) => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
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
            <span className="num">Sesi</span>
            <span className="num">Jawaban</span>
            <span>Terakhir</span>
          </div>

          {shown.map((t) => (
            <button
              key={t.id}
              className={`trow${sel === t.id ? ' on' : ''}`}
              onClick={() => pick(t.id)}
              aria-current={sel === t.id ? 'true' : undefined}
            >
              <span className="t-name">
                <i style={{ background: t.tint, color: t.ink }}>
                  <Icon name={t.icon} size={17} />
                </i>
                <span>
                  <b>{t.name}</b>
                  <small>{catName(t.categoryId)}</small>
                </span>
              </span>
              <span className="t-status">
                <Status tests={t.tests} />
              </span>
              <span className="t-stats">
                <span className="num">
                  <b>{t.tests}</b>
                  <small>sesi</small>
                </span>
                <span className="num">
                  <b>{t.questions}</b>
                  <small>jawaban</small>
                </span>
                <span className="t-last">{t.lastTestedAt ? ago(t.lastTestedAt) : '—'}</span>
              </span>
            </button>
          ))}

          {shown.length === 0 && (
            <div className="dash-empty">
              {filter === 'tested' ? 'Belum ada sesi yang tersimpan.' : 'Semua topik udah pernah dicoba.'}
            </div>
          )}
        </section>

        <aside className="dash-detail">
          {topic ? (
            <TopicDetail
              key={topic.id}
              cfg={cfg}
              topic={topic}
              categoryName={catName(topic.categoryId)}
              onBack={() => pick(null)}
              onStart={() => onStart(topic.id)}
            />
          ) : (
            <div className="dash-pick">
              <Orb size={44} rings={false} />
              <b>Pilih satu topik</b>
              <span>Riwayat sesi, transkrip, dan tombol latih lagi muncul di sini.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent = false }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={`tile${accent ? ' accent' : ''}`}>
      <span>{label}</span>
      <b className={typeof value === 'string' ? 'txt' : undefined}>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Status({ tests }: { tests: number }) {
  return <span className={`st ${tests ? 'yes' : 'no'}`}>{tests ? 'Tersimpan' : 'Belum dicoba'}</span>;
}

const week = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const label = (w: Week) => week.format(new Date(`${w.start}T00:00:00`));

/* Kelancaran: bukan "berapa kali latihan", tapi "makin lancar atau nggak".
   Dua ukuran beda skala sengaja dipisah jadi dua grafik — satu grafik nggak
   boleh punya dua sumbu. */
function Fluency({ p }: { p: Progress }) {
  const now = p.week.perTen;
  const before = p.prevWeek.perTen;
  const gap = now !== null && before !== null ? Math.round((now - before) * 10) / 10 : null;

  return (
    <section className="prog" aria-label="Kelancaran">
      <div className="prog-head">
        <h2>Kelancaran</h2>
        <span>8 minggu terakhir · dari sesi yang tersimpan</span>
      </div>

      <div className="tiles prog-tiles">
        <Tile
          label="Ngomong minggu ini"
          value={`${p.week.minutes} menit`}
          sub={`${p.week.answers} jawaban di ${p.week.sessions} sesi`}
          accent
        />
        <Tile
          label="Koreksi per 10 jawaban"
          value={now === null ? '—' : now}
          sub={
            gap === null
              ? 'belum ada pembanding minggu lalu'
              : gap < 0
                ? `turun ${Math.abs(gap)} dari minggu lalu`
                : gap > 0
                  ? `naik ${gap} dari minggu lalu`
                  : 'sama kayak minggu lalu'
          }
        />
        <Tile label="Topik aktif" value={p.activeTopics} sub="dilatih 7 hari terakhir" />
        <Tile
          label="Total ngomong"
          value={`${p.total.minutes} menit`}
          sub={`${p.total.answers} jawaban, ${p.total.corrections} koreksi`}
        />
      </div>

      <div className="charts">
        <Bars
          title="Jawaban per minggu"
          weeks={p.weeks}
          value={(w) => w.answers}
          fmt={(v) => `${v} jawaban`}
        />
        <Bars
          title="Koreksi per 10 jawaban"
          note="makin rendah makin lancar"
          weeks={p.weeks}
          value={(w) => w.perTen}
          fmt={(v) => `${v} per 10 jawaban`}
          tone="sky"
        />
      </div>
    </section>
  );
}

/* Batang CSS, bukan SVG: teksnya tetap teks beneran (nggak ikut mengecil waktu
   grafiknya dipersempit) dan angkanya kebaca screen reader. */
function Bars({
  title,
  note,
  weeks,
  value,
  fmt,
  tone = 'violet',
}: {
  title: string;
  note?: string;
  weeks: Week[];
  value: (w: Week) => number | null;
  fmt: (v: number) => string;
  tone?: 'violet' | 'sky';
}) {
  const vals = weeks.map(value);
  const top = Math.max(...vals.map((v) => v ?? 0), 1);
  const last = vals[vals.length - 1];

  return (
    <figure className={`chart ${tone}`}>
      <figcaption>
        <b>{title}</b>
        {note && <span>{note}</span>}
      </figcaption>
      <div className="chart-plot">
        {weeks.map((w, i) => {
          const v = vals[i];
          const pct = v === null || v === 0 ? 0 : Math.max(4, (v / top) * 100);
          return (
            <div key={w.start} className="chart-col" title={`Minggu ${label(w)}: ${v === null ? 'belum ada sesi' : fmt(v)}`}>
              {/* label langsung cuma di minggu terakhir, nempel di ujung batangnya */}
              {i === vals.length - 1 && last !== null && <em style={{ bottom: `calc(${pct}% + 4px)` }}>{last}</em>}
              {v === null || v === 0 ? (
                <i className="chart-nil" aria-hidden="true" />
              ) : (
                <i className="chart-bar" style={{ height: `${pct}%` }} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      <div className="chart-x" aria-hidden="true">
        {weeks.map((w, i) => (
          <span key={w.start}>{i === 0 || i === weeks.length - 1 ? label(w) : ''}</span>
        ))}
      </div>
      {/* angkanya buat screen reader & yang mau baca persisnya */}
      <details className="chart-data">
        <summary>Angkanya</summary>
        <ul>
          {weeks.map((w, i) => (
            <li key={w.start}>
              <span>{label(w)}</span>
              <b>{vals[i] === null ? '—' : fmt(vals[i] as number)}</b>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}

function TopicDetail({
  cfg,
  topic,
  categoryName,
  onBack,
  onStart,
}: {
  cfg: AppConfig;
  topic: Topic;
  categoryName: string;
  onBack: () => void;
  onStart: () => void;
}) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  /* muat ulang tiap angka topiknya berubah (ada sesi baru masuk) */
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
  /* sama kayak tombol Mulai di Latihan & Topik: tanpa model AI, sesinya nggak bisa jalan */
  const modelReady = cfg.models.some((m) => m.ready);

  return (
    <div className="td">
      <button className="link td-back" onClick={onBack}>
        <Icon name="back" size={16} />
        Semua topik
      </button>

      <div className="td-head">
        <i style={{ background: topic.tint, color: topic.ink }}>
          <Icon name={topic.icon} size={24} />
        </i>
        <div>
          <h2>{topic.name}</h2>
          <span>
            {categoryName}
            <Status tests={topic.tests} />
          </span>
        </div>
      </div>
      {topic.blurb && <p className="td-blurb">{topic.blurb}</p>}

      <div className="td-nums">
        <div>
          <b>{topic.tests}</b>
          <span>sesi tersimpan</span>
        </div>
        <div>
          <b>{topic.questions}</b>
          <span>total jawaban</span>
        </div>
        <div>
          <b>{topic.tests ? Math.round(topic.questions / topic.tests) : 0}</b>
          <span>jawaban per sesi</span>
        </div>
      </div>

      <button className="btn primary td-go" disabled={!modelReady} onClick={onStart}>
        <Icon name={topic.tests ? 'replay' : 'mic'} size={18} />
        {topic.tests ? `Latih lagi — sesi ke-${topic.tests + 1}` : 'Mulai sesi pertama'}
      </button>
      <p className="td-hint">
        {modelReady
          ? `Minimal ${cfg.minAnswers} jawaban biar sesinya tersimpan — kurang dari itu dianggap nggak ada.`
          : 'AI belum siap, jadi sesi belum bisa dimulai. Cek Pengaturan.'}
      </p>

      <details className="td-sit">
        <summary>Skenario buat Zii ({topic.situations.length})</summary>
        <ul lang="en">
          {topic.situations.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </details>

      <div className="td-sec">
        <h3>Riwayat sesi</h3>
        {runs && <span>{runs.length}</span>}
      </div>

      {err && <div className="err">{err}</div>}
      {!runs && !err && (
        <div className="td-loading">
          <span className="spin dark" />
        </div>
      )}
      {runs?.length === 0 && <div className="dash-empty">Belum ada sesi yang tersimpan.</div>}
      {runs && runs.length > 0 && (
        <ol className="runs">
          {runs.map((r) => (
            <li key={r.id} className={open === r.id ? 'open' : ''}>
              <button className="run" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                <span className="run-no">#{r.attempt}</span>
                <span className="run-main">
                  <b>{r.questions} jawaban</b>
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
          <span lang="en">{run.situation}</span>
        </div>
      )}
      {run.messages.map((m, i) => (
        <div key={i} className={`tx-line ${m.role}`}>
          {/* kalimatnya bahasa Inggris — biar screen reader nggak ngebaca pakai lafal Indonesia */}
          <div className="tx-bubble" lang="en">
            {m.text}
          </div>
          {m.correction && (
            <div className="tx-fix">
              {m.correction.wrong && <s lang="en">{m.correction.wrong}</s>} → <b lang="en">{m.correction.right}</b>
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
