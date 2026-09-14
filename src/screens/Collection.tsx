import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/icons';
import { deletePhrase, loadPhrases, type AppConfig, type AppState, type SavedPhrase } from '../lib/api';
import { ago } from '../lib/format';
import { linkTo, type Go } from '../lib/nav';

type SpeechLib = typeof import('../lib/speech');

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
/* huruf kecil + tanpa aksen, sama kayak cari topik */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
/* frasa yang topiknya udah dihapus dikumpulin di satu pilihan filter */
const NO_TOPIC = '__none';

/* Koleksi frasa: semua yang ditangkap dari kartu koreksi & disimpan dari Bengkel.
   Dulu cuma bisa masuk — angkanya ada di sidebar, tapi isinya nggak bisa dilihat. */
export function Collection({
  cfg,
  voice,
  go,
  onChanged,
}: {
  cfg: AppConfig;
  voice: string;
  go: Go;
  /* jumlah frasa di sidebar ikut turun habis hapus */
  onChanged: (s: AppState) => void;
}) {
  const [items, setItems] = useState<SavedPhrase[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('all');
  /* hapus dua langkah: ketuk × dulu, baru "Hapus" — tanpa dialog bawaan browser */
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  /* SDK Azure-nya gede, jadi baru di-import waktu frasa pertama didengerin */
  const lib = useRef<SpeechLib | null>(null);
  const tok = useRef(0);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Koleksi — Zii Talk';
    return () => {
      document.title = prev;
      tok.current++;
      lib.current?.stopSpeaking();
    };
  }, []);

  useEffect(() => {
    loadPhrases()
      .then(setItems)
      .catch((e) => setErr(errText(e)));
  }, []);

  const topics = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const p of items ?? []) {
      const id = p.topicId && p.topicName ? p.topicId : NO_TOPIC;
      const t = m.get(id) ?? { id, name: id === NO_TOPIC ? 'Tanpa topik' : (p.topicName ?? ''), count: 0 };
      t.count++;
      m.set(id, t);
    }
    return [...m.values()];
  }, [items]);

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return (items ?? []).filter((p) => {
      const id = p.topicId && p.topicName ? p.topicId : NO_TOPIC;
      if (topic !== 'all' && id !== topic) return false;
      const hay = norm(`${p.en} ${p.meaning}`);
      return words.every((w) => hay.includes(w));
    });
  }, [items, q, topic]);

  function stop() {
    tok.current++;
    lib.current?.stopSpeaking();
    setPlaying(null);
  }

  async function listen(p: SavedPhrase) {
    if (!cfg.speech.ready) return;
    if (playing === p.id) {
      stop();
      return;
    }
    const mine = ++tok.current;
    setPlaying(p.id);
    try {
      lib.current ??= await import('../lib/speech');
      if (tok.current !== mine) return;
      await lib.current.speak(p.en, voice);
    } catch (e) {
      if (tok.current === mine) setErr(errText(e));
    }
    if (tok.current === mine) setPlaying(null);
  }

  async function remove(p: SavedPhrase) {
    setBusy(p.id);
    setErr(null);
    try {
      const s = await deletePhrase(p.id);
      if (playing === p.id) stop();
      setItems((list) => list?.filter((x) => x.id !== p.id) ?? null);
      setConfirm(null);
      onChanged(s);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  }

  const filtered = q.trim() !== '' || topic !== 'all';

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Koleksi frasa</h1>
          <p>Kalimat yang kamu tangkap dari kartu koreksi & simpan dari Bengkel Kalimat.</p>
        </div>
      </header>

      {err && <div className="err dash-err">{err}</div>}

      {!items && !err && (
        <div className="td-loading">
          <span className="spin dark" />
        </div>
      )}

      {items?.length === 0 && (
        <div className="empty">
          <b>Belum ada frasa</b>
          <span>
            Waktu sesi, ketuk <strong>Tangkap frasa</strong> di kartu koreksi atau <strong>Simpan frasa</strong> di
            Bengkel Kalimat. Semuanya ngumpul di sini.
          </span>
          <a className="btn primary" {...linkTo('/', go)}>
            <Icon name="mic" size={16} />
            Mulai latihan
          </a>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="lib-tools">
            <label className="search">
              <Icon name="search" size={17} />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && q) {
                    e.preventDefault();
                    setQ('');
                  }
                }}
                placeholder="Cari frasa atau artinya"
                aria-label="Cari frasa"
              />
              {q && (
                <button type="button" className="search-x" onClick={() => setQ('')} aria-label="Hapus pencarian">
                  <Icon name="x" size={14} />
                </button>
              )}
            </label>
          </div>

          <div className="lib-meta">
            <span>{shown.length === items.length ? `${items.length} frasa` : `${shown.length} dari ${items.length} frasa`}</span>
            {topics.length > 1 && (
              <label className="sort">
                <span>Topik</span>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter topik">
                  <option value="all">Semua topik</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.count}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={15} />
              </label>
            )}
          </div>

          {shown.length > 0 ? (
            <ul className="phr-list">
              {shown.map((p) => (
                <li key={p.id} className="phr">
                  <div className="phr-main">
                    <b lang="en">{p.en}</b>
                    {p.meaning && <span>{p.meaning}</span>}
                    <small>
                      {p.topicName ?? 'Tanpa topik'} · {ago(p.createdAt)}
                    </small>
                  </div>
                  <div className="phr-acts">
                    {confirm === p.id ? (
                      <>
                        <button className="btn sm ghost" onClick={() => setConfirm(null)} disabled={busy === p.id}>
                          Batal
                        </button>
                        <button className="btn sm danger" onClick={() => void remove(p)} disabled={busy === p.id}>
                          {busy === p.id ? <span className="spin" /> : 'Hapus'}
                        </button>
                      </>
                    ) : (
                      <>
                        {cfg.speech.ready && (
                          <button
                            className={`phr-btn${playing === p.id ? ' on' : ''}`}
                            onClick={() => void listen(p)}
                            aria-label={playing === p.id ? 'Stop' : `Dengerin "${p.en}"`}
                            title={playing === p.id ? 'Stop' : 'Dengerin'}
                          >
                            <Icon name={playing === p.id ? 'stop' : 'speakerSmall'} size={17} />
                          </button>
                        )}
                        <button
                          className="phr-btn"
                          onClick={() => setConfirm(p.id)}
                          aria-label={`Hapus "${p.en}"`}
                          title="Hapus"
                        >
                          <Icon name="x" size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <b>Nggak ada frasa yang cocok</b>
              <span>{filtered ? 'Coba kata lain atau ganti topiknya.' : ''}</span>
              <button
                className="btn ghost"
                onClick={() => {
                  setQ('');
                  setTopic('all');
                }}
              >
                Reset filter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
