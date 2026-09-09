# Zii Talk

Latihan ngobrol bahasa Inggris pakai suara. Web app — buka di laptop atau HP,
tampilannya nyesuain sendiri.

Desain aslinya ada di `design/` (canvas 7 artboard).

## Jalanin

```bash
cp .env.example .env    # isi key-nya
npm install
npm run dev             # buka http://localhost:5173
```

Produksi (satu proses, frontend + API):

```bash
npm run serve           # buka http://localhost:8787
```

## Isi `.env`

| Variabel | Buat apa | Wajib? |
|---|---|---|
| `DEEPSEEK_API_KEY` | model **DeepSeek V4 Flash** | salah satu |
| `OPENAI_API_KEY` | model **GPT-5.6 Luna** | salah satu |
| `AZURE_SPEECH_KEY` | dengerin + ngomong | ya, buat mode suara |
| `AZURE_SPEECH_REGION` | region Azure, mis. `southeastasia` | ya |
| `AZURE_TTS_VOICE` | suara Zii, default `en-US-AriaNeural` | opsional |
| `LANGSMITH_API_KEY` | trace + Studio | buat observability |
| `LANGSMITH_TRACING` | `true` buat nyalain trace | opsional |
| `LANGSMITH_PROJECT` | nama project trace | opsional |

Nggak perlu isi semua sekaligus. Yang belum keisi bakal ketahuan di layar Home,
lengkap sama nama variabel yang kurang. Kalau Azure belum diisi, app tetap jalan
dalam **mode ketik**.

## Kenapa ada server sendiri

API key **nggak pernah** nyampe ke browser. Server (`server/index.js`) yang
manggil LLM, dan buat Azure dia cuma nyetak token sementara (umur 10 menit)
yang aman dipegang browser. Jangan pindahin panggilan ini ke frontend.

## Model LLM

Dropdown-nya cuma nampung dua, dan ini hasil **pengukuran nyata**, bukan tebakan
dari tabel harga:

| Model | Token pertama (stream) | Hasil | Catatan |
|---|---|---|---|
| `gpt-5.6-luna` **(default)** | 1,0–1,3 s | natural | paling stabil |
| `deepseek-v4-flash` | 1,1–1,8 s | bener, agak kaku | paling murah |

Di **ngobrol** dua-duanya setara sekarang. Bedanya kelihatan di **Bengkel
Kalimat** (yang masih JSON, jadi nggak bisa di-stream): di situ DeepSeek
kena beban mikir dan hasil Inggrisnya lebih kaku.

**Jangan ketipu kata "Flash".** DeepSeek V4 Flash itu model **penalaran** — dia
mikir dulu, dan token mikirnya ikut kepotong `max_tokens`. Kalau budget-nya
pas-pasan, `content` balik **kosong** (`finish_reason: "length"`,
`reasoning_tokens` habis semua). Makanya di `MODELS` dia punya
`reasonBudget: 900` yang ditambahin ke jatah jawaban.

Mikirnya juga **jangan dimatiin**: dengan `thinking: {"type":"disabled"}` dia
memang turun ke 1,8 s, tapi berhenti nerjemahin — outputnya balik jadi bahasa
Indonesia. Cepat tapi salah.

Mau nambah model? Satu entri di `MODELS` (atas `server/index.js`) — UI-nya ngikut
sendiri. Yang lebih pinter & lebih berat: `deepseek-v4-pro`, `gpt-5.6-terra`.

Catatan: `deepseek-chat` / `deepseek-reasoner` **legacy** dan sedang dimatikan
DeepSeek — jangan dipakai lagi.

## Cara pakainya

- **Tahan mic** — atau **tahan SPASI** di laptop — buat ngomong. Lepas = kirim.
- **Jeda & Terjemah** buka *Bengkel Kalimat*: ngomong Indonesia, dapet dua
  versi Inggris (sopan + santai), bisa didengerin, bisa dipelanin. Kalau
  speech-to-text-nya salah dengar, benerin lewat **Ketik aja**.
- Koreksi muncul kuning, nggak merah, dan bisa di-**Tangkap** jadi kartu koleksi.
- **Esc** nutup bengkel.

## Otak AI-nya: LangGraph

Lapisan AI-nya jalan di atas **LangGraph** (`@langchain/langgraph`), bukan
panggilan HTTP mentahan. Ada dua graph:

| Graph | Isinya | Node |
|---|---|---|
| `conversation` | satu giliran ngobrol | `respond` + `review`, **paralel** |
| `workshop` | Bengkel Kalimat | `translate` |

`src/agent/conversation.ts` itu jantungnya. `respond` nulis balasan Zii;
`review` nyari koreksi + frasa. Dua-duanya dijalanin **paralel dari START**,
bukan berurutan — `review` cuma butuh kalimat si murid, jadi nggak ada alasan
bikin dia nunggu balasan Zii selesai.

Hasilnya, dua-duanya keluar lewat **satu stream** ke browser:

```
{"d": "I've "}          ← potongan balasan Zii
{"d": "been "}
...
{"review": {...}}       ← koreksi + frasa, nyusul
{"done": true}
```

Angka nyatanya: token pertama **1,5 s**, koreksi nyampe **2,3 s**
(sebelum pakai graph: koreksi baru dateng 4,3 s karena nunggu).

