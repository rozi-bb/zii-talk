import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/icons';
import { loadDuePhrases, reviewPhrase, type AppConfig, type ReviewResult, type SavedPhrase } from '../lib/api';
import { grade } from '../lib/match';
import { linkTo, type Go } from '../lib/nav';

type SpeechLib = typeof import('../lib/speech');

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const LABEL: Record<ReviewResult, string> = { pas: 'Pas!', hampir: 'Hampir', belum: 'Belum' };
const NEXT: Record<ReviewResult, string> = {
  pas: 'Muncul lagi nanti, jaraknya makin jauh.',
  hampir: 'Diulang lagi besok.',
  belum: 'Balik ke kotak 1, diulang besok.',
};

/* Latihan ulang frasa: artinya yang ditampilin, kamu yang nyusun kalimat
   Inggrisnya — recall dulu, baru lihat jawabannya. Jadwalnya kotak Leitner
   (1, 3, 7, 14, 30 hari), diatur server. */
export function Review({
  cfg,
  voice,
  go,
  onDue,
}: {
  cfg: AppConfig;
  voice: string;
  go: Go;
  /* angka "perlu diulang" di beranda & Koleksi ikut turun */
  onDue: (due: number) => void;
}) {
  const [items, setItems] = useState<SavedPhrase[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [said, setSaid] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [tally, setTally] = useState<Record<ReviewResult, number>>({ pas: 0, hampir: 0, belum: 0 });

  const box = useRef<HTMLInputElement | null>(null);
  const lib = useRef<SpeechLib | null>(null);
  const listener = useRef<{ stop: () => Promise<string> } | null>(null);
  const tok = useRef(0);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Latihan ulang — Zii Talk';
    return () => {
      document.title = prev;
      tok.current++;
      lib.current?.stopSpeaking();
      void listener.current?.stop();
    };
  }, []);

  function load() {
    setItems(null);
    setAt(0);
    setSaid('');
    setResult(null);
    setTally({ pas: 0, hampir: 0, belum: 0 });
    loadDuePhrases()
      .then((list) => {
        setItems(list);
        setErr(null);
      })
      .catch((e) => setErr(errText(e)));
  }

  useEffect(load, []);

  const card = items?.[at] ?? null;
  const done = !!items && at >= items.length;

  async function play(text: string) {
    if (!cfg.speech.ready || playing) return;
    const mine = ++tok.current;
    setPlaying(true);
    try {
      lib.current ??= await import('../lib/speech');
      if (tok.current !== mine) return;
      await lib.current.speak(text, voice);
    } catch (e) {
      if (tok.current === mine) setErr(errText(e));
    }
    if (tok.current === mine) setPlaying(false);
  }

  /* mic: ketuk buat mulai, ketuk lagi buat berhenti — bukan tahan, biar
     tangannya bebas kayak ngisi kolom biasa */
  async function mic() {
    if (!cfg.speech.ready) return;
    if (rec) {
      const l = listener.current;
      listener.current = null;
      setRec(false);
      const text = l ? await l.stop() : '';
      if (text.trim()) setSaid(text.trim());
      return;
    }
    setRec(true);
    setErr(null);
    try {
      lib.current ??= await import('../lib/speech');
      listener.current = await lib.current.listen('en-US', setSaid);
    } catch (e) {
      setRec(false);
      setErr(errText(e));
    }
  }

  function check() {
    if (!card || result) return;
    setResult(grade(said, card.en));
  }

  function reveal() {
    if (!card || result) return;
    setResult(said.trim() ? grade(said, card.en) : 'belum');
  }

  async function next() {
    if (!card || !result) return;
    setBusy(true);
    try {
      const r = await reviewPhrase(card.id, result);
      onDue(r.due);
      setTally((t) => ({ ...t, [result]: t[result] + 1 }));
      setAt((i) => i + 1);
      setSaid('');
      setResult(null);
      setErr(null);
      window.setTimeout(() => box.current?.focus(), 0);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Latihan ulang</h1>
          <p>Baca artinya, susun kalimat Inggrisnya sendiri — baru lihat jawabannya.</p>
        </div>
        <a className="btn ghost" {...linkTo('/koleksi', go)}>
          <Icon name="bookmark" size={16} />
          Koleksi
        </a>
      </header>

      {err && <div className="err dash-err">{err}</div>}

      {!items && !err && (
        <div className="td-loading">
          <span className="spin dark" />
        </div>
      )}

      {items?.length === 0 && (
        <div className="empty">
          <b>Belum ada yang perlu diulang</b>
          <span>
            Frasa baru langsung masuk antrean, dan yang udah dilatih balik lagi sesuai jadwalnya (1, 3, 7, 14, lalu
            30 hari).
          </span>
          <a className="btn primary" {...linkTo('/', go)}>
            <Icon name="mic" size={16} />
            Mulai sesi
          </a>
        </div>
      )}

      {items && items.length > 0 && !done && card && (
        <>
          <div className="rv-bar">
            <span>
              Frasa {at + 1} dari {items.length}
            </span>
            <div className="rv-track" role="presentation">
              <i style={{ width: `${(at / items.length) * 100}%` }} />
            </div>
          </div>

          <section className="rv-card">
            <div className="rv-kicker">
              <span className="rv-box">Kotak {card.box}</span>
              {card.topicName && <span>{card.topicName}</span>}
              {card.reviews === 0 && <span>belum pernah diulang</span>}
            </div>

            <p className="rv-ask">{card.meaning || 'Ingat kalimat yang kamu simpan ini'}</p>
            {!card.meaning && !result && (
              <p className="rv-hint" lang="en">
                {card.en
                  .split(' ')
                  .map((w) => `${w[0]}${'·'.repeat(Math.max(0, w.length - 1))}`)
                  .join(' ')}
              </p>
            )}

            <label className="fld rv-fld">
              <span>Bahasa Inggrisnya</span>
              <div className="pw">
                <input
                  ref={box}
                  autoFocus
                  lang="en"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={said}
                  placeholder="Ketik atau pakai mic"
                  onChange={(e) => setSaid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (result) void next();
                    else check();
                  }}
                  disabled={!!result}
                />
                {cfg.speech.ready && !result && (
                  <button
                    type="button"
                    className={`pw-eye rv-mic${rec ? ' on' : ''}`}
                    onClick={() => void mic()}
                    aria-label={rec ? 'Selesai ngomong' : 'Ngomong pakai mic'}
                    aria-pressed={rec}
                  >
                    <Icon name={rec ? 'stop' : 'mic'} size={18} />
                  </button>
                )}
              </div>
            </label>

            {!result ? (
              <div className="rv-acts">
                <button className="btn primary" onClick={check} disabled={!said.trim()}>
                  Cek jawaban
                </button>
                <button className="btn ghost" onClick={reveal}>
                  Nyerah, lihat jawabannya
                </button>
              </div>
            ) : (
              <>
                <div className={`rv-res ${result}`}>
                  <b>{LABEL[result]}</b>
                  <span>{NEXT[result]}</span>
                </div>

                <div className="rv-answer">
                  <div>
                    <small>Kalimat aslinya</small>
                    <b lang="en">{card.en}</b>
                  </div>
                  {cfg.speech.ready && (
                    <button className="phr-btn" onClick={() => void play(card.en)} aria-label={`Dengerin "${card.en}"`}>
                      <Icon name={playing ? 'stop' : 'speakerSmall'} size={17} />
                    </button>
                  )}
                </div>
                {said.trim() && <p className="rv-said">Jawabanmu: “{said.trim()}”</p>}

                <div className="rv-acts">
                  <button className="btn primary" onClick={() => void next()} disabled={busy}>
                    {busy ? <span className="spin" /> : at + 1 < items.length ? 'Lanjut' : 'Selesai'}
                  </button>
                  {/* penilaian otomatis bisa meleset — kamu yang paling tau */}
                  <div className="rv-fix">
                    <span>Salah nilai?</span>
                    {(['pas', 'hampir', 'belum'] as ReviewResult[])
                      .filter((r) => r !== result)
                      .map((r) => (
                        <button key={r} className="btn sm ghost" onClick={() => setResult(r)}>
                          {LABEL[r]}
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {done && (
        <div className="empty rv-done">
          <b>Selesai — {items?.length} frasa</b>
          <span>
            {tally.pas} pas · {tally.hampir} hampir · {tally.belum} belum. Yang belum nyantol balik lagi besok.
          </span>
          <div className="rv-done-acts">
            <button className="btn primary" onClick={load}>
              <Icon name="replay" size={16} />
              Cek lagi
            </button>
            <a className="btn ghost" {...linkTo('/koleksi', go)}>
              Buka koleksi
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
