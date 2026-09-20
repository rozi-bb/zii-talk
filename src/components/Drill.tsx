import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { grade, initials } from '../lib/match';
import { listen, speak, stopSpeaking, type Session } from '../lib/speech';
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
  voice,
  speechReady,
  onBack,
  onReady,
}: {
  sentence: string;
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
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ses = useRef<Session | null>(null);
  const box = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
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

  async function mic() {
    if (!speechReady) return;
    if (rec) {
      const s = ses.current;
      ses.current = null;
      setRec(false);
      const text = s ? await s.stop() : '';
      if (text.trim()) setSaid(text.trim());
      return;
    }
    setErr(null);
    setRec(true);
    try {
      ses.current = await listen('en-US', setSaid);
    } catch (e) {
      setRec(false);
      setErr(errText(e));
    }
  }

  function check() {
    if (!said.trim() || result) return;
    setResult(grade(said, sentence));
  }

  function retry() {
    setSaid('');
    setResult(null);
    window.setTimeout(() => box.current?.focus(), 0);
  }

  function next() {
    if (step >= STEPS.length - 1) {
      onReady();
      return;
    }
    setStep(step + 1);
    setSaid('');
    setResult(null);
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
              placeholder={speechReady ? 'Ketik atau pakai mic' : 'Ketik kalimatnya'}
              disabled={!!result}
              onChange={(e) => setSaid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (result) next();
                else check();
              }}
            />
            {speechReady && !result && (
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
          <span>
            {result === 'pas'
              ? 'Mantap, lanjut.'
              : 'Nggak apa-apa — bandingin sama kalimat di atas, terus coba lagi.'}
          </span>
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
            <button className="btn primary" disabled={!said.trim()} onClick={check}>
              Cek
            </button>
            <button className="btn ghost" onClick={next}>
              Lewati
            </button>
          </>
        )}
      </div>
    </div>
  );
}
