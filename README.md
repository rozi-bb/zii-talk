# Zii Talk

Latihan ngobrol bahasa Inggris pakai suara. Web app — buka di laptop atau HP,
tampilannya nyesuain sendiri.

Desain aslinya ada di `design/` (canvas 7 artboard).

## Jalanin

```bash
cp .env.example .env    # isi key-nya
npm install             # frontend (React + Vite)
uv sync --group dev     # backend (Python + FastAPI)
npm run dev             # nyalain Postgres (Docker) + app → http://localhost:5173
```

Backend-nya Python, frontend-nya React — makanya dua perintah install.
Butuh [uv](https://docs.astral.sh/uv/), Python ≥ 3.11, dan **Docker** (buat Postgres).

Produksi (satu proses, frontend + API):

```bash
npm run serve           # buka http://localhost:8787
```

## Isi `.env`

| Variabel | Buat apa | Wajib? |
|---|---|---|
| `DEEPSEEK_API_KEY` | model **DeepSeek V4 Flash** | salah satu |
| `OPENAI_API_KEY` | model **GPT-5.6 Luna** | salah satu |
| `AZURE_SPEECH_KEY` | dengerin + ngomong | **ya** — tanpa ini nggak bisa ngobrol |
| `AZURE_SPEECH_REGION` | region Azure, mis. `southeastasia` | ya |
| `AZURE_TTS_VOICE` | suara default sebelum dipilih di halaman Pengaturan, default `en-US-Emma:DragonHDLatestNeural` — harus salah satu dari `server/voices.py` | opsional |
| `LANGSMITH_API_KEY` | trace + Studio | buat observability |
| `LANGSMITH_TRACING` | `true` buat nyalain trace | opsional |
| `LANGSMITH_PROJECT` | nama project trace | opsional |
| `DATABASE_URL` | Postgres, default `postgresql://zii:zii@127.0.0.1:5439/zii_talk` | opsional |

Yang belum keisi bakal ketahuan di Latihan (peringatan kuning), dan detailnya
ada di **Pengaturan → Status sistem**. Minimal satu key LLM **plus** Azure Speech: obrolan utama sengaja
**nggak punya kotak ketik** — biar tetap latihan ngomong, bukan ngetik — jadi
tanpa Azure mic-nya mati dan obrolannya nggak bisa jalan. Bengkel Kalimat masih
bisa dipakai lewat ketik.

## Kenapa ada server sendiri

API key **nggak pernah** nyampe ke browser. Server (`server/main.py`, FastAPI)
yang manggil LLM, dan buat Azure dia cuma nyetak token sementara (umur 10 menit)
yang aman dipegang browser. Jangan pindahin panggilan ini ke frontend.

Endpoint-nya kekelompok per fitur di `server/routes/`, dan Swagger-nya
otomatis ada di `/docs` — 8 grup: Config, Speech, Chat, Bengkel Kalimat, Topik,
Kategori, Riwayat Tes, State.

## Model LLM

Dropdown-nya cuma nampung dua, dan ini hasil **pengukuran nyata**, bukan tebakan
dari tabel harga (backend Python, 6 giliran per model, 11 Sep 2026 — angkanya
naik-turun ikut kondisi jaringan & provider):

| Model | Token pertama | Koreksi nyampe | Hasil | Catatan |
|---|---|---|---|---|
| `gpt-5.6-luna` **(default)** | 1,5–3,0 s | 1,7–3,3 s | natural | koreksinya konsisten |
| `deepseek-v4-flash` | 0,9–2,1 s | biasanya ~1,5 s, **kadang 9–11 s** | bener, agak kaku | paling murah |

DeepSeek sering nyaut **lebih cepat**, tapi kartu koreksinya sesekali telat
banget: node `review` kena beban mikir model penalaran. Balasan Zii-nya sendiri
nggak ketahan (dia di node lain, jalan paralel), cuma kartu kuningnya yang
nyusul belakangan. GPT lebih lambat mulai, tapi stabil.

Di **Bengkel Kalimat** (masih JSON, jadi nggak bisa di-stream) bedanya paling
kerasa: satu terjemahan = 6 kalimat (3 formal + 3 santai). GPT **2–3 s**,
DeepSeek **5–8 s** karena mikir dulu.

**Jangan ketipu kata "Flash".** DeepSeek V4 Flash itu model **penalaran** — dia
mikir dulu, dan token mikirnya ikut kepotong `max_tokens`. Kalau budget-nya
pas-pasan, `content` balik **kosong** (`finish_reason: "length"`,
`reasoning_tokens` habis semua). Makanya di `MODELS` dia punya
`reason_budget: 900` yang ditambahin ke jatah jawaban.

Mikirnya juga **jangan dimatiin**: dengan `thinking: {"type":"disabled"}` dia
memang turun ke 1,8 s, tapi berhenti nerjemahin — outputnya balik jadi bahasa
Indonesia. Cepat tapi salah.

Mau nambah model? Satu entri di `MODELS` (`server/agent/models.py`) — UI-nya
ngikut sendiri. Yang lebih pinter & lebih berat: `deepseek-v4-pro`, `gpt-5.6-terra`.

Catatan: `deepseek-chat` / `deepseek-reasoner` **legacy** dan sedang dimatikan
DeepSeek — jangan dipakai lagi.

## Cara pakainya

Semuanya bisa lewat keyboard, dan **SPASI** artinya selalu "ngomong" — cuma
berubah sesuai kondisi:

| Kondisi | Tombol | Yang terjadi |
|---|---|---|
| Siap | tahan **SPASI** / mic | ngomong; lepas = kirim |
| Lagi ngomong, tiba-tiba blank | **M** | kalimat yang udah diucapin **ditahan** (nggak dibuang, nggak dikirim), Bengkel kebuka |
| Zii lagi mikir | ketuk **SPASI** | **betulin** — kalau speech-to-text salah dengar, giliranmu ditarik balik ke kotak edit sebelum Zii sempat nyaut |
| Kotak betulin | **Enter** / **Esc** | kirim / jadiin draft biar bisa lanjut ngomong |
| Zii lagi ngomong | tahan **SPASI** / mic | **nyela** — suara Zii dimatiin, kamu langsung ngomong. Teks balasannya tetap di layar & riwayat |
| Di Bengkel | tahan **SPASI** / **Esc** | ngomong bahasa Indonesia / tutup Bengkel |

- **Jeda & Terjemah** (atau **M**) buka *Bengkel Kalimat*: ngomong Indonesia,
  dapet dua kartu — **Formal** dan **Santai** — masing-masing **3 pilihan**
  yang bisa digeser (swipe di HP; panah, titik, atau ←/→ di laptop). Tiap
  pilihan bisa didengerin & dipelanin. Kalimat yang lagi kelihatan di kartu
  yang dipilih itu yang disimpan ke koleksi. Kalau speech-to-text-nya salah
  dengar, benerin lewat **Ketik aja**.
- Kalimat yang ditahan pakai **M** nongol sebagai bubble putus-putus. Balik dari
  Bengkel, tahan SPASI lagi buat nyambung — Zii nerima satu giliran utuh.
- **Zii nggak ngoreksi di obrolan.** Koreksi cuma muncul di kartu kuning, dan
  bisa di-**Tangkap** jadi kartu koleksi. Kalau kamu mentok/lari ke bahasa
  Indonesia, Zii tetap nyodorin frasa yang kamu cari — itu nolong, bukan ngoreksi.

## Otak AI-nya: LangGraph

Lapisan AI-nya jalan di atas **LangGraph** (Python), bukan panggilan HTTP
mentahan. Ada dua graph:

| Graph | Isinya | Node |
|---|---|---|
| `conversation` | satu giliran ngobrol | `respond` + `review`, **paralel** |
| `workshop` | Bengkel Kalimat | `translate` |

`server/agent/conversation.py` itu jantungnya. `respond` nulis balasan Zii;
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

Efeknya: koreksi nyampe hampir barengan sama token pertama (lihat tabel di
atas), bukan setelah balasan Zii kelar. Waktu dua langkah ini masih berurutan,
koreksi baru dateng ~4,3 s.

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
  jalan: `json_mode` + bentuk JSON-nya ditulis di prompt. Itu kenapa
  `MODELS[].structured` ada di `server/agent/models.py`.

## Trace & Studio (LangSmith)

Isi `LANGSMITH_API_KEY` di `.env`, terus:

```bash
npm run studio     # Agent Server di :2024, buat Studio
```

Studio-nya buka di:
`https://smith.langchain.com/studio?baseUrl=http://localhost:2024`

Di situ kelihatan dua graph (`conversation`, `workshop`), bisa dijalanin
manual, dan tiap node bisa diinspeksi input/output-nya.

**Buka Studio dari device lain** (misal server-nya di Ubuntu, browser-nya di
Mac)? `http://100.x.x.x:2024` **nggak akan nyambung** — Studio itu halaman
HTTPS, dan Chrome (Private Network Access) nolak halaman HTTPS manggil server
HTTP di alamat jaringan privat. Pakai bridge-nya:

```bash
npm run studio:tailnet   # Agent Server + bridge HTTPS Tailscale
```

Terus buka `https://smith.langchain.com/studio?baseUrl=https://<nama-mesin>.<tailnet>.ts.net:<port>`
(URL persisnya dicetak waktu start). Pertama kali nyambung, Studio bakal minta
domain `*.ts.net`-nya ditambahin ke **Allowed Origins** — itu normal.

Trace ke LangSmith **nggak butuh** Agent Server — cukup env var:

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=zii-talk
```

Jadi obrolan dari app produksi (`npm run tailnet`) ikut ke-trace juga.
Server nampilin statusnya waktu start, dan `/api/config` ngasih
`tracing: {on, project}`.

> [!WARNING]
> Dengan tracing ON, isi obrolan (kalimat Inggris kamu, terjemahan, koreksi)
> dikirim ke server LangSmith. Set `LANGSMITH_TRACING=false` kalau nggak mau.

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
Tailscale, bukan Uvicorn — jadi nggak ada apa pun yang nongol di Wi-Fi kafe.
Mau ekspos langsung ke LAN? `HOST=0.0.0.0` — tapi ingat, tanpa HTTPS mic-nya
tetap mati.

**Jangan pakai `tailscale funnel`.** Itu nerbitin app-mu ke internet publik,
lengkap sama API key-mu di belakangnya. `serve` = tailnet only, dan itu yang
kamu mau.

Mode dev dengan live-reload lewat tailnet:

```bash
npm run dev:tailnet    # HMR-nya lewat wss di port bridge
```

## Database, tes & dashboard

Semua data ada di **Postgres** yang jalan di container (`docker-compose.yml`,
`127.0.0.1:5439`, volume `zii-talk_pgdata`). `npm run dev` / `npm start`
nyalain container-nya duluan. Skemanya dibikin otomatis waktu server start, dari
file di `server/migrations/` (urut nama, sekali per file).

```bash
npm run db:up      # nyalain Postgres, nunggu sampai sehat
npm run db:psql    # masuk psql
npm run db:down    # matiin — data tetap aman di volume
```

| Tabel | Isinya |
|---|---|
| `categories` | kategori topik — awalnya Sehari-hari & Buat Kerja, bisa ditambah dari app |
| `topics` | topik + skenario buat Zii, masing-masing di satu kategori. 9 topik awal di-seed dari `002_seed_topics.sql` |
| `test_runs` | satu sesi tes: topik, tes ke-berapa, model, jumlah pertanyaan, mulai & aktivitas terakhir |
| `messages` | transkrip per sesi, lengkap sama timestamp & kartu koreksi |
| `phrases` | koleksi frasa |
| `app_state` | model pilihan & momentum — satu baris, usernya cuma satu |

Status "sudah/belum dites", jumlah tes, dan total pertanyaan **nggak disimpan
sebagai kolom**. Semuanya dihitung dari `test_runs` lewat view `topic_stats`,
jadi nggak mungkin beda sama data aslinya.

**Kapan satu sesi jadi tes:** begitu **jawaban ke-10** masuk. Sebelum itu nggak
ada yang ditulis ke database — keluar di jawaban ke-7 berarti sesi itu nggak
pernah ada (app nanya dulu sebelum kamu keluar). Lewat dari 10, tiap Q&A langsung
ditulis dan kamu bebas lanjut sampai kapan aja. Satu pertanyaan = satu pertanyaan
Zii yang kamu jawab. Batasnya `MIN_ANSWERS` di `server/runlog.py`.

Yang gampang kelewat:

- Jawaban ditulis di **awal** giliran, balasan Zii di **akhir**. Jadi jawaban
  ke-10 tetap kesimpan walaupun kamu langsung keluar selagi Zii masih nyaut.
- **Betulin** jawaban yang udah kesimpan ikut ngehapus barisnya di database
  (`POST /api/runs/{id}/rewind`). Kalau jadinya di bawah 10, sesinya dihapus lagi.
- Id sesi dibikin browser waktu sesi dibuka, jadi giliran yang nyampe dua kali
  nggak bikin tes dobel.
- Gagal nyimpen (misal Postgres mati di tengah sesi) nggak ngehentiin obrolan —
  cuma muncul peringatan merah.

## Halaman

Navigasinya sidebar di laptop, tab bar di HP. Sesi ngobrol sengaja tampil penuh
tanpa navigasi.

| Halaman | Isinya |
|---|---|
| **Latihan** `/` | rekomendasi hari ini, topik terakhir dilatih, beberapa topik yang belum dicoba / waktunya diulang, dan jalan pintas per kategori. Sengaja **bukan** daftar semua topik |
| **Topik** `/topik` | semua topik: cari (tekan `/`), filter kategori & status, urutkan, tambah topik & kategori. Filternya ikut di URL, jadi bisa di-bookmark |
| **Koleksi** `/koleksi` | frasa yang ditangkap dari kartu koreksi & disimpan dari Bengkel: cari, filter per topik, dengerin, hapus |
| **Dashboard** `/dashboard` | ringkasan, status tes per topik, riwayat tes + transkrip, tombol **Retest** |
| **Pengaturan** `/pengaturan` | suara Zii, model AI, aturan sesi, status sistem (API key, Azure, tracing) |

**Rekomendasi hari ini** dipilih dari 5 topik yang paling perlu dilatih (belum
pernah dicoba duluan, lalu yang paling lama nggak disentuh), dan ditentuin
tanggal: sama seharian, ganti besoknya. Logikanya di `src/lib/topics.ts`.

Dashboard enaknya dibuka di tab sendiri — angkanya disegerin tiap tab-nya dilihat
lagi. Sesi yang dimulai dari halaman mana pun balik ke halaman itu waktu selesai.

## Struktur

```
server/main.py      FastAPI: rakit router + serve frontend build
server/routes/      endpoint per fitur (config, speech, chat, translate, topics, categories, runs, state)
server/agent/       graph LangGraph (conversation, workshop)
server/db.py        pool Postgres + runner migrasi
server/runlog.py    nyatet sesi tes (aturan minimal 10 jawaban)
server/migrations/  skema + seed 9 topik awal
server/util.py      helper: bersihin teks, riwayat -> BaseMessage
server/voices.py    daftar suara HD Azure yang bisa dipilih di Pengaturan
server/expressions.py  tag suara ([laughter], ...): yang diizinin + filter stream
pyproject.toml      dependency Python (dikelola uv)
langgraph.json      config Agent Server buat Studio
docker-compose.yml  Postgres
src/lib/speech.ts   Azure STT/TTS + antrean suara per kalimat
src/lib/expr.ts     tag suara: dibuang dari layar, nggak dihitung sebagai kata
src/lib/api.ts      client ke server
src/lib/nav.ts      router mini: /, /topik, /koleksi, /dashboard, /pengaturan
src/lib/topics.ts   cari, filter, urutkan topik + pilih rekomendasi hari ini
src/lib/format.ts   format waktu ("3 jam yang lalu")
src/screens/        Home (Latihan), Topics, Collection (Koleksi), Settings, Session, Dashboard
src/components/     Shell (navigasi), TopicCard, TopicForm, Bengkel, orb, waveform, ikon
scripts/bridge.mjs  bridge Tailscale (HTTPS buat mic)
design/             canvas desain
```

## Yang perlu kamu tau

- **Waveform** butuh stream mic kedua di samping punya Azure. Kalau browser
  nolak, waveform-nya jatuh ke animasi sintetis — fungsi ngomongnya nggak
  keganggu.
- **Zii bisa ketawa & berekspresi** lewat tag suara (`[laughter]`, `[excited]`,
  ...) yang ditulis LLM-nya. Cuma tag di `server/expressions.py` yang lolos, dan
  tag-nya nggak pernah kelihatan di layar maupun riwayat tes — cuma kedengeran.
- **Momentum bukan streak.** Bolos sehari nggak ngapus apa-apa; baru mengecil
  (separuh, minimal 1) kalau nganggur lebih dari 2 hari. Ini disengaja.
- Koleksi frasa, momentum, dan riwayat tes ada di **Postgres**, bukan di
  browser — jadi sama di semua device yang buka app lewat server yang sama.
- Mic butuh **HTTPS** kalau diakses bukan dari `localhost`.
