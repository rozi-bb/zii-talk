import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { initials, judge } from '../lib/match';
import { listen, speak, stopSpeaking, type Session } from '../lib/speech';
import { useSpaceToTalk } from '../lib/useSpaceToTalk';
import type { ReviewResult } from '../lib/api';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const STEPS = [
  { title: 'Dengerin, terus tirukan keras-keras.', hint: 'Kalimatnya masih kelihatan.' },
  { title: 'Sekarang cuma huruf awalnya.', hint: 'Ucapkan atau ketik kalimat lengkapnya.' },
  { title: 'Terakhir: tanpa petunjuk.', hint: 'Kalau nyantol di sini, pas balik ngobrol tinggal pakai.' },
];

const LABEL: Record<ReviewResult, string> = { pas: 'Pas!', hampir: 'Hampir', belum: 'Belum pas' };

/* "Latih dulu": tiga langkah dengan bantuan yang makin sedikit — lihat, huruf
   awal, lalu tanpa petunjuk. Tujuannya biar kalimatnya nempel beberapa detik
   yang dibutuhin buat balik ngobrol, bukan dihafal mati. */
export function Drill({
  sentence,
  meaning,
  model,
  voice,
  speechReady,
  onBack,
  onReady,
}: {
  sentence: string;
  /* kalimat Indonesia yang tadi diterjemahin — patokan makna buat penilai */
  meaning: string;
  model: string;
  voice: string;
  speechReady: boolean;
  /* batal, balik ke hasil terjemahan */
  onBack: () => void;
  /* selesai — balik ngobrol bawa kalimat ini */
  onReady: () => void;
}) {
  const [step, setStep] = useState(0);
  const [said, setSaid] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [note, setNote] = useState<{ why: string | null; better: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  /* naik tiap ganti langkah / coba lagi: penilaian telat nggak nempel ke langkah lain */
  const gradeTok = useRef(0);
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ses = useRef<Session | null>(null);
  const box = useRef<HTMLInputElement | null>(null);
  /* mic distop (atau panelnya ditutup) sebelum Azure kelar nyambung:
     `listen()` yang nyusul langsung dimatiin, jangan ditinggal nyala */
  const micTok = useRef(0);

  useEffect(() => {
    return () => {
      micTok.current++;
      gradeTok.current++;
      stopSpeaking();
      void ses.current?.stop();
    };
  }, []);

  async function play(rate: number) {
    if (!speechReady || playing) return;
    setPlaying(true);
    try {
      await speak(sentence, voice, { rate });
    } catch (e) {
      setErr(errText(e));
    }
    setPlaying(false);
  }

  async function stopMic() {
    micTok.current++; // batalin `listen()` yang mungkin masih nyambung
    const s = ses.current;
    ses.current = null;
    setRec(false);
    const text = s ? await s.stop() : '';
    if (text.trim()) setSaid(text.trim());
  }

  async function mic() {
    if (!speechReady) return;
    if (rec) {
      await stopMic();
      return;
    }
    await startMic();
  }

  /* ketuk mic buat mulai/berhenti; di keyboard: tahan SPASI */
  async function startMic() {
    if (!speechReady || ses.current) return;
    setErr(null);
    setRec(true);
    const mine = ++micTok.current;
    try {
      const s = await listen('en-US', setSaid);
      if (micTok.current !== mine) {
        void s.stop();
        return;
      }
      ses.current = s;
    } catch (e) {
      setRec(false);
      setErr(errText(e));
    }
  }

  useSpaceToTalk(speechReady && step > 0 && !result && !checking, () => void startMic(), () => void stopMic());

  async function check() {
    if (!said.trim() || result || checking) return;
    const mine = ++gradeTok.current;
    setChecking(true);
    const v = await judge({ model, meaning, target: sentence, answer: said.trim() });
    if (gradeTok.current !== mine) return;
    setChecking(false);
    setResult(v.result);
    setNote({ why: v.why, better: v.better });
  }

  function reset() {
    gradeTok.current++;
    setChecking(false);
    setSaid('');
    setResult(null);
    setNote(null);
  }

  function retry() {
    reset();
    window.setTimeout(() => box.current?.focus(), 0);
  }

  function next() {
    if (step >= STEPS.length - 1) {
      onReady();
      return;
    }
    setStep(step + 1);
    reset();
    window.setTimeout(() => box.current?.focus(), 0);
  }

  return (
    <div className="drill">
      <div className="bk-head">
        <div style={{ flex: 1 }}>
          <b>Latih dulu</b>
          <p>Biar kalimatnya nempel sebelum kamu balik ngobrol.</p>
        </div>
        <button className="x" onClick={onBack} aria-label="Balik ke hasil terjemahan">
          <Icon name="back" size={16} />
        </button>
      </div>

      <div className="drill-bar">
        {STEPS.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
        <span>
          Langkah {step + 1} dari {STEPS.length}
        </span>
      </div>

      <p className="drill-step">
        <b>{STEPS[step].title}</b>
        {STEPS[step].hint}
      </p>

      <div className="drill-target">
        {step === 0 || result ? (
          <b lang="en">{sentence}</b>
        ) : step === 1 ? (
          <span className="drill-hint" lang="en">
            {initials(sentence)}
          </span>
        ) : (
          <span className="drill-blank">Nggak ada petunjuk — ingat-ingat sendiri.</span>
        )}
      </div>

      {speechReady && (
        <div className="drill-play">
          <button className="btn sm ghost" disabled={playing} onClick={() => void play(1)}>
            <Icon name="speakerSmall" size={15} />
            Dengerin
          </button>
          <button className="btn sm ghost" disabled={playing} onClick={() => void play(0.7)}>
            <Icon name="clock2" size={14} />
            Pelanin
          </button>
        </div>
      )}

      {err && <div className="err drill-err">{err}</div>}

      {step > 0 && (
        <label className="fld drill-fld">
          <span>Ucapkan atau ketik</span>
          <div className="pw">
            <input
              ref={box}
              lang="en"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={said}
              placeholder={speechReady ? 'Ketik, atau tahan SPASI buat ngomong' : 'Ketik kalimatnya'}
              disabled={!!result || checking}
              onChange={(e) => setSaid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (result) next();
                else void check();
              }}
            />
            {speechReady && !result && !checking && (
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
      )}

      {result && (
        <div className={`rv-res ${result}`}>
          <b>{LABEL[result]}</b>
          {note?.why && <p className="rv-why">{note.why}</p>}
          <span>
            {result === 'pas'
              ? 'Mantap, lanjut.'
              : 'Nggak apa-apa — bandingin sama kalimat di atas, terus coba lagi.'}
          </span>
        </div>
      )}

      {note?.better && (
        <div className="rv-better">
          <small>Kalimatmu, dirapiin</small>
          <b lang="en">{note.better}</b>
        </div>
      )}

      <div className="drill-acts">
        {step === 0 ? (
          <button className="btn primary" onClick={next}>
            Udah, lanjut
          </button>
        ) : result ? (
          <>
            <button className="btn primary" onClick={next}>
              {step >= STEPS.length - 1 ? 'Siap, balik ngobrol' : 'Lanjut'}
            </button>
            {result !== 'pas' && (
              <button className="btn ghost" onClick={retry}>
                Coba lagi
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn primary" disabled={!said.trim() || checking} onClick={() => void check()}>
              {checking ? (
                <>
                  <span className="spin" /> Ngecek…
                </>
              ) : (
                'Cek'
              )}
            </button>
            <button className="btn ghost" disabled={checking} onClick={next}>
              Lewati
            </button>
          </>
        )}
      </div>
    </div>
  );
}
