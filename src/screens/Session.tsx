import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Cards } from '../components/icons';
import { Orb, Wave, Beats } from '../components/bits';
import { Bengkel } from '../components/Bengkel';
import { chatStream, type AppConfig, type Correction, type Phrase } from '../lib/api';
import {
  listen,
  stopSpeaking,
  openMeter,
  fakeLevels,
  sentenceSplitter,
  Voice,
  type Meter,
  type Session as Listener,
} from '../lib/speech';
import { situationFor, type Topic } from '../data/topics';

const BARS = 15;
const flat = () => new Array(BARS).fill(7) as number[];

type Phase = 'idle' | 'rec' | 'thinking' | 'talking';
type Line = {
  role: 'ai' | 'me';
  text: string;
  correction?: Correction | null;
  phrase?: Phrase | null;
};

export function Session({
  cfg,
  topic,
  model,
  frasa,
  momentum,
  onExit,
  onPhrase,
}: {
  cfg: AppConfig;
  topic: Topic;
  model: string;
  frasa: number;
  momentum: number;
  onExit: (turns: number) => void;
  onPhrase: (p: Phrase) => void;
}) {
  const speechReady = cfg.speech.ready;
  const voice = cfg.speech.voice;

  const [phase, setPhase] = useState<Phase>('thinking');
  const [lines, setLines] = useState<Line[]>([]);
  const [levels, setLevels] = useState<number[]>(flat);
  const [ms, setMs] = useState(0);
  const [partial, setPartial] = useState('');
  /* kalimat yang udah diucapin tapi sengaja ditahan — nunggu kamu balik
     dari Bengkel buat nyambung. Kekirim ke Zii cuma waktu kamu lepas mic. */
  const [draft, setDraft] = useState('');
  /* null = lagi nggak ngedit. Isinya teks yang lagi dibetulin. */
  const [editing, setEditing] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Record<number, boolean>>({});
  const [flier, setFlier] = useState<{ x: number; y: number; fx: number; fy: number; text: string } | null>(
    null,
  );
  const [bump, setBump] = useState(false);

  const situation = useRef(situationFor(topic));
  const voiceRef = useRef<Voice | null>(null);
  const listener = useRef<Listener | null>(null);
  const meter = useRef<Meter | null>(null);
  const tick = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const counter = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>('thinking');
  const linesRef = useRef<Line[]>([]);
  /* buat "betulin": request yang lagi jalan, layar sebelum bubble-ku nongol,
     dan teks yang barusan dikirim. */
  const abort = useRef<AbortController | null>(null);
  const before = useRef<Line[]>([]);
  const sent = useRef('');
  const editRef = useRef<string | null>(null);
  /* nomor giliran terbaru. Stream lama yang masih jalan di belakang (karena
     Zii disela) ngecek ini biar nggak ngacak-ngacak giliran yang lebih baru. */
  const turnRef = useRef(0);

  phaseRef.current = phase;
  linesRef.current = lines;
  editRef.current = editing;

  const myTurns = lines.filter((l) => l.role === 'me').length;

  /* Pindah fase HARUS lewat sini. phaseRef cuma disinkronin waktu render,
     padahal fungsi-fungsi di bawah nunggu I/O (Azure nutup rekaman, LLM
     streaming) di tengah jalan — dan guard mereka baca phaseRef. Kalau cuma
     setPhase, ada jendela di mana ref-nya masih nilai lama dan event kedua
     lolos guard: itu yang dulu bikin satu giliran kekirim dua kali. */
  const goPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  /* ── ucapin satu teks utuh (buat tombol Ulangi) ─────── */
  const replay = useCallback(
    async (text: string) => {
      if (!speechReady) return;
      voiceRef.current?.kill();
      const v = new Voice(voice);
      voiceRef.current = v;
      goPhase('talking');
      v.push(text);
      await v.drain();
      // disela di tengah? jangan timpa fase yang baru
      if (voiceRef.current === v && phaseRef.current === 'talking') goPhase('idle');
    },
    [speechReady, voice],
  );

  /* ── satu giliran ─────────────────────────────────────
     Graph-nya jalanin balasan + koreksi paralel, dan dua-duanya
     nyampe lewat SATU stream: teks dulu, koreksi nyusul. */
  const send = useCallback(
    async (mine: string | null) => {
      /* titik balik buat "betulin": kondisi layar SEBELUM bubble-ku nongol,
         plus teks yang barusan dikirim biar bisa ditaruh di kotak edit. */
      before.current = linesRef.current;
      sent.current = mine ?? '';
      const ac = new AbortController();
      abort.current = ac;

      const base = mine
        ? [...linesRef.current, { role: 'me' as const, text: mine }]
        : linesRef.current;

      /* Koreksi nempel by INDEX, bukan "kalimat-ku terakhir" — dia dateng
         belakangan, dan kalau user udah ngomong lagi "terakhir" udah pindah. */
      const myIndex = mine ? base.length - 1 : -1;
      /* Sama buat teks balasan: stream ini boleh disela dan tetap jalan di
         belakang sampai habis. Kalau user udah kirim giliran baru, "bubble AI
         terakhir" itu udah punya giliran baru — jadi tulis ke slot SENDIRI. */
      const aiIndex = base.length;
      const turn = ++turnRef.current;
      const live = () => turnRef.current === turn;

      setErr(null);
      goPhase('thinking');
      setLines([...base, { role: 'ai', text: '' }]);

      voiceRef.current?.kill();
      const v = new Voice(voice);
      voiceRef.current = v;
      const chunks = sentenceSplitter((s) => {
        if (speechReady) v.push(s);
      });

      const attach = (r: { correction: Correction | null; phrase: Phrase | null }) => {
        if (myIndex < 0 || (!r.correction && !r.phrase)) return;
        setLines((prev) => {
          const target = prev[myIndex];
          if (!target || target.role !== 'me' || target.text !== mine) return prev;
          const next = [...prev];
          next[myIndex] = { ...target, correction: r.correction, phrase: r.phrase };
          return next;
        });
      };

      let opened = false;
      try {
        await chatStream(
          {
            model,
            topic: topic.name,
            situation: situation.current,
            history: base.map((l) => ({ role: l.role, text: l.text })),
          },
          (delta) => {
            if (!opened) {
              opened = true;
              if (live() && phaseRef.current === 'thinking') goPhase('talking');
            }
            setLines((prev) => {
              const slot = prev[aiIndex];
              if (!slot || slot.role !== 'ai') return prev;
              const next = [...prev];
              next[aiIndex] = { ...slot, text: slot.text + delta };
              return next;
            });
            chunks.push(delta); // suara yang udah di-kill diem aja, teksnya tetap nambah
          },
          attach,
          ac.signal,
        );
        chunks.flush();
      } catch (e) {
        v.kill();
        /* dibatalin sengaja lewat "betulin" — bukan error, dan layarnya
           udah diurus di sana. Jangan timpa apa pun. */
        if (e instanceof Error && e.name === 'AbortError') return;
        if (!live()) return; // udah ada giliran baru — jangan diganggu
        setErr(e instanceof Error ? e.message : String(e));
        // buang slot balasan kalau masih kosong; kalau udah sempat keisi, biarin
        setLines((prev) =>
          prev[aiIndex]?.role === 'ai' && !prev[aiIndex].text
            ? prev.filter((_, i) => i !== aiIndex)
            : prev,
        );
        if (phaseRef.current === 'thinking' || phaseRef.current === 'talking') goPhase('idle');
        return;
      }

      await v.drain();
      /* Cuma balik ke idle kalau fase-nya masih punya giliran ini. Kalau Zii
         udah disela dan kamu lagi ngomong ('rec'), jangan ditimpa — dulu ini
         bikin omongan kamu hilang di tengah jalan. */
      if (live() && (phaseRef.current === 'thinking' || phaseRef.current === 'talking')) {
        goPhase('idle');
      }
    },
    [model, topic.name, voice, speechReady],
  );

  /* pembuka */
  useEffect(() => {
    void send(null);
    return () => {
      /* Batalin stream-nya juga, bukan cuma suaranya. StrictMode (dev) jalanin
         efek ini dua kali: tanpa abort, dua salam pembuka jalan barengan dan
         nulis ke bubble yang sama ("...so far?Hi, I'm glad..."). Keluar sesi
         pas Zii masih nulis juga jadi berhenti makan token. */
      abort.current?.abort();
      voiceRef.current?.kill();
      stopSpeaking();
      if (tick.current) clearInterval(tick.current);
      meter.current?.close();
      void listener.current?.stop();
    };
    // sengaja sekali saja, saat sesi dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [lines, phase]);

  /* ── push to talk ────────────────────────────────────── */
  const startRec = useCallback(async () => {
    /* Nyela: Zii lagi ngomong, kamu mulai ngomong -> suaranya dimatiin, kamu
       langsung jalan. Teks balasannya tetap di layar & riwayat — yang dipotong
       cuma suaranya. */
    if (phaseRef.current === 'talking' && !paused && speechReady && editRef.current === null) {
      voiceRef.current?.kill();
      goPhase('idle');
    }
    if (phaseRef.current !== 'idle' || paused || !speechReady || editRef.current !== null) return;
    /* goPhase duluan, sebelum `await openMeter()` / `await listen()`: tanpa
       itu spasi yang diketuk cepat dua kali bisa lolos guard barengan dan
       bikin dua sesi Azure — yang satu bakal bocor. */
    goPhase('rec');
    setErr(null);
    setPartial('');
    setMs(0);
    try {
      meter.current = meter.current ?? (await openMeter());
      tick.current = window.setInterval(() => {
        setLevels(meter.current ? meter.current.read(BARS) : fakeLevels(BARS));
        setMs((m) => m + 90);
      }, 90);
      listener.current = await listen('en-US', setPartial);
    } catch (e) {
      if (tick.current) clearInterval(tick.current);
      setLevels(flat());
      setErr(e instanceof Error ? e.message : String(e));
      goPhase('idle');
    }
  }, [paused, speechReady]);

  const stopRec = useCallback(async () => {
    if (phaseRef.current !== 'rec') return;
    /* Kunci DULUAN, sebelum `await l.stop()`. Tanpa ini, spasi yang diketuk
       berkali-kali bisa masuk lagi ke sini selagi Azure masih nutup rekaman:
       guard-nya lolos (phaseRef belum keburu berubah), `listener` udah null,
       jadi dia jatuh ke `partial` dan ngirim giliran yang sama untuk kedua
       kalinya — versi live-nya, tanpa tanda baca final. */
    goPhase('thinking');
    sent.current = ''; // belum ada yang beneran kekirim: jangan tawarin "betulin" dulu
    if (tick.current) clearInterval(tick.current);
    setLevels(flat());
    const l = listener.current;
    listener.current = null;
    const text = l ? await l.stop() : partial;
    setPartial('');
    /* draft = kalimat yang tadi ketahan waktu mampir ke Bengkel. Disambung
       di depan, jadi Zii nerima satu giliran utuh, bukan potongan. */
    const whole = [draft, text.trim()].filter(Boolean).join(' ');
    if (!whole) {
      goPhase('idle');
      return;
    }
    setDraft('');
    await send(whole);
  }, [partial, draft, send]);

  /* TAHAN rekaman: mic dimatiin, tapi yang udah diucapin disimpen di draft
     — bukan dibuang, bukan dikirim. Ini yang bikin kamu bisa ngomong dua
     kalimat, mentok di kalimat ketiga, kabur ke Bengkel, terus balik lagi
     nyambung dari tempat yang sama. */
  const holdRec = useCallback(async () => {
    if (phaseRef.current !== 'rec') return;
    /* goPhase duluan: handler keyup bisa nembak sebelum React render ulang. */
    goPhase('idle');
    if (tick.current) clearInterval(tick.current);
    setLevels(flat());
    const l = listener.current;
    listener.current = null;
    /* stop() cuma balikin segmen yang udah difinalisasi Azure. Di sini kita
       sering motong persis di tengah kata, jadi ekor kalimatnya bisa ketinggal
       — `partial` (hasil recognizing) biasanya lebih panjang. Ambil yang
       terpanjang biar nggak ada yang hilang. */
    const settled = l ? await l.stop() : '';
    const text = settled.length >= partial.length ? settled : partial;
    setPartial('');
    const t = text.trim();
    if (t) setDraft((d) => (d ? `${d} ${t}` : t));
  }, [partial]);

  const openBengkel = useCallback(() => {
    voiceRef.current?.kill();
    void holdRec(); // lagi ngerekam? tahan dulu, jangan hilang
    if (phaseRef.current === 'talking') goPhase('idle');
    setPaused(true);
  }, [holdRec]);

  /* Tarik balik giliran yang barusan dikirim, sebelum Zii sempat nyaut.
     Dipicu waktu kamu ketuk SPASI lagi pas Zii masih mikir — biasanya
     karena kamu lihat speech-to-text-nya salah dengar. */
  const betulin = useCallback(() => {
    const mine = sent.current;
    if (!mine) return; // giliran pembuka: nggak ada kalimatku buat dibetulin

    abort.current?.abort();
    voiceRef.current?.kill();
    stopSpeaking();

    /* buang bubble-ku + slot balasan Zii. Potong by panjang, bukan balik ke
       snapshot: balasan Zii sebelumnya bisa masih nambah teks di belakang
       (kalau tadi disela), dan itu jangan ikut kebuang. */
    const keep = before.current.length;
    setLines((prev) => prev.slice(0, keep));
    goPhase('idle');
    setErr(null);
    setPartial('');
    sent.current = '';
    setEditing(mine);
  }, []);

  /* spasi = push to talk (desktop), M = kabur ke Bengkel,
     SPASI lagi pas Zii mikir = betulin */
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (isField(e.target) || paused) return;

      /* M sengaja dipilih karena sebaris sama spasi: lagi nahan spasi terus
         blank, jempol tinggal geser — nggak usah raih mouse. */
      if (e.code === 'KeyM') {
        e.preventDefault();
        if (e.repeat) return;
        openBengkel();
        return;
      }

      if (e.code !== 'Space') return;
      e.preventDefault();
      if (e.repeat) return;

      /* Jendela "betulin": dari kamu lepas spasi sampai Zii mulai bersuara.
         Di periode ini mic emang udah mati, jadi spasi nganggur — aman
         dipakai buat narik balik kalimat yang salah didengar. */
      if (phaseRef.current === 'thinking') {
        betulin();
        return;
      }

      void startRec();
    };
    const up = (e: KeyboardEvent) => {
      /* `paused` wajib dicek: kalau spasi masih ketahan waktu Bengkel kebuka,
         tanpa ini lepas spasi bakal ngirim kalimat separuh ke Zii. */
      if (e.code !== 'Space' || isField(e.target) || paused) return;
      e.preventDefault();
      void stopRec();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paused) setPaused(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('keydown', esc);
    };
  }, [startRec, stopRec, openBengkel, betulin, paused]);

  /* ── tangkap frasa: animasi terbang ke counter ───────── */
  function grab(i: number, p: Phrase, e: React.MouseEvent) {
    if (grabbed[i]) return;
    setGrabbed((g) => ({ ...g, [i]: true }));
    onPhrase(p);

    const from = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const to = counter.current?.getBoundingClientRect();
    if (to) {
      setFlier({
        x: from.left,
        y: from.top,
        fx: to.left - from.left,
        fy: to.top - from.top,
        text: p.en,
      });
      window.setTimeout(() => {
        setFlier(null);
        setBump(true);
        window.setTimeout(() => setBump(false), 600);
      }, 900);
    } else {
      setBump(true);
      window.setTimeout(() => setBump(false), 600);
    }
  }

  const status =
    phase === 'rec'
      ? 'kamu ngomong...'
      : phase === 'thinking'
        ? 'Zii mikir...'
        : phase === 'talking'
          ? 'Zii ngomong'
          : 'siap dengerin kamu';
  const secs = Math.floor(ms / 1000);

  return (
    <div className="sess">
      {/* rail kiri: desktop */}
      <div className="rail">
        <div className="rail-logo">
          <Orb size={30} rings={false} />
          <b>Zii Talk</b>
        </div>
        <div className="rail-stats">
          <div className="rail-stat" style={{ background: '#FFF6EF' }}>
            <div>
              <b>{momentum}</b>
              <span>hari</span>
            </div>
          </div>
          <div className="rail-stat" style={{ background: '#FFF9EC' }}>
            <Cards size={18} />
            <div>
              <b>{frasa}</b>
              <span>frasa</span>
            </div>
          </div>
        </div>
        <div className="rail-lbl">SESI INI</div>
        <div className="rail-item on">
          <i style={{ background: topic.tint, color: topic.ink }}>
            <Icon name={topic.icon} size={17} />
          </i>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{topic.name}</b>
            <span>{myTurns} giliran kamu</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="rail-item" onClick={() => onExit(myTurns)}>
          <i style={{ background: '#F4EBF5', color: 'var(--ink-soft)' }}>
            <Icon name="back" size={17} />
          </i>
          <div>
            <b>Selesai sesi</b>
          </div>
        </button>
      </div>

      {/* tengah */}
      <div className="sess-main">
        <div className="sess-head safe-top">
          <button className="icon-btn" onClick={() => onExit(myTurns)} aria-label="Keluar">
            <Icon name="back" size={19} />
          </button>
          <div className="sess-title">
            <b>{topic.name}</b>
            <span>{status}</span>
          </div>
          <div
            ref={counter}
            className={`stat${bump ? ' pop' : ''}`}
            style={{ background: '#FFF3D6', boxShadow: '0 2px 0 #F2DFA9' }}
          >
            <Cards size={15} />
            <b style={{ color: 'var(--amber-ink)' }}>{frasa}</b>
          </div>
        </div>

        <Beats done={Math.min(6, myTurns)} />

        <div className="presence">
          <Orb
            size={64}
            mode={
              phase === 'thinking'
                ? 'think'
                : phase === 'talking'
                  ? 'talk'
                  : phase === 'rec'
                    ? 'hush'
                    : 'idle'
            }
          />
          <small>ZII</small>
        </div>

        {err && <div className="err">{err}</div>}

        {paused && (
          <div className="band">
            <i>
              <Icon name="pause" size={16} />
            </i>
            <div style={{ flex: 1 }}>
              <b>DIJEDA</b>
              <span>Obrolan nggak jalan. Santai aja.</span>
            </div>
          </div>
        )}

        <div ref={scroller} className={`transcript scroll${paused ? ' dimmed' : ''}`}>
          <div className="transcript-in">
            {lines.map((l, i) => {
              const isLastAi = l.role === 'ai' && i === lines.length - 1;
              const streaming = isLastAi && (phase === 'talking' || phase === 'thinking');

              return (
                <div key={i}>
                  <div className={`turn ${l.role}`}>
                    <div style={{ maxWidth: '100%' }}>
                      <div className="bubble">
                        {l.text}
                        {streaming && <span className="caret" style={{ background: 'var(--ink)' }} />}
                      </div>
                      {l.role === 'ai' && l.text && phase === 'idle' && (
                        <div className="bubble-acts">
                          <button
                            className="chip"
                            disabled={!speechReady}
                            onClick={() => void replay(l.text)}
                          >
                            <Icon name="speakerSmall" size={14} />
                            Ulangi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {l.correction && (
                    <div className="turn me" style={{ marginTop: -4 }}>
                      <Fix
                        c={l.correction}
                        p={l.phrase ?? null}
                        grabbed={!!grabbed[i]}
                        onGrab={(e) => l.phrase && grab(i, l.phrase, e)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {(draft || (phase === 'rec' && partial)) && (
              <div className="turn me">
                <div className="draft-wrap">
                  <div className="bubble draft">
                    {[draft, partial].filter(Boolean).join(' ')}
                    {phase === 'rec' && (
                      <span className="caret" style={{ background: 'var(--tang-dark)' }} />
                    )}
                  </div>
                  {draft && phase !== 'rec' && (
                    <div className="draft-foot">
                      <span>ketahan &mdash; lanjut ngomong buat nyambung</span>
                      <button type="button" onClick={() => setDraft('')}>
                        buang
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editing !== null && (
              <div className="turn me">
                <div className="edit-wrap">
                  <input
                    className="edit-box"
                    autoFocus
                    value={editing}
                    onChange={(e) => setEditing(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = editing.trim();
                        setEditing(null);
                        if (t) void send(t);
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        /* jadiin draft — biar bisa lanjut ngomong nyambung
                           dari kalimat yang udah dibetulin */
                        e.stopPropagation();
                        setDraft(editing.trim());
                        setEditing(null);
                      }
                    }}
                  />
                  <div className="edit-foot">
                    <span className="kbd">ENTER</span> kirim &middot;{' '}
                    <span className="kbd">ESC</span> lanjut ngomong
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* dock */}
        {!paused && (
          <div className="dock">
            <div className="dock-status">
              {phase === 'rec' ? (
                <>
                  <Wave levels={levels} />
                  <span className="clock">{`0:${secs < 10 ? '0' : ''}${secs}`}</span>
                </>
              ) : phase === 'idle' ? (
                speechReady ? (
                  <span className="txt">
                    {draft ? (
                      <>
                        Tahan <span className="kbd live">SPASI</span> buat nerusin kalimatmu
                      </>
                    ) : (
                      <>
                        Tahan <span className="kbd live">SPASI</span> atau mic &middot;{' '}
                        <span className="kbd">M</span> kalau blank
                      </>
                    )}
                  </span>
                ) : (
                  <span className="txt">Azure Speech belum aktif — isi AZURE_SPEECH_KEY di .env</span>
                )
              ) : phase === 'thinking' && sent.current ? (
                /* jendela betulin — cuma ditawarin kalau emang ada kalimatku
                   yang barusan kekirim (giliran pembuka nggak ada) */
                <span className="txt">
                  Zii nyusun jawaban &middot; <span className="kbd live">SPASI</span> kalau salah
                  dengar
                </span>
              ) : (
                <span className="txt">
                  {phase === 'thinking' ? (
                    'Zii nyusun jawaban...'
                  ) : (
                    <>
                      Zii lagi ngomong &middot; <span className="kbd live">SPASI</span> buat nyela
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="dock-row">
              <div className="dock-col">
                <button className="round sky b3d" onClick={openBengkel} aria-label="Jeda dan terjemah">
                  <Icon name="pauseTranslate" size={24} />
                </button>
                <span style={{ color: 'var(--sky-dark)' }}>
                  Jeda &amp;<br />
                  Terjemah
                </span>
              </div>

              <div className="mic-wrap">
                {phase === 'idle' && speechReady && <div className="mic-halo" />}
                <button
                  className={`mic${phase === 'rec' ? ' rec' : ''}`}
                  disabled={phase === 'thinking' || !speechReady}
                  onPointerDown={startRec}
                  onPointerUp={stopRec}
                  onPointerLeave={stopRec}
                  onPointerCancel={stopRec}
                  aria-label="Tahan buat ngomong"
                >
                  <Icon name={speechReady ? 'mic' : 'micOff'} size={40} />
                </button>
              </div>

              {/* pengganti tombol Potong yang udah dihapus — cuma ngimbangin
                  kolom "Jeda & Terjemah" biar mic tetap persis di tengah */}
              <div className="dock-col" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      {/* panel kanan / sheet bawah */}
      {paused && (
        <div className="side">
          <Bengkel
            model={model}
            topic={topic.name}
            voice={voice}
            speechReady={speechReady}
            onSave={(en, id) => {
              onPhrase({ en, id });
              setBump(true);
              window.setTimeout(() => setBump(false), 600);
            }}
            onClose={() => setPaused(false)}
          />
        </div>
      )}

      {flier && (
        <div
          className="flier"
          style={
            {
              left: flier.x,
              top: flier.y,
              '--fx': `${flier.fx}px`,
              '--fy': `${flier.fy}px`,
            } as React.CSSProperties
          }
        >
          <Icon name="bookmark" size={15} />
          {flier.text.slice(0, 28)}
          {flier.text.length > 28 ? '…' : ''}
        </div>
      )}
    </div>
  );
}

function Fix({
  c,
  p,
  grabbed,
  onGrab,
}: {
  c: Correction;
  p: Phrase | null;
  grabbed: boolean;
  onGrab: (e: React.MouseEvent) => void;
}) {
  const [why, setWhy] = useState(false);
  return (
    <div className="fix">
      <div className="fix-top">
        <i>
          <Icon name="check" size={14} />
        </i>
        <b>Hampir bener!</b>
      </div>
      <div className="fix-diff">
        {c.wrong && <span className="fix-was">{c.wrong}</span>}
        <Icon name="right" size={15} className="ar" />
        <span className="fix-now">{c.right}</span>
      </div>
      {why && c.why && <div className="fix-why">{c.why}</div>}
      <div className="fix-acts">
        {p && (
          <button className={`grab b3d${grabbed ? ' done' : ''}`} onClick={onGrab}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={grabbed ? '#fff' : 'none'}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6.4 3.6h11.2v17l-5.6-4.2-5.6 4.2v-17Z" />
            </svg>
            {grabbed ? 'Masuk koleksi!' : 'Tangkap frasa'}
          </button>
        )}
        {c.why && (
          <button className="ghost" onClick={() => setWhy(!why)}>
            Kenapa?
            <Icon name="chevron" size={13} className={why ? 'rot' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