### Kenapa LangGraph, bukan LangChain saja

Jujur: app ini nggak ada tool loop, jadi secara fungsi `ChatOpenAI` biasa udah
cukup. Alasan sebenarnya:

1. **Studio cuma nyambung ke graph LangGraph** lewat Agent Server. Itu tiket
   masuk buat trace & debug visual.
2. Fan-out paralel `respond` / `review` jadi eksplisit dan kelihatan di Studio.
3. Satu definisi graph dipakai dua jalur: server produksi (`import` langsung)
   dan Studio (`langgraph dev`). Nggak ada kode kembar.

### Dua jebakan provider yang harus dihindari

- **`reasoning_content` dibuang di server.** DeepSeek nyiarin monolog
  internalnya sebagai delta terpisah, di node `review`. Server cuma nerusin
  token dari node `respond` — kalau nggak, user bakal *denger* Zii mikir.
- **Output terstruktur beda cara per provider.** DeepSeek nolak
  `response_format: json_schema` ("This response_format type is unavailable
  now"), DAN mode thinking-nya nolak `tool_choice` yang dipaksa. Satu-satunya
  jalan: `jsonMode` + bentuk JSON-nya ditulis di prompt. Itu kenapa
  `MODELS[].structured` ada di `src/agent/models.ts`.

## Trace & Studio (LangSmith)

Isi `LANGSMITH_API_KEY` di `.env`, terus:

```bash
npm run studio     # Agent Server di :2024, buat Studio
```

Studio-nya buka di:
`https://smith.langchain.com/studio?baseUrl=http://localhost:2024`

Di situ kelihatan dua graph (`conversation`, `workshop`), bisa dijalanin
manual, dan tiap node bisa diinspeksi input/output-nya.

Trace ke LangSmith **nggak butuh** Agent Server — cukup env var:

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=zii-talk
```

Jadi obrolan dari app produksi (`npm run tailnet`) ikut ke-trace juga.
Server nampilin statusnya waktu start, dan `/api/config` ngasih
`tracing: {on, project}`.

<Warning>
Dengan tracing ON, isi obrolan (kalimat Inggris kamu, terjemahan, koreksi)
dikirim ke server LangSmith. Set `LANGSMITH_TRACING=false` kalau nggak mau.
</Warning>

Kalau akun LangSmith kamu bukan region US, wajib set `LANGSMITH_ENDPOINT` —
tanpa itu key-nya nggak dikenali.

## Akses lewat Tailscale

Mikrofon di browser cuma jalan di **secure context** — HTTPS atau `localhost`.
Buka `http://100.x.x.x:8787` dari HP = mic **mati**, titik. Jadi bridge-nya wajib
lewat `tailscale serve`, yang ngasih sertifikat `*.ts.net` beneran.

```bash
npm run tailnet        # build + nyalain bridge + jalanin server
```

Atau pisah:

```bash
npm run bridge         # nyalain bridge (idempoten)
npm run serve          # jalanin app
npm run bridge:status  # lihat semua mapping serve
npm run bridge:off     # cabut — CUMA punya Zii Talk
```

Bridge-nya nyari port HTTPS yang bebas sendiri dan **nggak nimpa** mapping
`tailscale serve` yang udah ada. Makanya `bridge:off` melepas per-port, bukan
`tailscale serve reset` — reset bakal ngapus mapping app lain kamu.

Server sengaja cuma dengerin `127.0.0.1`. Yang jadi pintu ke tailnet itu
Tailscale, bukan Express — jadi nggak ada apa pun yang nongol di Wi-Fi kafe.
Mau ekspos langsung ke LAN? `HOST=0.0.0.0` — tapi ingat, tanpa HTTPS mic-nya
tetap mati.

**Jangan pakai `tailscale funnel`.** Itu nerbitin app-mu ke internet publik,
lengkap sama API key-mu di belakangnya. `serve` = tailnet only, dan itu yang
kamu mau.

Mode dev dengan live-reload lewat tailnet:

```bash
npm run dev:tailnet    # HMR-nya lewat wss di port bridge
```

## Struktur

```
server/index.ts     Express: stream graph + token Azure
src/agent/          graph LangGraph (conversation, workshop)
langgraph.json      config Agent Server buat Studio
src/lib/speech.ts   Azure STT/TTS + antrean suara per kalimat
src/lib/api.ts      client ke server
src/lib/store.ts    koleksi frasa & momentum (localStorage)
src/data/topics.ts  kurikulum Pareto — 9 topik
src/screens/        Home, Session
src/components/     Bengkel, orb, waveform, ikon
scripts/bridge.mjs  bridge Tailscale (HTTPS buat mic)
design/             canvas desain
```

## Yang perlu kamu tau

- **Waveform** butuh stream mic kedua di samping punya Azure. Kalau browser
  nolak, waveform-nya jatuh ke animasi sintetis — fungsi ngomongnya nggak
  keganggu.
- **Momentum bukan streak.** Bolos sehari nggak ngapus apa-apa; baru mengecil
  (separuh, minimal 1) kalau nganggur lebih dari 2 hari. Ini disengaja.
- Koleksi frasa disimpan di **localStorage** — per browser, belum sinkron
  antar device.
- Mic butuh **HTTPS** kalau diakses bukan dari `localhost`.
