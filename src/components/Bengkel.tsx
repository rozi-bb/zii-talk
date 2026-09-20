import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Wave } from './bits';
import { Drill } from './Drill';
import { translate, type Translation } from '../lib/api';
import { listen, speak, stopSpeaking, openMeter, fakeLevels, type Meter, type Session } from '../lib/speech';

const BARS = 14;
const flat = () => new Array(BARS).fill(6) as number[];

type Stage = 'empty' | 'listening' | 'done' | 'typing';
type Ver = 'formal' | 'casual';

const VERS: { key: Ver; label: string; hint: string }[] = [
  { key: 'formal', label: 'Formal', hint: 'klien, atasan, orang baru' },
  { key: 'casual', label: 'Santai', hint: 'teman, rekan kerja' },
];

export function Bengkel({
  model,
  topic,
  voice,
  speechReady,
  onClose,
  onSave,
  onPick,
}: {
  model: string;
  topic: string;
  voice: string;
  speechReady: boolean;
  onClose: () => void;
  onSave: (en: string, id: string) => void;
  /* kalimat yang lagi dipilih — dipakai layar sesi buat kartu contekan
     waktu bengkelnya ditutup (termasuk kalau ditutup pakai ESC) */
  onPick: (en: string) => void;
}) {
  const [stage, setStage] = useState<Stage>(speechReady ? 'empty' : 'typing');
  const [said, setSaid] = useState('');
  const [draft, setDraft] = useState('');
  const [res, setRes] = useState<Translation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(flat);
  const [lit, setLit] = useState(-1);
  /* kartu yang dipilih (Formal/Santai), posisi geser tiap kartu, dan kalimat
     yang lagi bunyi. Yang dipakai & disimpan = kalimat yang lagi kelihatan
     di kartu yang dipilih. */
  const [pick, setPick] = useState<Ver>('formal');
  const [slide, setSlide] = useState<Record<Ver, number>>({ formal: 0, casual: 0 });
  const [playing, setPlaying] = useState<{ v: Ver; i: number } | null>(null);
  /* per kalimat: nyimpen Formal #1 nggak bikin pilihan lain ikut "tersimpan" */
  const [savedTexts, setSavedTexts] = useState<string[]>([]);
  /* naik tiap hasil baru -> kartu di-remount, geserannya balik ke pilihan pertama */
  const [gen, setGen] = useState(0);
  /* kalimat yang lagi dilatih di "Latih dulu"; null = lagi di layar terjemahan */
  const [drill, setDrill] = useState<string | null>(null);
  const tracks = useRef<Partial<Record<Ver, HTMLDivElement | null>>>({});
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
      setSlide({ formal: 0, casual: 0 });
      setSavedTexts([]);
      setGen((g) => g + 1);
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
      if (e.code !== 'Space' || isField(e.target) || stage === 'typing' || drill) return;
      e.preventDefault();
      if (e.repeat) return;
      void startListen();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target) || stage === 'typing' || drill) return;
      e.preventDefault();
      void stopListen();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [speechReady, stage, busy, drill]);

  function hush() {
    playTok.current++;
    stopSpeaking();
    setPlaying(null);
    setLit(-1);
  }

  async function play(v: Ver, rate: number) {
    if (!res || !speechReady) return;
    const i = slide[v];
    const tok = ++playTok.current;
    const mine = () => playTok.current === tok;
    setPlaying({ v, i });
    setLit(0);
    try {
      await speak(res[v][i], voice, { rate, onWord: (n) => mine() && setLit(n) });
    } catch (e) {
      if (mine()) setErr(e instanceof Error ? e.message : String(e));
    }
    if (!mine()) return; // udah ada yang diputer setelahnya
    setPlaying(null);
    setLit(-1);
  }

  /* geser ke pilihan ke-i di kartu v (dari panah, titik, atau tombol ←/→).
     State-nya diupdate lewat onScroll, jadi swipe jari & klik sama jalurnya. */
  function goSlide(v: Ver, i: number) {
    const el = tracks.current[v];
    if (!el || !res) return;
    const n = res[v].length;
    const to = Math.max(0, Math.min(n - 1, i));
    el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' });
  }

  function onTrackScroll(v: Ver, el: HTMLDivElement) {
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i === slide[v]) return;
    setSlide((s) => ({ ...s, [v]: i }));
    setPick(v); // lagi lihat-lihat pilihan di kartu ini = lagi milih gaya ini
    if (playing?.v === v) hush(); // kalimat yang bunyi udah digeser keluar
  }

  /* kalau pilihan santainya sama persis kayak formal, nggak usah pura-pura ada dua gaya */
  const vers =
    res && res.casual.join('|') !== res.formal.join('|')
      ? VERS
      : [{ key: 'formal' as Ver, label: 'Formal & santai', hint: 'kalimatnya sama aja' }];
  const pickLabel = vers.find((v) => v.key === pick)?.label ?? 'Formal';
  const current = res ? (res[pick][slide[pick]] ?? res[pick][0]) : '';
  const saved = savedTexts.includes(current);

  /* layar sesi ikut tau kalimat mana yang lagi dipilih */
  useEffect(() => {
    onPick(current);
  }, [current, onPick]);

  if (drill) {
    return (
      <div className="bengkel">
        <div className="handle" />
        <Drill
          sentence={drill}
          voice={voice}
          speechReady={speechReady}
          onBack={() => setDrill(null)}
          onReady={onClose}
        />
      </div>
    );
  }

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
                <span className="said-hint">
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
        <div key={gen} className={`verbox${fresh ? ' in' : ''}`}>
          {vers.map((v) => {
            const on = pick === v.key;
            const opts = res[v.key];
            const at = Math.min(slide[v.key], opts.length - 1);
            const many = opts.length > 1;
            return (
              <div
                key={v.key}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`Gaya ${v.label}, pilihan ${at + 1} dari ${opts.length}`}
                className={`ver${on ? ' on' : ''}`}
                onClick={() => setPick(v.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setPick(v.key);
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    goSlide(v.key, at + 1);
                  }
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    goSlide(v.key, at - 1);
                  }
                }}
              >
                <div className="ver-head">
                  <span className={`ver-tag ${v.key}`}>{v.label}</span>
                  <span className="ver-hint">{v.hint}</span>
                  {many && (
                    <span className="ver-count">
                      {at + 1}/{opts.length}
                    </span>
                  )}
                  {vers.length > 1 && (
                    <span className="ver-check">{on && <Icon name="check" size={12} />}</span>
                  )}
                </div>

                {/* digeser kanan-kiri: swipe di HP, trackpad / panah / titik / ←→ di laptop */}
                <div
                  className="ver-track"
                  ref={(el) => {
                    tracks.current[v.key] = el;
                  }}
                  onScroll={(e) => onTrackScroll(v.key, e.currentTarget)}
                >
                  {opts.map((sentence, i) => {
                    const sounding = playing?.v === v.key && playing.i === i;
                    return (
                      <div key={i} className="ver-slide" aria-hidden={i !== at}>
                        <div className="entext">
                          {sentence.split(' ').map((w, j) => (
                            <span key={j} className={sounding && lit >= 0 && j < lit ? 'lit' : ''}>
                              {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="en-acts">
                  <div className="spk-wrap">
                    {playing?.v === v.key && (
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
                      aria-label={`Dengerin ${v.label.toLowerCase()} pilihan ${at + 1}`}
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

                  {many && (
                    <div className="ver-nav" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="ver-arrow"
                        disabled={at === 0}
                        onClick={() => goSlide(v.key, at - 1)}
                        aria-label="Pilihan sebelumnya"
                      >
                        <Icon name="back" size={14} />
                      </button>
                      <div className="ver-dots">
                        {opts.map((_, i) => (
                          <button
                            key={i}
                            className={`ver-dot${i === at ? ' on' : ''}`}
                            onClick={() => goSlide(v.key, i)}
                            aria-label={`Pilihan ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        className="ver-arrow"
                        disabled={at === opts.length - 1}
                        onClick={() => goSlide(v.key, at + 1)}
                        aria-label="Pilihan berikutnya"
                      >
                        <Icon name="back" size={14} className="flip" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {res.note && vers.length > 1 && <p className="ver-note">{res.note}</p>}
        </div>
      ) : (
        <div className="enbox">
          <div className="en-empty">
            {busy ? 'Nyusun kalimatnya...' : 'Hasil Inggrisnya muncul di sini.'}
          </div>
        </div>
      )}

      {/* Aksi nempel di bawah panel, selalu kelihatan tanpa scroll. Dulu tombol besarnya
          "Pakai & Lanjut Ngobrol" padahal cuma nutup panel, sedangkan simpan frasa cuma
          teks pudar di bawahnya yang ketutup di HP. */}
      <div className="bk-foot">
        {res && (
          <p className={`bk-pick${saved ? ' on' : ''}`}>
            {saved
              ? 'Kalimat ini udah ada di koleksi frasa.'
              : `Yang disimpan: ${vers.length > 1 ? pickLabel : 'kalimat di atas'}${
                  res[pick].length > 1 ? ` · pilihan ${slide[pick] + 1}` : ''
                }`}
          </p>
        )}
        {/* latihan kilat 3 langkah — bantuannya makin dikit tiap langkah */}
        {res && (
          <button className="btn ghost bk-drill" onClick={() => setDrill(current)}>
            <Icon name="replay" size={16} />
            Latih dulu biar nempel
          </button>
        )}
        <div className="bk-acts">
          <button className="btn ghost" onClick={onClose}>
            Balik ngobrol
          </button>
          {res && (
            <button
              className={`btn primary${saved ? ' done' : ''}`}
              aria-disabled={saved}
              onClick={() => {
                if (saved) return;
                onSave(current, said);
                setSavedTexts((s) => [...s, current]);
              }}
            >
              <Icon name={saved ? 'check' : 'bookmark'} size={17} />
              {saved ? 'Tersimpan' : 'Simpan frasa'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
