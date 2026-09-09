import * as SDK from 'microsoft-cognitiveservices-speech-sdk';

/* Token Azure umurnya 10 menit; kita perbarui tiap 8 menit. */
let cached: { token: string; region: string; at: number } | null = null;

async function auth() {
  if (cached && Date.now() - cached.at < 8 * 60 * 1000) return cached;
  const r = await fetch('/api/speech/token');
  const j = (await r.json().catch(() => ({}))) as { error?: string; token?: string; region?: string };
  if (!r.ok || !j.token || !j.region) throw new Error(j.error ?? 'Gagal ambil token Azure Speech');
  cached = { token: j.token, region: j.region, at: Date.now() };
  return cached;
}

async function speechConfig(lang?: string) {
  const { token, region } = await auth();
  const c = SDK.SpeechConfig.fromAuthorizationToken(token, region);
  if (lang) c.speechRecognitionLanguage = lang;
  return c;
}

/* ── dengerin (push to talk) ──────────────────────────── */
export type Session = { stop: () => Promise<string> };

export async function listen(lang: string, onPartial: (text: string) => void): Promise<Session> {
  const cfg = await speechConfig(lang);
  const rec = new SDK.SpeechRecognizer(cfg, SDK.AudioConfig.fromDefaultMicrophoneInput());

  let settled = '';
  const join = (extra: string) => (settled ? `${settled} ${extra}` : extra).trim();

  rec.recognizing = (_s, e) => onPartial(join(e.result.text));
  rec.recognized = (_s, e) => {
    if (e.result.reason === SDK.ResultReason.RecognizedSpeech && e.result.text) {
      settled = join(e.result.text);
      onPartial(settled);
    }
  };

  await new Promise<void>((res, rej) =>
    rec.startContinuousRecognitionAsync(
      () => res(),
      (err) => rej(new Error(String(err))),
    ),
  );

  return {
    stop: () =>
      new Promise<string>((res) => {
        const done = () => {
          try {
            rec.close();
          } catch {
            /* udah ketutup */
          }
          res(settled.trim());
        };
        rec.stopContinuousRecognitionAsync(done, done);
      }),
  };
}

/* ── ngomong ──────────────────────────────────────────── */
let player: SDK.SpeakerAudioDestination | null = null;

export function stopSpeaking() {
  try {
    player?.pause();
    player?.close();
  } catch {
    /* nggak apa-apa */
  }
  player = null;
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );

/**
 * Ngomongin `text`. `onWord` kepanggil tiap Azure lewat satu kata —
 * dipakai buat munculin teks pas sinkron sama suaranya.
 */
export async function speak(
  text: string,
  voice: string,
  opts: { rate?: number; onWord?: (index: number) => void } = {},
): Promise<void> {
  stopSpeaking();
  const rate = opts.rate ?? 1;
  const cfg = await speechConfig();
  cfg.speechSynthesisVoiceName = voice;

  const dest = new SDK.SpeakerAudioDestination();
  player = dest;
  const syn = new SDK.SpeechSynthesizer(cfg, SDK.AudioConfig.fromSpeakerOutput(dest));

  let seen = 0;
  syn.wordBoundary = () => {
    seen += 1;
    opts.onWord?.(seen);
  };

  const pct = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${escapeXml(voice)}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">` +
    escapeXml(text) +
    `</prosody></voice></speak>`;

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };
    // jaring pengaman kalau onAudioEnd nggak pernah nyala
    const guard = setTimeout(finish, Math.max(8000, text.length * 140));

    dest.onAudioEnd = finish;
    syn.speakSsmlAsync(
      ssml,
      (r) => {
        try {
          syn.close();
        } catch {
          /* noop */
        }
        if (r.reason !== SDK.ResultReason.SynthesizingAudioCompleted) finish();
      },
      () => {
        try {
          syn.close();
        } catch {
          /* noop */
        }
        finish();
      },
    );
  });
}

/* ── meter level buat waveform ────────────────────────── */
export type Meter = { read: (n: number) => number[]; close: () => void };

export async function openMeter(): Promise<Meter | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    an.smoothingTimeConstant = 0.6;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);

    return {
      read(n) {
        an.getByteFrequencyData(buf);
        const out: number[] = [];
        const step = Math.floor(buf.length / 2 / n) || 1;
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let k = 0; k < step; k++) sum += buf[i * step + k] ?? 0;
          const avg = sum / step / 255;
          const shape = 1 - Math.abs(i - (n - 1) / 2) / n; // tengah lebih tinggi
          out.push(Math.max(5, Math.round(5 + avg * 46 * (0.55 + shape))));
        }
        return out;
      },
      close() {
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      },
    };
  } catch {
    return null; // browser nolak mic kedua — waveform disintesis sebagai cadangan
  }
}

/* Waveform cadangan kalau meter nggak bisa dibuka. */
export function fakeLevels(n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const shape = 1 - Math.abs(i - (n - 1) / 2) / n;
    return Math.round(6 + Math.random() * 30 * (0.4 + shape));
  });
}

/* ── antrean suara ────────────────────────────────────────
   Waktu balasan di-stream, tiap kalimat yang udah utuh langsung
   diucapkan — jadi suaranya mulai sebelum teksnya kelar. */
export class Voice {
  private queue: string[] = [];
  private busy = false;
  private dead = false;

  constructor(private name: string) {}

  push(text: string) {
    const t = text.trim();
    if (!t || this.dead) return;
    this.queue.push(t);
    void this.pump();
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length && !this.dead) {
      const next = this.queue.shift() as string;
      try {
        await speak(next, this.name);
      } catch {
        /* satu kalimat gagal, lanjut yang lain */
      }
    }
    this.busy = false;
  }

  get active() {
    return this.busy || this.queue.length > 0;
  }

  /** Tunggu sampai antrean habis. */
  async drain() {
    while (this.active && !this.dead) {
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  kill() {
    this.dead = true;
    this.queue = [];
    stopSpeaking();
  }
}

/**
 * Motong teks yang lagi ngalir jadi kalimat utuh.
 * Kalau kelamaan nggak ada tanda baca, dipotong di spasi terakhir
 * biar suaranya nggak nunggu kelamaan.
 */
export function sentenceSplitter(emit: (s: string) => void) {
  let buf = '';
  const RE = /[.!?…]+["')\]]*\s+/;

  return {
    push(delta: string) {
      buf += delta;
      for (;;) {
        const m = RE.exec(buf);
        if (!m) break;
        const cut = m.index + m[0].length;
        emit(buf.slice(0, cut));
        buf = buf.slice(cut);
      }
      if (buf.length > 150) {
        const sp = buf.lastIndexOf(' ');
        if (sp > 60) {
          emit(buf.slice(0, sp));
          buf = buf.slice(sp + 1);
        }
      }
    },
    flush() {
      if (buf.trim()) emit(buf);
      buf = '';
    },
  };
}
