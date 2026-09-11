import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Wave } from './bits';
import { translate, type Translation } from '../lib/api';
import { listen, speak, stopSpeaking, openMeter, fakeLevels, type Meter, type Session } from '../lib/speech';

const BARS = 14;
const flat = () => new Array(BARS).fill(6) as number[];

type Stage = 'empty' | 'listening' | 'done' | 'typing';
type Ver = 'formal' | 'casual';

const VERS: { key: Ver; label: string; hint: string }[] = [
  { key: 'formal', label: 'Sopan', hint: 'klien, atasan, orang baru' },
  { key: 'casual', label: 'Santai', hint: 'teman, rekan kerja' },
];

export function Bengkel({
  model,
  topic,
  voice,
  speechReady,
  onClose,
  onSave,
}: {
  model: string;
  topic: string;
  voice: string;
  speechReady: boolean;
  onClose: () => void;
  onSave: (en: string, id: string) => void;
}) {
  const [stage, setStage] = useState<Stage>(speechReady ? 'empty' : 'typing');
  const [said, setSaid] = useState('');
  const [draft, setDraft] = useState('');
  const [res, setRes] = useState<Translation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(flat);
  const [lit, setLit] = useState(-1);
  /* versi yang dipilih buat dipakai & disimpan, dan versi yang lagi bunyi */
  const [pick, setPick] = useState<Ver>('formal');
  const [playing, setPlaying] = useState<Ver | null>(null);
  /* per versi: nyimpen Sopan nggak bikin Santai ikut dianggap tersimpan */
  const [savedVers, setSavedVers] = useState<Ver[]>([]);
  const [fresh, setFresh] = useState(false);

  const ses = useRef<Session | null>(null);
  /* speak() nutup player lama, tapi promise & event kata-nya bisa nyusul
     belakangan. Tanpa penanda ini, dengerin kartu A lalu B bikin sisa
     suara A nimpa highlight & status kartu B. */
  const playTok = useRef(0);
  const meter = useRef<Meter | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (timer.current) clearInterval(timer.current);
      meter.current?.close();
      void ses.current?.stop();
    };
  }, []);

  async function go(text: string) {
    const clean = text.trim();
    if (!clean) {
      setStage(speechReady ? 'empty' : 'typing');
      return;
    }
    setSaid(clean);
    setBusy(true);
    setErr(null);
    // hasil lama masih bunyi? matiin, biar highlight-nya nggak nempel ke hasil baru
    playTok.current++;
    stopSpeaking();
    setPlaying(null);
    setLit(-1);
    setRes(null);
    try {
      const out = await translate({ model, text: clean, topic });
      setRes(out);
      setPick('formal');
      setSavedVers([]);
      setFresh(true);
      setStage('done');
      window.setTimeout(() => setFresh(false), 900);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage('done');
    } finally {
      setBusy(false);
    }
  }

  async function startListen() {
    if (!speechReady || stage === 'listening' || busy) return;
    setErr(null);
    setSaid('');
    setStage('listening');
    try {
      meter.current = meter.current ?? (await openMeter());
      timer.current = window.setInterval(() => {
        setLevels(meter.current ? meter.current.read(BARS) : fakeLevels(BARS));
      }, 90);
      ses.current = await listen('id-ID', setSaid);
    } catch (e) {
      if (timer.current) clearInterval(timer.current);
      setLevels(flat());
      setErr(e instanceof Error ? e.message : String(e));
      setStage('empty');
    }
  }

  async function stopListen() {
    if (stage !== 'listening') return;
    if (timer.current) clearInterval(timer.current);
    setLevels(flat());
    const s = ses.current;
    ses.current = null;
    const text = s ? await s.stop() : said;
    await go(text);
  }

  /* SPASI = tahan buat ngomong, sama kayak di layar obrolan utama —
     biar konsistensinya kejaga, nggak beda kelakuan pas kabur ke sini. */
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target) || stage === 'typing') return;
      e.preventDefault();
      if (e.repeat) return;
      void startListen();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target) || stage === 'typing') return;
      e.preventDefault();
      void stopListen();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [speechReady, stage, busy]);

  async function play(v: Ver, rate: number) {
    if (!res || !speechReady) return;
    const tok = ++playTok.current;
    const mine = () => playTok.current === tok;
    setPlaying(v);
    setLit(0);
    try {
      await speak(res[v], voice, { rate, onWord: (i) => mine() && setLit(i) });
    } catch (e) {
      if (mine()) setErr(e instanceof Error ? e.message : String(e));
    }
    if (!mine()) return; // udah ada yang diputer setelahnya
    setPlaying(null);
    setLit(-1);
  }

  /* kalau dua versinya sama persis, nggak usah pura-pura ada pilihan */
  const vers =
    res && res.casual && res.casual !== res.formal
      ? VERS
      : [{ key: 'formal' as Ver, label: 'Sopan & santai', hint: 'kalimatnya sama aja' }];
  const pickLabel = vers.find((v) => v.key === pick)?.label ?? 'Sopan';
  const saved = savedVers.includes(pick);

  return (
    <div className="bengkel">
      <div className="handle" />

      <div className="bk-head">
        <div style={{ flex: 1 }}>
          <b>Bengkel Kalimat</b>
          <p>Ngomong pakai bahasa Indonesia — aku kasih versi Inggrisnya.</p>
        </div>
        <button className="x" onClick={onClose} aria-label="Tutup bengkel">
          <Icon name="x" size={16} />
        </button>
      </div>

      {err && <div className="err" style={{ margin: '14px 0 0' }}>{err}</div>}

      <div className="lane">
        <span className="tag id">ID</span>
        <b style={{ color: 'var(--sky-dark)' }}>Bahasa Indonesia</b>
        <span className="note">
          {stage === 'listening'
            ? 'ngedengerin...'
            : stage === 'typing'
              ? 'mode ketik'
              : said
                ? 'hasil suara kamu'
                : 'tahan mic-nya'}
        </span>
      </div>

      <div className="idbox">
        <button
          className={`mic-sky${stage === 'listening' ? ' on' : ''}`}
          disabled={!speechReady || busy}
          onPointerDown={startListen}
          onPointerUp={stopListen}
          onPointerLeave={stopListen}
          onPointerCancel={stopListen}
          aria-label="Tahan buat ngomong bahasa Indonesia"
        >
          <Icon name={speechReady ? 'mic' : 'micOff'} size={26} />
        </button>

        <div className="body">
          {stage === 'listening' ? (
            <Wave levels={levels} sky />
          ) : stage === 'typing' ? (
            <input
              autoFocus
              value={draft}
              placeholder="Ketik maksudmu di sini..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void go(draft);
              }}
            />
          ) : (
            <div className="said">
              {said || (
                <span style={{ color: 'var(--muted)' }}>
                  Tahan mic biru atau <span className="kbd">SPASI</span>, ngomong bebas.
                </span>
              )}
            </div>
          )}
        </div>

        {stage === 'typing' && (
          <button
            className="round sky b3d"
            style={{ width: 44, height: 44 }}
            disabled={!draft.trim() || busy}
            onClick={() => void go(draft)}
            aria-label="Terjemahin"
          >
            <Icon name="right" size={20} />
          </button>
        )}
      </div>

      <div className="fixrow">
        {speechReady && (
          <button className="mini" disabled={busy} onClick={startListen}>
            <Icon name="replay" size={14} />
            Ngomong ulang
          </button>
        )}
        <button
          className={`mini${stage === 'typing' ? ' on' : ''}`}
          onClick={() => {
            setDraft(said);
            setStage(stage === 'typing' ? 'done' : 'typing');
          }}
        >
          <Icon name="keyboard" size={14} />
          {stage === 'typing' ? 'Balik ke suara' : 'Ketik aja'}
        </button>
      </div>

      <div className="arrow">
        <div className="ln" />
        <i>{busy ? <span className="spin" /> : <Icon name="down" size={17} />}</i>
        <div className="ln" />
      </div>

      <div className="lane" style={{ margin: '0 0 8px' }}>
        <span className="tag en">EN</span>
        <b style={{ color: 'var(--violet-dark)' }}>
          {res && vers.length > 1 ? 'Pilih yang mau kamu ucapkan' : 'Ini yang kamu ucapkan'}
        </b>
      </div>

      {res ? (
        <div className={`verbox${fresh ? ' in' : ''}`}>
          {vers.map((v) => {
            const on = pick === v.key;
            const sounding = playing === v.key;
            return (
              <div
                key={v.key}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                className={`ver${on ? ' on' : ''}`}
                onClick={() => setPick(v.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setPick(v.key);
                }}
              >
                <div className="ver-head">
                  <span className={`ver-tag ${v.key}`}>{v.label}</span>
                  <span className="ver-hint">{v.hint}</span>
                  {vers.length > 1 && (
                    <span className="ver-check">{on && <Icon name="check" size={12} />}</span>
                  )}
                </div>

                <div className="entext">
                  {res[v.key].split(' ').map((w, i) => (
                    <span key={i} className={sounding && lit >= 0 && i < lit ? 'lit' : ''}>
                      {w}
                    </span>
                  ))}
                </div>

                <div className="en-acts">
                  <div className="spk-wrap">
                    {sounding && (
                      <>
                        <div className="spk-arc" />
                        <div className="spk-arc b" />
                        <div className="spk-arc c" />
                      </>
                    )}
                    <button
                      className="spk b3d"
                      disabled={!speechReady}
                      onClick={(e) => {
                        e.stopPropagation(); // dengerin nggak otomatis milih
                        void play(v.key, 1);
                      }}
                      aria-label={`Dengerin versi ${v.label.toLowerCase()}`}
                    >
                      <Icon name="speaker" size={18} />
                    </button>
                  </div>

                  <button
                    className="outline"
                    disabled={!speechReady}
                    onClick={(e) => {
                      e.stopPropagation();
                      void play(v.key, 0.7);
                    }}
                  >
                    <Icon name="clock2" size={13} />
                    Pelanin
                  </button>
                </div>
              </div>
            );
          })}

          {res.note && vers.length > 1 && <p className="ver-note">{res.note}</p>}
        </div>
      ) : (
        <div className="enbox">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.5 }}>
            {busy ? 'Nyusun kalimatnya...' : 'Hasil Inggrisnya muncul di sini.'}
          </div>
        </div>
      )}

      <button className="use b3d" onClick={onClose}>
        <b>Pakai &amp; Lanjut Ngobrol</b>
        <Icon name="right" size={19} />
      </button>

      {res && (
        <button
          className={`save${saved ? ' on' : ''}`}
          onClick={() => {
            if (saved) return;
            onSave(res[pick], said);
            setSavedVers((s) => [...s, pick]);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'var(--amber)' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.4 3.6h11.2v17l-5.6-4.2-5.6 4.2v-17Z" />
          </svg>
          {saved
            ? 'Tersimpan di koleksi frasa'
            : vers.length > 1
              ? `Simpan versi ${pickLabel.toLowerCase()} ke koleksi frasa`
              : 'Simpan ke koleksi frasa'}
        </button>
      )}
    </div>
  );
}
