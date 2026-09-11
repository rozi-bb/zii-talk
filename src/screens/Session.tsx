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
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Record<number, boolean>>({});
  const [savedBK, setSavedBK] = useState(false);
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

  phaseRef.current = phase;
  linesRef.current = lines;

  const myTurns = lines.filter((l) => l.role === 'me').length;

  /* ── ucapin satu teks utuh (buat tombol Ulangi) ─────── */
  const replay = useCallback(
    async (text: string) => {
      if (!speechReady) return;
      voiceRef.current?.kill();
      const v = new Voice(voice);
      voiceRef.current = v;
      setPhase('talking');
      v.push(text);
      await v.drain();
      setPhase('idle');
    },
    [speechReady, voice],
  );

  /* ── satu giliran ─────────────────────────────────────
     Graph-nya jalanin balasan + koreksi paralel, dan dua-duanya
     nyampe lewat SATU stream: teks dulu, koreksi nyusul. */
  const send = useCallback(
    async (mine: string | null) => {
      const base = mine
        ? [...linesRef.current, { role: 'me' as const, text: mine }]
        : linesRef.current;

      /* Koreksi nempel by INDEX, bukan "kalimat-ku terakhir" — dia dateng
         belakangan, dan kalau user udah ngomong lagi "terakhir" udah pindah. */
      const myIndex = mine ? base.length - 1 : -1;

      setErr(null);
      setPhase('thinking');
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
              setPhase('talking');
            }
            setLines((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'ai') {
                next[next.length - 1] = { ...last, text: last.text + delta };
              }
              return next;
            });
            chunks.push(delta);
          },
          attach,
        );
        chunks.flush();
      } catch (e) {
        v.kill();
        setErr(e instanceof Error ? e.message : String(e));
        setLines(base); // buang slot balasan yang kosong
        setPhase('idle');
        return;
      }

      await v.drain();
      setPhase('idle');
    },
    [model, topic.name, voice, speechReady],
  );

  /* pembuka */
  useEffect(() => {
    void send(null);
    return () => {
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
    if (phaseRef.current !== 'idle' || paused || !speechReady) return;
    setErr(null);
    setPartial('');
    setMs(0);
    setPhase('rec');
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
      setPhase('idle');
    }
  }, [paused, speechReady]);

  const stopRec = useCallback(async () => {
    if (phaseRef.current !== 'rec') return;
    if (tick.current) clearInterval(tick.current);
    setLevels(flat());
    const l = listener.current;
    listener.current = null;
    const text = l ? await l.stop() : partial;
    setPartial('');
    if (!text.trim()) {
      setPhase('idle');
      return;
    }
    await send(text.trim());
  }, [partial, send]);

  /* spasi = push to talk (desktop) */
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target) || paused) return;
      e.preventDefault();
      if (e.repeat) return;
      void startRec();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target)) return;
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
  }, [startRec, stopRec, paused]);

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

  const openBengkel = () => {
    voiceRef.current?.kill();
    if (phaseRef.current === 'talking') setPhase('idle');
    setSavedBK(false);
    setPaused(true);
  };

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

            {phase === 'rec' && partial && (
              <div className="turn me">
                <div
                  className="bubble"
                  style={{
                    background: '#FFF1E8',
                    color: '#4A3E5C',
                    boxShadow: 'none',
                    border: '2px dashed #FFB08A',
                  }}
                >
                  {partial}
                  <span className="caret" style={{ background: 'var(--tang-dark)' }} />
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
                    Tahan <span className="kbd live">SPASI</span> atau klik &amp; tahan mic
                  </span>
                ) : (
                  <span className="txt">Azure Speech belum aktif — isi AZURE_SPEECH_KEY di .env</span>
                )
              ) : (
                <span className="txt">
                  {phase === 'thinking' ? 'Zii nyusun jawaban...' : 'Zii lagi ngomong'}
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
                  disabled={phase === 'thinking' || phase === 'talking' || !speechReady}
                  onPointerDown={startRec}
                  onPointerUp={stopRec}
                  onPointerLeave={stopRec}
                  onPointerCancel={stopRec}
                  aria-label="Tahan buat ngomong"
                >
                  <Icon name={speechReady ? 'mic' : 'micOff'} size={40} />
                </button>
              </div>

              <div className="dock-col">
                <button
                  className="round plain b3d"
                  disabled={phase !== 'talking'}
                  onClick={() => {
                    voiceRef.current?.kill();
                    setPhase('idle');
                  }}
                  aria-label="Potong"
                >
                  <Icon name="stop" size={22} />
                </button>
                <span style={{ color: 'var(--ink-soft)' }}>Potong</span>
              </div>
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
            saved={savedBK}
            onSave={(en, id) => {
              onPhrase({ en, id });
              setSavedBK(true);
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
