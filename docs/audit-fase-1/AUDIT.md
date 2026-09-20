# Audit Desain, UX & Konsep — Zii Talk Fase 1

> Riset menyeluruh setelah fase 1 selesai: bug yang ketemu, desain yang kurang pas,
> dan konsep yang perlu dirombak biar app-nya kerasa lebih profesional dan tetap
> enak dipakai waktu topiknya makin banyak.
>
> **Tanggal:** 13 September 2026 · **Cakupan:** Home, Sesi, Bengkel Kalimat,
> Dashboard, form Tambah topik · **Status kode:** commit `d1b3c11` + perubahan
> suara HD & ekspresi yang belum di-commit.
>
> **Update status:** 20 September 2026, sampai siklus belajar (ringkasan sesi,
> latihan ulang frasa, metrik kelancaran).
> Lihat [Status perbaikan](#status-perbaikan). Temuan di section 1–4 sengaja
> dibiarkan apa adanya (kondisi **sebelum** diperbaiki), begitu juga screenshot di
> `img/`.

---

## Daftar isi

1. [Ringkasan](#ringkasan)
2. [Status perbaikan](#status-perbaikan)
3. [Cara risetnya](#cara-risetnya)
4. [Bug yang ketemu](#1-bug-yang-ketemu)
5. [Temuan desain per layar](#2-temuan-desain-per-layar)
6. [Sistem visual & aksesibilitas](#3-sistem-visual--aksesibilitas)
7. [Konsep yang perlu dirombak](#4-konsep-yang-perlu-dirombak)
8. [Roadmap usulan](#5-roadmap-usulan)
9. [Keputusan yang perlu kamu ambil](#6-keputusan-yang-perlu-kamu-ambil)
10. [Lampiran](#lampiran)

---

## Ringkasan

Fondasi fase 1 kuat: alur ngomong (push-to-talk, nyela, betulin, Bengkel) matang,
suara HD dan ekspresi jalan, dan datanya udah rapi di Postgres. Yang bikin app ini
**belum kerasa profesional** bukan fiturnya, tapi lima hal ini:

1. **Home nggak siap buat banyak topik.** Dengan 36 topik, Home jadi scroll
   2.899px (±3,4 layar HP) tanpa cari, filter, urutkan, atau kategori. Grup
   topik juga dikunci cuma dua (`daily`/`work`) sampai level database.
2. **Siklus belajarnya putus di tengah.** Frasa bisa disimpan tapi **nggak
   pernah bisa dilihat atau diulang**. Sesi selesai tanpa ringkasan. Dashboard
   cuma ngitung "berapa kali tes", bukan "aku makin lancar atau nggak".
3. **Pengaturan developer nongol di layar utama.** Dropdown model LLM, suara,
   dan instruksi `.env` ada di Home, di atas konten yang mestinya jadi fokus.
4. **Kontras & ukuran teks di bawah standar.** 14 dari 18 pasangan warna yang
   dicek gagal WCAG AA. Ada 51 aturan CSS dengan font di bawah 12px. Beberapa
   tombol lebih kecil dari ukuran jari.
5. **Beberapa bug kelihatan langsung sama user.** Timer rekaman nampil `0:75`,
   avatar Zii jadi kotak buat yang nyalain "kurangi animasi", highlight kata di
   Bengkel lari duluan, dan tombol utama Bengkel labelnya menyesatkan.

### 10 prioritas teratas

| # | Apa | Jenis | Usaha | Status (14 Sep) |
|---|---|---|---|---|
| 1 | Benerin timer rekaman `0:75` | Bug | kecil | **Beres** |
| 2 | Orb Zii jadi kotak saat reduce motion | Bug | kecil | **Beres** |
| 3 | Naikin kontras token warna + ukuran teks minimal 12px | Aksesibilitas | sedang | **Beres** di semua layar |
| 4 | Tombol Bengkel: "Pakai & Lanjut" cuma nutup, "Simpan" ketutup | Bug UX | kecil | **Beres** |
| 5 | Pindahin model & suara ke halaman **Pengaturan** | Konsep | sedang | **Beres** |
| 6 | Halaman **Topik** dengan cari, kategori, filter, urutkan | Konsep | besar | **Beres**; edit & arsip topik belum |
| 7 | **Ringkasan sesi** setelah selesai | Konsep | sedang | **Beres** (20 Sep) |
| 8 | **Koleksi frasa** yang bisa dilihat & diulang | Konsep | besar | **Beres** (20 Sep): dilihat, dicari, didengerin, dihapus, dan dilatih ulang pakai kotak Leitner |
| 9 | Dashboard → **Progres**: metrik kelancaran, bukan cuma jumlah tes | Konsep | sedang | **Beres** (20 Sep): menit ngomong, koreksi per 10 jawaban, grafik 8 minggu |
| 10 | Navigasi app yang konsisten (tab bawah di HP, sidebar di laptop) | Konsep | sedang | **Beres** |

---

## Status perbaikan

> Update 20 September 2026.

### Dikerjain di commit mana

| Commit | Isi |
|---|---|
| `022accd` | Navigasi baru (sidebar laptop, tab bar HP), beranda **Latihan**, halaman **Topik** & **Pengaturan**, tabel `categories`, suara HD & ekspresi Zii |
| `078eba9` | Review desain 4 halaman sidebar di laptop, tablet, dan HP: kontras, ukuran teks, layout responsif, Dashboard dirombak ke gaya baru, favicon |
| `931f351` | Sisa target sentuh di HP (tombol status Dashboard, kotak cari Topik, tombol contoh suara) |
| `1d0679a` | B1, B7, halaman **Koleksi** + API frasa, kontras & ukuran teks di Sesi, Bengkel, dan rail laptop |
| `ef74a15` | **Login email & password**, data per akun, akun pertama jadi admin. Lihat [Login & akun](#login--akun) |
| `5c776fd` | **Full container**: app + Postgres di Docker (`Dockerfile`, `docker-compose.yml`) |
| branch `feat/siklus-belajar` | **Ringkasan sesi**, **latihan ulang frasa** (kotak Leitner), **metrik kelancaran**, area obrolan HP jadi ±77%. Lihat [Siklus belajar](#siklus-belajar) |

**Sesi & Bengkel baru digarap sebagian:** timer (B1), tombol Bengkel (B7),
kontras, ukuran teks, dan target sentuh. Sisa temuan di
[2.2](#22-sesi-ngobrol), [2.3](#23-bengkel-kalimat),
[4.4](#44-sesi-fokus-ke-obrolan-tutup-dengan-ringkasan), dan
[4.5](#45-bengkel-satu-tujuan-per-layar) masih berlaku.

### Status per area

| Area | Status | Yang udah | Yang belum |
|---|---|---|---|
| Beranda ([2.1](#21-home), [4.2](#42-beranda-latihan-dirancang-buat-100-topik)) | **Beres** | Rekomendasi hari ini (rotasi harian), Terakhir dilatih, Belum pernah dicoba, Waktunya diulang, Jelajah kategori, kartu "frasa perlu diulang"; model & suara pindah ke Pengaturan | — |
| Navigasi ([4.1](#41-arsitektur-informasi--navigasi)) | **Beres** | 5 tujuan: Latihan, Topik, Koleksi, Dashboard, Pengaturan. Sidebar di laptop, tab bar 5 menu di HP, disembunyiin saat sesi | — |
| Topik ([4.3](#43-halaman-topik-perpustakaan)) | **Sebagian** | Cari, filter kategori & status, 5 urutan, filter ikut URL, daftar ringkas, tambah kategori dari app | Edit, arsip, sematkan topik (`archived_at`, `pinned`, `PATCH`); ikon kategori |
| Koleksi frasa ([4.6](#46-koleksi-frasa--latihan-ulang-fitur-yang-hilang)) | **Beres** | Halaman `/koleksi` (daftar, cari, filter topik, dengerin, hapus) + halaman `/ulang`: kotak Leitner 1/3/7/14/30 hari, jawab ketik atau mic, penilaian longgar & bisa ditimpa manual | Latihan ulang belum bisa dibatasi per topik |
| Pengaturan ([4.8](#48-pengaturan--onboarding)) | **Sebagian** | Suara + contoh, model AI, aturan sesi, status sistem (LLM, Azure, LangSmith) | Kecepatan bicara, ekspresi on/off, koreksi on/off, target jawaban, status database, onboarding |
| Dashboard → Progres ([2.4](#24-dashboard--tambah-topik), [4.7](#47-progres-pengganti-dashboard)) | **Beres** | Ringkasan, istilah "sesi", bagian **Kelancaran**: menit ngomong minggu ini, koreksi per 10 jawaban (+ beda sama minggu lalu), topik aktif, grafik 8 minggu | Riwayat lintas topik dalam satu daftar |
| Kontras ([3.1](#31-kontras-warna-wcag-aa-teks-normal--451)) | **Beres** | Semua layar. Token baru `--ink-mute`, `--tang-ink`/`--tang-deep`, `--sky-ink`/`--sky-deep`; tombol "Tangkap frasa" pakai tinta gelap; `--muted` dihapus | — |
| Ukuran teks ([3.2](#32-ukuran-teks)) | **Beres** | Nol teks yang kelihatan di bawah 12px, di semua layar | 2 aturan dasar form (`.fld > span`, `.tf-lbl`) masih 11px di CSS, tapi ditimpa 13px |
| Target sentuh ([3.3](#33-target-sentuh)) | **Beres** | Tombol di HP minimal 40–44px di semua layar | Titik pilihan Bengkel 13×23px (panah 44px jadi alternatifnya) |
| Utang CSS ([3.4](#34-konsistensi--utang-css)) | **Sebagian** | Favicon; CSS mati `.fcard`, `.side-head`, `.gloss`, `.round.plain`, `.use`, `.save` dihapus; bug `.ghost` yang nimpa `.btn.ghost` beres | `.pill`, `.dsp` masih ada; hex di CSS 182 (98 unik), `style={{…}}` inline 38; manifest & app icon |
| Sesi ([2.2](#22-sesi-ngobrol), [4.4](#44-sesi-fokus-ke-obrolan-tutup-dengan-ringkasan)) | **Sebagian** | Timer menit:detik (B1), kontras, ukuran teks, target sentuh, **ringkasan sesi**, konfirmasi keluar in-app (B11), area obrolan HP ±77% (dari ±61%) | Kartu koreksi selalu "Hampir bener!", `lang="en"` di bubble, istilah "Tes #n" di progres |
| Akun & login ([Login & akun](#login--akun)) | **Sebagian** | Daftar & masuk pakai email + password, keluar, semua API wajib login, frasa / riwayat tes / momentum / model / suara per akun, akun pertama admin + dapet data lama, batas salah password | Login Google, topik per akun, batas pemakaian AI, lupa password, verifikasi email, menu admin, online |
| Bengkel ([2.3](#23-bengkel-kalimat), [4.5](#45-bengkel-satu-tujuan-per-layar)) | **Sebagian** | Tombol "Simpan frasa" & "Balik ngobrol" nempel di bawah (B7), kontras, ukuran teks, tombol × & panah lebih gede, **kartu contekan** waktu panelnya ditutup, **Latih dulu** 3 langkah | Highlight kata (B6), spasi kata (B8), backdrop HP (B12), tombol di dalam tombol (B14), tampilan bertahap |

### Yang berubah di review desain (`078eba9`, `931f351`)

**Semua halaman sidebar:** teks minimal 12px, kontras lolos AA, tombol di HP
minimal 40–44px, favicon.

**Latihan**

- Grid topik pakai container query: di tablet dan laptop ±1100–1260px nggak ada
  kartu nyangkut sendirian di baris kedua.
- Kartu "Cara kerjanya" nggak bolong lagi waktu ditumpuk.
- Aturan 10 jawaban nggak disebut dua kali.

**Topik**

- HP: cari & status sebaris, "Sudah tersimpan" jadi "Tersimpan", urutkan pindah
  ke baris jumlah hasil, catatan aturan pindah ke bawah daftar. Topik pertama
  naik dari y ±470px ke ±318px.
- Hasil cari kosong: "Reset filter" nggak dobel, urutkan disembunyiin.
- Form tambah topik: teks lebih gede, tombol simpan violet & nempel di bawah
  layar HP, ada petunjuk kenapa belum bisa disimpan.

**Dashboard**

- Gaya disamain sama halaman lain (kartu flat, satu scroll).
- Tabel pakai container query: nama topik nggak kepotong lagi di laptop
  1024–1280px.
- Istilah "tes" jadi "sesi"; 4 kotak ringkasan yang nggak dobel.
- Tombol "Latih lagi" mati kalau AI belum siap; tombol tambah topik cuma di Topik.
- Transkrip & skenario ditandai `lang="en"`.

**Pengaturan**

- Dropdown suara & model bisa diketuk di seluruh kotak, dengan tanda fokus keyboard.
- Status sistem naik ke atas kalau ada yang belum siap; nama variabel `.env`
  nggak pecah di HP.
- Status LangSmith nggak lagi "Siap" kalau API key-nya kosong (`tracing.keyed`
  di `/api/config`).

### Yang berubah di perbaikan Sesi, Bengkel & Koleksi

**Bengkel Kalimat (B7)**

- "Pakai & Lanjut Ngobrol" (padahal cuma nutup panel) dan teks simpan yang pudar
  diganti dua tombol 48px: **Balik ngobrol** dan **Simpan frasa**.
- Dua-duanya nempel di bawah panel: di HP di bawah layar, di laptop di bawah panel
  kanan. Selalu kelihatan tanpa scroll.
- Di atas tombol ditulis kalimat mana yang bakal disimpan ("Formal · pilihan 1").
  Habis disimpan, tombolnya jadi hijau "Tersimpan".

**Sesi (B1)**

- Timer rekaman menit:detik: 75 detik tampil `1:15`, 10 menit tampil `10:00`.

**Koleksi frasa (baru)**

- Halaman `/koleksi` di sidebar & tab bar: frasa Inggris, arti Indonesia, asal
  topik, kapan disimpan.
- Cari (frasa + arti), filter per topik, dengerin pakai suara Zii, hapus dengan
  konfirmasi dua langkah (bukan dialog bawaan browser).
- API baru `GET /api/phrases` dan `DELETE /api/phrases/{id}`. Angka frasa di
  sidebar ikut turun habis hapus.

**Kontras & ukuran di Sesi, Bengkel, rail laptop**

- Semua teks minimal 12px; `--muted` & `--faint` diganti `--ink-mute` buat teks.
- "Tangkap frasa" & teks terbang ke counter: tinta gelap di atas amber (dulu putih
  1.77:1). "Masuk koleksi!" & tag Santai: teal gelap.
- Mic rekam, pita DIJEDA, jam rekaman: oranye pekat `--tang-ink` (putih 4.95:1).
  Tag ID, mic Bengkel, tombol Jeda: biru pekat `--sky-ink`.
- Coret di kartu koreksi, "Kenapa?", teks koreksi hijau, label "Jeda & Terjemah":
  warnanya digelapin sampai lolos AA.
- Tombol × Bengkel 40px, panah pilihan 36px, tombol kembali 40px; di layar sentuh
  44px. Chip "Ulangi", "Ngomong ulang", "Ketik aja", "Pelanin" minimal 40px.

**Bug yang ikut beres**

- Class `.ghost` (tombol "Kenapa?") nimpa padding & ukuran font semua `.btn.ghost`
  di app, jadi tombol kayak "Reset filter" di Topik kelihatan sempit. Diganti
  `.fix-toggle`.
- Di laptop, footer Bengkel sempat bikin scrollbar horizontal & celah 15px di
  bawah tombol. Sekarang yang scroll panel kanan, footer nempel pas di bawah.

### Login & akun

> Dikerjain 15 September 2026 di branch `feat/login`. Keputusannya dari
> [section 6 nomor 1](#6-keputusan-yang-perlu-kamu-ambil): app ini jadi
> **banyak pengguna**.

**Yang udah jalan:**

- **Halaman Masuk / Daftar** (`src/screens/Login.tsx`): satu kartu dengan dua
  tab, tombol lihat password, pesan error in-app. Kalau belum ada akun sama
  sekali, langsung kebuka di tab Daftar dengan catatan "akun pertama jadi admin".
  Kolom 16px biar Safari iOS nggak nge-zoom, tombol 48px.
- **Server** (`server/auth.py`, `server/routes/auth.py`):
  - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`,
    `GET /api/auth/me`.
  - Password di-hash **scrypt** bawaan Python (tanpa package baru), minimal 8
    karakter.
  - Sesi login = token acak di cookie `httpOnly`, `SameSite=Lax`, 30 hari. Di
    database cuma disimpan sha256-nya. Keluar = sesinya dihapus di server juga.
  - **Semua `/api/*` selain `/api/auth/*` wajib login**, termasuk chat, Bengkel,
    dan token Azure Speech. Dipasang di level router (`server/main.py`), jadi
    router baru otomatis ikut kekunci.
  - Salah password 5 kali → email itu dikunci 60 detik (disimpan di memori
    server). Email yang nggak terdaftar makan waktu yang sama, jadi nggak
    ngebocorin email mana yang punya akun.
- **Data per akun** (migrasi `005_users.sql`): tabel `users` & `sessions`;
  kolom `user_id` di `app_state`, `phrases`, `test_runs`.
  - Model, suara, dan momentum punya masing-masing.
  - Frasa kembar dicegah per akun.
  - Nomor tes #1, #2 dihitung per akun per topik.
  - Statistik topik (jumlah tes, jawaban, terakhir latihan) per akun. View
    `topic_stats` dihapus karena ngitung semua orang jadi satu.
  - Buka / rewind / nyambung ke sesi tes akun lain = 404, nggak pernah ditulis.
- **Akun pertama = admin** dan ngambil semua data lama (frasa, riwayat tes,
  momentum, model, suara) dalam satu transaksi.
- **Pengaturan** punya kartu **Akun** (email, peran, tombol Keluar). Sidebar
  laptop nampilin email di bawah.
- Sesi login habis di tengah jalan (request mana pun dapet 401) → langsung balik
  ke halaman Masuk.
- Tabel `users` udah disiapin buat Google: kolom `google_sub`, `password_hash`
  boleh kosong. Nambah Google nanti nggak perlu migrasi data.

**Sengaja ditunda (fitur penting, masuk [Fase 3](#fase-3--akun--online)):**

| Fitur | Kenapa ditunda | Catatan buat nanti |
|---|---|---|
| **Login Google** | Butuh setup Google Cloud Console, dan Google cuma nerima `localhost` atau domain HTTPS. Lewat tailnet dari HP (`100.x.x.x`) nggak bakal jalan | Kerjain bareng online, biar redirect URI langsung pakai domain final. Alur: authorization code di server lewat `httpx`, email Google yang sama digabung ke akun yang udah ada |
| **Topik per akun** | Fokus form login dulu | Sekarang topik & kategori dipakai bareng; siapa pun yang login bisa nambah topik dan kelihatan semua orang. Perlu `user_id` di `topics` & `categories` (atau topik bawaan + topik pribadi) |
| **Batas pemakaian AI per akun** | Belum online | Tiap akun yang login makan kuota LLM & Azure punya pemilik server. Perlu batas per akun per hari di `/api/chat/stream`, `/api/translate`, `/api/speech/token` |
| **Online** (domain + HTTPS) | Nanti | Cookie otomatis `Secure` kalau lewat HTTPS. Batas salah password masih di memori; kalau servernya lebih dari satu proses, pindahin ke database |
| **Lupa password & verifikasi email** | Butuh layanan kirim email | — |
| **Menu admin** | Peran admin baru dicatat | Contoh isinya: daftar akun, kelola topik bawaan, lihat pemakaian AI |
| **Pendaftaran tertutup** | Sekarang siapa pun yang bisa buka app bisa daftar | Opsi: cuma admin yang bikin akun, atau pakai kode undangan |

**Cara ngetesnya:** database di-backup (`pg_dump`) sebelum tes, lalu dikembalikan
lagi. Jadi akun pertama yang daftar tetap pemilik app, dan dia yang jadi admin.

### Siklus belajar

> Dikerjain 20 September 2026 di branch `feat/siklus-belajar`. Ini nutup
> temuan nomor 2 di [Ringkasan](#ringkasan): "siklus belajarnya putus di
> tengah".

**1. Ringkasan sesi** (`src/screens/Session.tsx`, komponen `Summary`)

- Nongol begitu sesi ditutup: jumlah jawaban, lama sesi, jumlah koreksi, dan
  frasa yang kesimpan.
- Daftar semua koreksi (salah → benar + alasannya) dan frasa yang ditangkap.
- Perbandingan sama sesi sebelumnya di topik yang sama, pakai **koreksi per 10
  jawaban** biar adil walau jumlah jawabannya beda. Butuh kolom baru di API:
  `corrections` di `GET /api/topics/{id}/runs`.
- Sesi yang belum nyampe 10 jawaban: ringkasannya sekalian jadi konfirmasi
  keluar (**Lanjut ngobrol** / **Keluar aja**) — ini yang nutup **B11**
  (`window.confirm`).
- Sesi yang udah tersimpan dapat tombol **Ulangi topik ini** (sesi baru, topik
  sama).

**2. Latihan ulang frasa** (`src/screens/Review.tsx`, migrasi `006_review.sql`)

- Kolom baru di `phrases`: `box` (1-5), `next_review_at`, `last_result`,
  `reviewed_at`, `reviews`.
- Jadwal kotak Leitner: **1, 3, 7, 14, 30 hari**. *Pas* naik satu kotak,
  *hampir* kotaknya tetap, *belum* balik ke kotak 1; dua yang terakhir diulang
  besok. Frasa baru langsung jatuh tempo.
- Halaman `/ulang`: artinya yang ditampilin, kamu yang nyusun kalimat
  Inggrisnya — ketik atau pakai mic. Ada tombol nyerah, dengerin kalimat
  aslinya, dan penilaiannya bisa ditimpa manual.
- Penilaian otomatis di `src/lib/match.ts`: jarak Levenshtein **per kata**,
  tanda baca / huruf besar / aksen diabaikan, singkatan ("I'd" = "I would")
  disamain. ≥ 0.85 = pas, ≥ 0.5 = hampir, sisanya belum.
- `GET /api/phrases/due`, `POST /api/phrases/{id}/review`, dan `due` di
  `GET /api/state` — dipakai kartu "N frasa perlu diulang" di beranda dan
  tombol di Koleksi. Tiap frasa di Koleksi nampilin kotaknya.

**3. Metrik kelancaran** (`server/routes/progress.py`, bagian Kelancaran di Dashboard)

- `GET /api/progress`: 8 minggu terakhir (sesi, jawaban, koreksi, menit),
  minggu ini vs minggu lalu, topik aktif 7 hari, dan totalnya. Semua dihitung
  dari data yang udah ada — nggak ada kolom baru.
- Dashboard nampilin: menit ngomong minggu ini, **koreksi per 10 jawaban** plus
  bedanya sama minggu lalu, topik aktif, total ngomong.
- Dua grafik batang terpisah (jawaban per minggu, koreksi per 10 jawaban) —
  sengaja nggak digabung jadi satu grafik dua sumbu. Batangnya HTML/CSS, bukan
  SVG, biar angkanya tetap teks beneran ≥ 12px dan kebaca screen reader; ada
  juga `<details> Angkanya` buat baca nilainya persis.

**4. Area obrolan di HP** — begitu ada jawaban pertama, orb gede pindah ke
header jadi avatar kecil dan petunjuk "jawab minimal 10 kali" disembunyiin.
Diukur di 375×812: transkrip **61% → 77%** layar (laptop 71%).

**5. Contekan dari Bengkel** (`src/screens/Session.tsx`) — masalahnya: Bengkel
ditutup (apalagi pakai ESC), kalimatnya ikut hilang, jadi mau nggak mau
dihafal dalam hitungan detik.

- Kalimat yang lagi dipilih dilaporin ke layar sesi lewat prop `onPick`, jadi
  **semua** jalan keluar bawa kalimatnya: tombol Balik ngobrol, tombol ×,
  ESC, dan selesai latihan.
- Kartunya nempel di atas mic, teksnya **tersamar** (`filter: blur`). Ketuk =
  ngintip, nyamar lagi sendiri setelah 5 detik atau diketuk lagi.
- Hilang otomatis begitu kalimatnya kepakai (satu giliran kekirim), dan bisa
  dibuang manual lewat ×.
- Ingatannya tetap dipaksa kerja (recall dulu, ngintip kalau mentok), tapi
  obrolan nggak pernah buntu gara-gara lupa satu kalimat.

**6. "Latih dulu" di Bengkel** (`src/components/Drill.tsx`) — latihan kilat 3
langkah dengan bantuan yang makin dikit (*fading cues*):

1. Kalimatnya kelihatan — dengerin (bisa dipelanin), terus tirukan.
2. Cuma huruf awalnya (`C···· I g·· t·· b···· p······`) — ucapkan atau ketik.
3. Tanpa petunjuk sama sekali.

Jawabannya dinilai pakai `src/lib/match.ts` yang sama kayak latihan ulang
(gratis, nggak manggil AI); salah = kalimat aslinya dibuka lagi buat
dibandingin, plus tombol **Coba lagi**. Selesai = balik ngobrol, kalimatnya
otomatis jadi contekan. Semua langkah bisa dilewati — latihan ini opsional,
biar yang lagi buru-buru nggak ketahan.

**Cara ngetesnya:** akun uji sendiri (bukan akun kamu), mic & balasan AI
dipalsuin sementara biar nggak ada biaya dan nggak perlu ngomong; stub-nya
dibalikin sebelum commit, akun ujinya dihapus habis tes.

---

## Cara risetnya

- **Baca semua kode UI:** `Home.tsx`, `Session.tsx` (899 baris), `Bengkel.tsx`,
  `Dashboard.tsx`, `bits.tsx`, `styles.css` (670 baris), plus route & skema
  database yang terkait.
- **Lihat app-nya langsung** lewat Chrome headless yang dikendalikan skrip (Chrome
  DevTools Protocol), di lebar **390px (HP), 768px (tablet), 1024px, dan
  1440px (laptop)**. Hasilnya 26 screenshot, sebagian ada di [`img/`](img/).
- **Simulasi 36 topik** buat ngetes skala Home & Dashboard. Data topik disuntik
  di browser, bukan ditulis ke database.
- **Simulasi sesi di tengah jalan** (obrolan + kartu koreksi + rekaman) dan
  **Bengkel dengan hasil terjemahan**, pakai respons palsu. Nggak ada biaya LLM
  atau Azure.
- **Semua request yang nulis ke database diblok** selama audit. Log audit
  mencatat nol percobaan tulis.
- **Diukur, bukan dikira-kira:** rasio kontras (rumus luminans WCAG) di setiap
  teks yang kelihatan, ukuran tombol, ukuran font, fokus keyboard, dan error
  console.
- **Dibandingin** sama desain asli di `design/` dan pola dari app sejenis (lihat
  [Sumber](#sumber)).

---

## 1. Bug yang ketemu

Semua di bawah udah dicek ke kode dan/atau kelihatan di screenshot, kecuali yang
ditandai *(perlu dicek manual)*. Kolom **Status** dicek ulang ke kode per 14
September 2026; nomor baris di kolom Lokasi masih nomor baris waktu audit.

| # | Bug | Dampak ke user | Lokasi | Prioritas | Status |
|---|---|---|---|---|---|
| B1 | **Timer rekaman nggak pernah jadi menit.** Formatnya `` `0:${secs}` ``, jadi detik ke-75 tampil `0:75`. | Kelihatan rusak tiap ngomong lebih dari 1 menit | [Session.tsx:747](../../src/screens/Session.tsx#L747) | Tinggi | **Beres** (menit:detik) |
| B2 | **Orb Zii jadi kotak ungu** kalau sistem user nyalain "kurangi animasi". Bentuk bulatnya cuma datang dari `@keyframes breathe`; begitu animasinya dimatiin, `.orb` nggak punya `border-radius`. | Avatar Zii rusak di Sesi, Dashboard, dan layar loading | [styles.css:70](../../src/styles.css#L70), [:101](../../src/styles.css#L101), [:106](../../src/styles.css#L106) | Tinggi | **Beres** |
| B3 | **Topik "Pilihan hari ini" hilang dari grid dan hitungannya salah.** Grid buang topik hero, jadi "Sehari-hari · 4 topik" padahal ada 5, dan progres topik itu nggak pernah kelihatan. | Angka nggak cocok, topik kayak hilang | [Home.tsx:30-31](../../src/screens/Home.tsx#L30) | Sedang | **Beres** (beranda baru) |
| B4 | **"Pilihan hari ini" nggak pernah ganti.** Di-hardcode `OF_DAY = 'macet'`. | Label "hari ini" bohong | [Home.tsx:6](../../src/screens/Home.tsx#L6) | Sedang | **Beres** (`pickOfDay`) |
| B5 | **Bar progres palsu:** lebarnya 0% atau langsung 100% begitu pernah dites sekali. | Kelihatan "tuntas" padahal baru sekali coba | [Home.tsx:52](../../src/screens/Home.tsx#L52) | Sedang | **Beres** (bar dibuang) |
| B6 | **Highlight kata di Bengkel lari duluan.** Azure ngirim tanda baca sebagai event kata terpisah (`funny`, `!`), sedangkan kalimatnya dipecah per spasi (`funny!`). Tiap koma atau tanda tanya bikin highlight maju satu kata lebih cepat. | Highlight nggak sinkron sama suara | [Bengkel.tsx:174](../../src/components/Bengkel.tsx#L174), [:376](../../src/components/Bengkel.tsx#L376) | Sedang | **Belum** |
| B7 | **Tombol utama Bengkel menyesatkan.** "Pakai & Lanjut Ngobrol" cuma nutup panel, nggak "pakai" apa-apa. Aksi yang beneran nyimpen ("Simpan … ke koleksi frasa") cuma teks abu-abu di bawahnya, dan di HP ketutup, harus scroll dulu. | Frasa jarang kesimpan; user ngira kalimatnya dikirim | [Bengkel.tsx:467](../../src/components/Bengkel.tsx#L467), [:473](../../src/components/Bengkel.tsx#L473) | Tinggi | **Beres** ("Simpan frasa" & "Balik ngobrol", nempel di bawah) |
| B8 | **Spasi antar kata di kartu Bengkel melebar** ("Could  you  say"), karena tiap kata jadi item flex dengan `gap: 6px`. | Kalimat kelihatan aneh, susah dibaca | [styles.css:382](../../src/styles.css#L382) | Rendah | **Belum** |
| B9 | **`favicon.ico` 404** di tiap halaman. Nggak ada ikon tab, app icon, atau manifest. | Kelihatan belum jadi di tab browser / home screen HP | [index.html](../../index.html) | Rendah | **Sebagian**: favicon SVG ada; app icon & manifest belum |
| B10 | **Label momentum "hari" menyesatkan.** Momentum bukan jumlah hari (bisa naik 1 per hari main, bisa kepotong separuh), tapi tampil "2 hari". | User ngira streak | [Home.tsx:65](../../src/screens/Home.tsx#L65), [Session.tsx:517](../../src/screens/Session.tsx#L517) | Rendah | **Beres** (label "momentum") |
| B11 | **Konfirmasi keluar pakai `window.confirm` bawaan browser.** | Dialog abu-abu bawaan OS, beda gaya sama app | [Session.tsx:485](../../src/screens/Session.tsx#L485) | Rendah | **Belum** |
| B12 | **Bengkel di HP nggak punya backdrop.** Tombol kembali di header sesi masih bisa diketuk selagi Bengkel kebuka. | Bisa keluar sesi nggak sengaja | [styles.css:346](../../src/styles.css#L346) | Rendah | **Belum** |
| B13 | **Dropdown nggak punya tanda fokus keyboard** (`outline: none`). Pas di-Tab, nggak ada yang nyala. | Pengguna keyboard nggak tahu posisinya | [styles.css:186](../../src/styles.css#L186) | Sedang | **Beres** di halaman sidebar & form |
| B14 | **Kartu versi di Bengkel `role="button"` tapi di dalamnya ada tombol lain** (dengerin, pelanin, geser). | Screen reader bingung, interaksi bertumpuk | [Bengkel.tsx:332](../../src/components/Bengkel.tsx#L332) | Rendah | **Belum** |
| B15 | **Teks Inggris nggak ditandai `lang="en"`.** Halamannya `lang="id"`, jadi screen reader ngebaca kalimat Inggris pakai lafal Indonesia. | Aksesibilitas | bubble di Session & Bengkel | Rendah | **Sebagian**: Dashboard & Koleksi beres; Sesi & Bengkel belum |
| B16 | *(perlu dicek manual)* **Contoh suara bunyi berulang kalau dropdown suara diganti pakai panah keyboard.** Tiap `change` langsung muter preview. | Berisik waktu lihat-lihat suara | [bits.tsx:150](../../src/components/bits.tsx#L150) | Rendah | **Belum dicek** |

<table>
<tr>
<td align="center"><img src="img/sess-rec-m.png" width="260"><br><sub>B1: timer <code>0:75</code> · B2: orb kotak</sub></td>
<td align="center"><img src="img/bengkel-result-m.png" width="260"><br><sub>B7: "Simpan" ketutup · B8: spasi kata melebar</sub></td>
<td align="center"><img src="img/home-m-full.png" width="220"><br><sub>B3: "4 topik" padahal 5 · B5: bar kosong semua</sub></td>
</tr>
</table>

---

## 2. Temuan desain per layar

### 2.1 Home

> **Status:** beres. Home diganti beranda **Latihan** (lihat 4.2); daftar semua
> topik pindah ke halaman **Topik**.

<table>
<tr>
<td align="center"><img src="img/home-many-m-full.png" width="200"><br><sub>36 topik di HP: 2.899px scroll</sub></td>
<td align="center"><img src="img/home-many-d.png" width="520"><br><sub>36 topik di laptop 1440px</sub></td>
</tr>
</table>

**Masalah skala (yang kamu tanyain):**

- **Semua topik ditumpuk jadi satu grid panjang.** 35 kartu = 2.899px scroll di
  HP. Nggak ada cari, filter, urutkan, atau "lihat semua". Topik yang paling
  relevan (belum dicoba, udah lama nggak dilatih) sama beratnya kayak yang lain.
- **Cuma dua grup, dan dikunci di database:**
  `CHECK (grp IN ('daily', 'work'))` di
  [001_init.sql:5](../../server/migrations/001_init.sql#L5). Nambah kategori
  "Travel" atau "Kesehatan" butuh migrasi skema.
- **Kartu topik isinya minim:** ikon, nama, dan bar palsu (B5). Deskripsi, kapan
  terakhir dilatih, dan jumlah sesi nggak kelihatan. Padahal datanya ada.

**Masalah hierarki:**

- **Pengaturan teknis di atas konten.** "MODEL LLM" dan "SUARA ZII" makan ±130px
  di HP sebelum user lihat satu topik pun. Ini keputusan sekali pakai, bukan
  keputusan tiap buka app.
- **Peringatan untuk developer ditampilin ke user:** "Copy `.env.example` jadi
  `.env`, isi key-nya, terus restart `npm run dev`"
  ([Home.tsx:90](../../src/screens/Home.tsx#L90)).
- **Dua tombol Mulai buat hal yang sama:** tombol "Mulai" di kartu hero dan
  tombol besar "Mulai Pilihan Hari Ini" yang nempel di bawah.
- **Pilih topik lewat klik sekali, mulai lewat klik dua kali**
  ([Home.tsx:44](../../src/screens/Home.tsx#L44)). Klik dua kali nggak ketemu
  sendiri dan nggak ada padanannya di layar sentuh.
- **Navigasi nyamar jadi statistik.** "Dashboard" bentuknya pil yang sama kayak
  "2 hari" dan "0 frasa", jadi nggak kebaca sebagai menu.

**Masalah layout desktop:**

- Konten dikunci di kolom **720px** di layar 1440px. ±700px ruang kosong, dan
  kartu jadi lebar-tipis.
- Tombol CTA yang nempel di bawah **nutupin baris kartu** (lihat screenshot laptop).

### 2.2 Sesi ngobrol

> **Status:** sebagian. Timer (B1), kontras, ukuran teks, dan target sentuh udah
> beres. Temuan di bawah (area obrolan, ringkasan, istilah, kartu koreksi, rail
> laptop) masih berlaku.

<table>
<tr>
<td align="center"><img src="img/sess-open-m.png" width="220"><br><sub>Awal sesi di HP</sub></td>
<td align="center"><img src="img/sess-mid-m.png" width="220"><br><sub>Tengah sesi + kartu koreksi</sub></td>
<td align="center"><img src="img/sess-mid-d.png" width="420"><br><sub>Laptop: rail kiri hampir kosong</sub></td>
</tr>
</table>

- **Area obrolan cuma ±61% layar HP.** Header + progres + orb makan ±200px
  (24%) dan dock ±130px (15%). Orb 64px plus cincinnya tetap segede itu walaupun
  obrolannya udah panjang ([Session.tsx:574](../../src/screens/Session.tsx#L574)).
- **Nggak ada ringkasan waktu sesi selesai.** "Selesai sesi" langsung balik ke
  Home. Koreksi, frasa yang ditangkap, durasi, dan "tes #3 tersimpan" nggak
  pernah dirangkum. Ini momen paling pas buat bikin user ngerasa maju.
- **Istilah campur aduk:** progres bilang "2/10 **pertanyaan**", padahal yang
  dihitung jawaban kamu. Dashboard nulis "**Jawaban** 1". Dashboard juga pakai
  "tes", Home pakai "sesi"/"ngobrol".
- **Kartu koreksi selalu "Hampir bener!"**
  ([Session.tsx:864](../../src/screens/Session.tsx#L864)), apa pun kesalahannya.
  Setelah 5 kali jadi hambar.
- **Rail kiri di laptop (264px) isinya cuma satu item** "Sesi ini" plus tombol
  "Selesai sesi". Statistik momentum di rail juga nggak punya ikon api kayak di
  Home.
- **Di 1024px dengan Bengkel kebuka, area obrolan kejepit jadi 400px**
  (1024 − rail 264 − panel 360).
- **Counter frasa di header HP cuma angka** tanpa label atau ikon yang jelas.

### 2.3 Bengkel Kalimat

> **Status:** sebagian. Hierarki tombol (B7), kontras, dan ukuran teks udah beres;
> tombol panah sekarang 36px (44px di layar sentuh). Elemen per kartu, 6 kalimat
> sekaligus, dan edit kalimat Indonesia masih berlaku.

<table>
<tr>
<td align="center"><img src="img/bengkel-empty-m.png" width="220"><br><sub>HP: sheet tanpa backdrop</sub></td>
<td align="center"><img src="img/bengkel-result-1024.png" width="420"><br><sub>1024px: obrolan kejepit 400px</sub></td>
</tr>
</table>

- **Hierarki tombol kebalik (B7).** Aksi paling berharga (simpan frasa) paling
  pudar. Aksi yang cuma nutup panel paling mencolok, dan labelnya bilang "Pakai".
- **Terlalu banyak elemen per kartu:** tag gaya, petunjuk, 1/3, centang, tombol
  dengerin, Pelanin, panah kiri, 3 titik, panah kanan. Tombol panah cuma 26×26px.
- **Konsep dua kartu × tiga pilihan (6 kalimat) berat buat orang yang lagi
  blank.** Pertimbangkan tampilin 1 pilihan terbaik per gaya dulu, dengan tombol
  "pilihan lain".
- **Kalimat Indonesia yang barusan diucapin** nggak bisa diedit langsung; harus
  lewat "Ketik aja", yang ngeganti seluruh kotak.

### 2.4 Dashboard & Tambah topik

> **Status:** sebagian. Kotak statistik redundan, kotak yang dorong detail di
> HP, dan campur fungsi (tambah topik) udah beres; cari & urutkan ada di halaman
> Topik. Edit/arsip topik, bantuan bikin skenario, dan pilihan warna yang lebih
> banyak belum. Kategori sekarang bisa ditambah dari app.

<table>
<tr>
<td align="center"><img src="img/dash-detail-d.png" width="470"><br><sub>Laptop: daftar + detail + transkrip</sub></td>
<td align="center"><img src="img/dash-detail-m.png" width="200"><br><sub>HP: 5 kotak statistik dorong detail ke bawah</sub></td>
</tr>
</table>

- **Kotak statistiknya redundan.** "Total topik 36 = Sudah dites 7 + Belum dites
  29" makan tiga kotak ([Dashboard.tsx:150](../../src/screens/Dashboard.tsx#L150)).
  Nggak ada satu pun yang jawab "aku makin lancar?".
- **Di HP, 5 kotak itu tetap nongol di atas detail topik** (±300px) sebelum
  tombol Retest kelihatan.
- **Daftar 36 topik tanpa cari & urutkan.** Filternya cuma sudah/belum dites
  ([Dashboard.tsx:126](../../src/screens/Dashboard.tsx#L126)).
- **Topik cuma bisa ditambah**, nggak bisa diedit, diarsipkan, dihapus, atau
  diurutkan. API-nya cuma `GET` dan `POST`
  ([topics.py:88](../../server/routes/topics.py#L88)).
- **Dashboard campur dua fungsi:** *manajemen topik* (tambah) dan *laporan
  progres* (riwayat tes). Dua-duanya setengah jadi karena nempel di satu layar.
- **Form tambah topik** udah oke (ada pratinjau), tapi grupnya cuma 2 dan
  warnanya cuma 6. Skenario ditulis mentah dalam bahasa Inggris, dan belum ada
  bantuan kayak "bikinin skenario dari deskripsi".

![Form tambah topik](img/form-d.png)

---

## 3. Sistem visual & aksesibilitas

> **Status:** kontras, ukuran teks, dan target sentuh udah beres di **semua**
> layar (angka di [Lampiran](#setelah-perbaikan-14-september-2026)). Utang CSS
> (3.4) dan arah visual Sesi & Bengkel (3.5) baru sebagian.

### 3.1 Kontras warna (WCAG AA: teks normal ≥ 4.5:1)

Dihitung dari token asli di [styles.css](../../src/styles.css). Warna pengganti
dihitung supaya lolos di atas **dua** latar (`--paper` dan `--card`), sambil
jaga hue-nya.

| Dipakai buat | Sekarang | Rasio | Usulan | Rasio baru |
|---|---|---|---|---|
| `--muted` (label, sub-teks, di mana-mana) | `#a99cb5` | **2.42** | `#7d6a8e` | 4.54 |
| `--faint` (header tabel, jam transkrip) | `#c4b6ce` | **1.92** | `#836697` | 4.55 |
| Teks putih di tombol teal (Pakai & Lanjut, Simpan) | `#10b981` | **2.54** | `#0c855d` | 4.64 |
| Teks putih di tombol amber (Tangkap frasa) | `#ffb524` | **1.77** | teks `--ink` di atas amber | 9.29 |
| Teks putih di oranye (mic rekam, pita DIJEDA) | `#ff7a3d` | **2.59** | `#d64300` | 4.50 |
| Teks putih di biru (tag ID, ikon Jeda) | `#2e9bf0` | **2.97** | `#0f78cb` | 4.60 |
| Label "Jeda & Terjemah" | `#5f9bcf` | **2.79** | `#3475ad` | 4.57 |
| "Kenapa?" di kartu koreksi | `#a98f55` | **2.94** | `#846f42` | 4.53 |
| Status "Sudah dites" | `#0a8a61` di `#dcf7ec` | **3.85** | `#097c57` | 4.60 |
| Status "Belum dites" | `#d9531c` di `#fff0e8` | **3.63** | `#be4919` | 4.54 |
| Teks biasa `--ink-soft` | `#6b5f7d` | 5.51 | tetap | — |
| Teks putih di violet | `#7b3fe4` | 5.72 | tetap | — |

Pengukuran di halaman nemu **27 teks kontras rendah di Dashboard**, 40 di detail
topik, 24 di Bengkel, dan 9 di sesi HP. Paling parah: "Tangkap frasa" **1.77:1**,
jam di transkrip **1.85:1**, dan header tabel **1.92:1**.

> **Update:** beres di semua layar, dengan warna yang sedikit beda dari usulan:
>
> - Teks sekunder: token `--ink-mute` `#7d6a8e` (sesuai usulan). `--muted`
>   dihapus; `--faint` tinggal buat titik status.
> - Oranye: `--tang-ink` `#c94100` buat latar teks putih (4.95:1) & teks oranye;
>   `--tang-deep` `#9e3300` buat bayangannya.
> - Biru: `--sky-ink` `#0f6db8` buat latar teks/ikon putih & teks biru di latar
>   biru muda; `--sky-deep` `#0a5596` buat bayangannya.
> - Amber: tulisan & ikon di atas amber pakai `--ink`. Teal: `--teal-ink`
>   `#09805a` (tag Santai, "Masuk koleksi!", teks koreksi).
> - "Kenapa?" `#846f42` & label Jeda `#3475ad` sesuai usulan; coret di kartu
>   koreksi `#7a6a52`.

### 3.2 Ukuran teks

- **51 aturan CSS pakai font di bawah 12px**, dan 39 di antaranya ≤ 11px
  (9.5px ×6, 10px ×9, 10.5px ×11, 11px ×13).
- Di Dashboard HP ada **73 teks 10.5px** dan **70 teks 9.6px** yang kelihatan
  sekaligus.
- Label kecil yang juga pakai warna `--muted` = kecil **dan** pudar. Ini yang
  paling bikin kesan "belum rapi".

**Usulan skala tipografi** (6 langkah, bukan 26 ukuran kayak sekarang):
`12 · 14 · 16 · 20 · 24 · 32`. Label kapital boleh 12px dengan `letter-spacing`;
nggak ada teks di bawah 12px.

> **Update:** nol teks yang kelihatan di bawah 12px di semua layar. Di CSS tinggal
> **2 aturan** 11px (`.fld > span`, `.tf-lbl` di form tambah topik) yang ditimpa
> 13px di bawahnya. Skala tipografi 6 langkah belum dijadiin token.

### 3.3 Target sentuh

Acuan: WCAG 2.2 SC 2.5.8 minimal 24×24px; pedoman iOS/Android 44–48px.

| Elemen | Ukuran sekarang | Setelah perbaikan (layar sentuh) |
|---|---|---|
| Panah pilihan Bengkel | 26×26 | 44×44 (36×36 di laptop) |
| Chip "Ulangi" di bubble | 72×25 | 77×40 |
| Tutup Bengkel (×) | 32×32 | 44×44 (40×40 di laptop) |
| Tab filter Dashboard | ±100×31 | tinggi 40 |
| "Kenapa?" | 75×33 | 60×44 |
| Tombol kembali | 38×38 | 44×44 (40×40 di laptop) |

> **Update:** tombol "Simpan frasa" & "Balik ngobrol" di Bengkel 48px. Yang masih
> kecil: titik pilihan Bengkel 13×23px (panah di sebelahnya jadi alternatif).

### 3.4 Konsistensi & utang CSS

- **123 kode warna hex ditulis langsung** (59 unik) di luar token, ditambah
  **44 `style={{…}}` inline** di TSX. Ganti tema atau dark mode jadi mustahil
  tanpa bongkar semua.
- **CSS mati** dari desain asli yang nggak jadi dibangun: `.fcard`, `.side-head`
  (panel "Koleksi Frasa"), `.gloss`, `.pill`, `.dsp`, `.round.plain`.
- **Fokus keyboard cuma dirancang di satu tempat** (`.ver:focus-visible`). Selain
  itu ngandelin outline bawaan browser, atau dimatiin sama sekali (B13).
- **Nggak ada dark mode, favicon, atau manifest PWA**, padahal app ini
  mobile-first dan punya `theme-color`.

> **Update:** sebagian.
>
> - CSS mati `.fcard`, `.side-head`, `.gloss`, `.round.plain` dihapus, plus `.use`
>   & `.save` yang nggak kepakai lagi. Tinggal `.pill` & `.dsp`.
> - Ketemu bug baru dari class yang nabrak: `.ghost` (tombol "Kenapa?") nimpa
>   padding & font semua `.btn.ghost`. Udah diganti `.fix-toggle`.
> - Hex di `styles.css` sekarang **182 (98 unik)** karena halaman baru; inline
>   style 38. Belum dipindah ke token.
> - Favicon udah ada; manifest & dark mode belum. Fokus keyboard sekarang
>   dirancang di navigasi, tombol, chip, dropdown, baris daftar, dan tombol Koleksi.

### 3.5 Kenapa kesannya "kurang profesional"

Identitas visualnya kuat (violet, orb, Baloo 2), tapi dipakai terlalu keras di
**semua** tempat:

- **Bayangan 3D (`box-shadow: 0 6px 0`) di hampir semua tombol dan kartu.**
  Kalau semuanya menonjol, nggak ada yang menonjol.
- **Bobot font 800 di mana-mana**, termasuk label 10px dan angka tabel.
- **Animasi lucu di elemen serius** (kartu koreksi `wiggleIn`, `flipin`).
- **Bahasanya slang di pesan error dan instruksi teknis** ("belum kebaca", "cek
  .env dulu").

**Arah yang disarankan: "hangat tapi tenang".** Pertahankan violet dan orb
sebagai identitas, tapi:

- 3D shadow cuma buat **satu aksi utama per layar** (mic, Mulai). Sisanya flat
  dengan border halus.
- Judul Baloo 2 700, isi Nunito 400/600, angka pakai `tabular-nums`.
- Warna fungsional (amber/teal/oranye) cuma buat **status**, bukan dekorasi.
- Nada bahasa tetap santai di obrolan, tapi jelas dan baku di error, pengaturan,
  dan konfirmasi.

> **Update:** halaman sidebar, Koleksi, dan form udah pakai arah ini (kartu flat
> bertepi tipis, judul 700, angka `tabular-nums`). Tombol aksi Bengkel juga flat.
> Sisa Sesi & Bengkel masih gaya lama (3D, bobot 800, animasi); yang dirapiin baru
> warna & ukurannya.

---

## 4. Konsep yang perlu dirombak

### 4.1 Arsitektur informasi & navigasi

> **Status:** beres. Yang dibangun: Latihan, Topik, Koleksi, Dashboard (belum
> jadi Progres), Pengaturan. Di HP, kelimanya jadi tab bar (Pengaturan bukan ikon
> di header).

Sekarang cuma ada dua halaman (`/` dan `/dashboard`), dan navigasinya berupa pil
kecil. Usulan: **lima tujuan jelas**, dengan navigasi yang sama di semua layar
(kecuali saat sesi berlangsung).

| Tujuan | Isi | Menggantikan |
|---|---|---|
| **Latihan** (beranda) | Lanjutkan, rekomendasi hari ini, frasa yang perlu diulang | Home sekarang |
| **Topik** | Perpustakaan: cari, kategori, filter, urutkan, kelola | Grid Home + daftar Dashboard |
| **Koleksi** | Frasa tersimpan + latihan ulang | (belum ada) |
| **Progres** | Tren kelancaran, riwayat sesi, transkrip | Dashboard sekarang |
| **Pengaturan** | Model, suara, kecepatan, ekspresi, koreksi, diagnostik | Dropdown di Home |

- **HP:** tab bar bawah dengan 4 tujuan; Pengaturan lewat ikon di header Latihan.
- **Laptop:** sidebar kiri (pakai ulang gaya `.rail` yang udah ada) yang sama di
  semua halaman, nggak cuma di sesi.
- **Saat sesi:** navigasi disembunyiin; cuma header sesi + tombol keluar.

### 4.2 Beranda "Latihan": dirancang buat 100+ topik

> **Status:** beres, tanpa kartu "frasa perlu diulang" (nunggu latihan ulang di
> Koleksi). "Lanjutkan" dibangun sebagai kartu **Terakhir dilatih**, plus baris
> **Belum pernah dicoba** dan **Waktunya diulang**.

Beranda **nggak lagi nampilin semua topik**, tapi mutusin buat user:

```
┌────────────────────────────────┐
│ Hai! 🔥 momentum 5      ⚙      │
│                                │
│ ▶ LANJUTKAN                    │  ← sesi/topik terakhir, 1 ketuk
│   Meeting Survival · 6/10      │
│                                │
│ ★ REKOMENDASI HARI INI         │  ← rotasi harian yang beneran
│   Negosiasi Harga              │     (prioritas: belum dicoba /
│   belum pernah dicoba   [Mulai]│      paling lama nggak dilatih)
│                                │
│ ↻ 4 FRASA PERLU DIULANG  [Ulang]│  ← dari Koleksi
│                                │
│ Jelajah                  Semua›│
│ [Sehari-hari][Kerja][Travel]…  │  ← chip kategori → halaman Topik
│ ◻ Minta Tolong   ◻ Di Bandara  │  ← maks 4–6 kartu
│ ◻ Daily Standup  ◻ Ke Dokter   │
└────────────────────────────────┘
```

**Aturan "Rekomendasi hari ini" (ganti B4):** urutkan topik berdasarkan (1)
belum pernah dicoba, lalu (2) paling lama nggak dilatih. Pilih satu secara
deterministik per tanggal, supaya tetap sama seharian dan ganti besoknya. Nggak
butuh tabel baru; cukup data `topic_stats` yang udah ada.

### 4.3 Halaman "Topik": perpustakaan

> **Status:** sebagian. Cari, filter kategori & status, urutkan, daftar ringkas,
> dan tabel `categories` udah jadi. Kelola (edit, arsip, sematkan, atur urutan),
> `categories.icon`, `topics.archived_at`, `topics.pinned`, dan endpoint `PATCH`
> / `archive` belum.

```
┌─────────────────────────────────────────────┐
│ Topik                          [+ Tambah]   │
│ 🔍 Cari topik...                             │
│ [Semua 36][Sehari-hari 18][Kerja 17][Travel] │  ← kategori
│ Status: [Semua ▾]  Urutkan: [Terlama dilatih ▾] │
│ ─────────────────────────────────────────── │
│ 💬 Kenalan & Basa-basi        2 sesi · 20j  │  ← baris ringkas, bukan kartu besar
│    Nama, kerjaan, cuaca...                  │
│ ☕ Pesan & Beli               belum dicoba  │
│ ...                                         │
└─────────────────────────────────────────────┘
```

- **Tampilan daftar ringkas** jadi default. Muat 8–10 topik per layar HP,
  dibanding sekarang ±4 kartu.
- **Cari** dari nama + deskripsi. **Filter** kategori + status. **Urutkan**:
  terlama dilatih, terbaru ditambah, A–Z, paling sering.
- **Kelola:** edit, arsipkan (bukan hapus, supaya riwayat tes aman), sematkan
  favorit, atur urutan.
- **Info kartu yang berguna:** kategori, jumlah sesi, kapan terakhir, dan
  (setelah 4.7 ada) tren koreksi. Buang bar palsu.

**Perubahan data yang dibutuhin:**

- Tabel `categories (id, name, icon, sort_order)` + `topics.category_id`,
  menggantikan `CHECK (grp IN ('daily','work'))`. Data lama dimigrasi jadi dua
  kategori awal.
- Kolom `topics.archived_at`, `topics.pinned`.
- Endpoint `PATCH /api/topics/{id}` dan `POST /api/topics/{id}/archive`.

### 4.4 Sesi: fokus ke obrolan, tutup dengan ringkasan

> **Status:** belum digarap (yang udah dirapiin di Sesi cuma timer, warna, dan
> ukuran; lihat 2.2).

- **Header ringkas:** begitu ada ≥2 bubble, orb besar menyusut jadi avatar kecil
  di header. Area obrolan naik dari ±61% jadi ±75% layar HP.
- **Istilah dirapiin:** "2/10 jawaban", konsisten di sesi, ringkasan, dan
  Progres.
- **Dialog keluar pakai komponen app** (ganti B11), dengan pilihan jelas:
  "Lanjut ngobrol" / "Keluar tanpa simpan".
- **Kartu koreksi yang lebih informatif:** judul menyesuaikan jenis kesalahan
  ("Bentuk lampau", "Urutan kata"). Butuh field `kind` dari node `review`.
- **Layar ringkasan sesi (baru):**

```
┌────────────────────────────────┐
│        ✓ Tes #3 tersimpan       │
│   Kenalan & Basa-basi · 14 mnt  │
│                                │
│   12 jawaban · 3 koreksi        │
│   ▼ lebih sedikit dari tes #2 (5)│  ← perbandingan sama sesi sebelumnya
│                                │
│   YANG DIBETULIN                │
│   I go → I went                 │
│   I am freeze → I freeze        │
│                                │
│   FRASA DITANGKAP (2)           │
│   "I freeze and my mind..."     │
│                                │
│  [Ulangi topik]  [Topik lain]   │
└────────────────────────────────┘
```

Semua datanya udah ada: `messages.correction`, `test_runs.started_at/ended_at`,
dan tes sebelumnya di topik yang sama. Pola ini standar di app sejenis (Loora
nampilin ringkasan setelah tiap sesi).

### 4.5 Bengkel: satu tujuan per layar

> **Status:** sebagian. Label & hierarki tombol (B7) udah beres: "Simpan frasa"
> & "Balik ngobrol" sejajar di bawah, selalu kelihatan. Tampilan bertahap,
> backdrop HP (B12), dan spasi natural + highlight pakai offset (B8, B6) belum.

- **Ganti label & hierarki (B7):**
  - Tombol utama: **"Simpan frasa"** (atau "Tersimpan ✓").
  - Tombol sekunder: **"Balik ngobrol"** (dan `Esc`).
  - Keduanya sejajar di bawah, selalu kelihatan tanpa scroll.
- **Tampilan bertahap:** tampilin **1 pilihan terbaik** Formal + 1 Santai dulu,
  plus tombol "2 pilihan lain". Buat orang yang lagi blank, 6 kalimat itu
  terlalu banyak.
- **Backdrop di HP** (ganti B12), dan ketuk backdrop = tutup.
- **Spasi natural (B8):** render kalimat sebagai teks biasa. Highlight pakai
  `<mark>` per rentang karakter dari `textOffset` word boundary, bukan hitungan
  event. Ini sekaligus benerin B6.

### 4.6 Koleksi frasa + latihan ulang (fitur yang hilang)

> **Status:** sebagian. **Layar Koleksi** udah jadi (`/koleksi`): frasa Inggris,
> arti Indonesia, asal topik, tanggal; cari, filter per topik, dengerin, hapus.
> Endpoint `GET /api/phrases` & `DELETE /api/phrases/{id}` udah ada. **Latihan
> ulang** (kotak Leitner, kolom `box` / `next_review_at` / `last_result`, endpoint
> `review`) dan "ucapin sekarang" belum.

Sekarang frasa **cuma bisa masuk** ([state.py:102](../../server/routes/state.py#L102)),
nggak ada endpoint baca dan nggak ada layarnya. Desain aslinya punya panel
"Koleksi Frasa" (`design/Desktop.dc.html`), tapi yang tersisa di kode cuma
CSS-nya.

**Layar Koleksi:**

- Daftar frasa: Inggris, arti Indonesia, asal topik, tanggal. Bisa dicari &
  difilter per topik.
- Tiap frasa: dengerin (suara Zii), hapus, "ucapin sekarang".

**Latihan ulang ringan** (spaced repetition sederhana ala kotak Leitner):

1. Zii ngucapin arti Indonesianya → user ngomong versi Inggrisnya (STT yang
   udah ada).
2. Dicocokkan longgar (abaikan tanda baca/kapital) → "Pas" / "Hampir" /
   "Belum".
3. Pas → jadwal berikutnya lebih lama (1 → 3 → 7 → 14 hari). Belum → besok lagi.

**Data:** tambah kolom `phrases.box`, `phrases.next_review_at`,
`phrases.last_result`, plus endpoint `GET /api/phrases`,
`DELETE /api/phrases/{id}`, `POST /api/phrases/{id}/review`. Kartu "4 frasa
perlu diulang" di beranda baca dari `next_review_at <= now()`.

Ini pola yang umum di app belajar bahasa: Memrise punya "My words", Busuu dan
Ling punya bank kosakata yang diulang otomatis, dan review yang nempel ke
konteks obrolan disebut jadi pembeda app speaking yang serius (lihat
[Sumber](#sumber)).

### 4.7 Progres (pengganti Dashboard)

> **Status:** sebagian. Kotak "total / sudah / belum" udah diganti 4 kotak: sesi
> tersimpan, total jawaban (+ rata-rata per sesi), belum dicoba, dan terakhir
> latihan. Di HP kotaknya minggir waktu detail dibuka, dan manajemen topik udah
> pindah ke Topik. Metrik kelancaran, grafik mingguan, dan riwayat lintas topik
> belum. Namanya masih "Dashboard".

Ganti kotak "total topik / sudah / belum" dengan angka yang jawab **"aku makin
lancar?"**. Semuanya bisa dihitung dari tabel yang udah ada:

| Metrik | Dari mana |
|---|---|
| Menit ngomong minggu ini | `test_runs.ended_at − started_at` |
| Jawaban minggu ini | `count(messages where role='me')` |
| **Koreksi per 10 jawaban** (turun = membaik) | `messages.correction is not null` / jawaban |
| Frasa tersimpan / sudah hafal | `phrases`, `phrases.box` |
| Topik aktif 7 hari terakhir | `test_runs.topic_id` distinct |

- **Grafik mingguan sederhana:** jawaban & koreksi per 10 jawaban, 8 minggu
  terakhir.
- **Riwayat sesi lintas topik** (sekarang cuma bisa per topik) dengan transkrip
  yang udah ada.
- **Di HP:** detail sesi jadi halaman sendiri; kotak statistik nggak ikut di
  atasnya.
- **Manajemen topik pindah** ke halaman Topik (4.3).

### 4.8 Pengaturan & onboarding

> **Status:** sebagian. Halaman Pengaturan udah ada: suara + contoh, model AI,
> aturan sesi, dan status sistem (LLM, Azure Speech, LangSmith). Kecepatan
> bicara, ekspresi on/off, koreksi on/off, target jawaban, status database, dan
> onboarding belum.

**Pengaturan:**

- Suara Zii + contoh.
- Model AI.
- Kecepatan bicara Zii.
- Ekspresi suara on/off.
- Tampilkan koreksi selama sesi on/off.
- Target jawaban per sesi (sekarang di-hardcode 10).
- **Diagnostik:** status LLM / Azure / database, dengan pesan `.env` yang
  sekarang ada di Home.

**Onboarding pertama kali (3 langkah):**

1. Izin mikrofon + tes suara.
2. Cara ngomong: tahan mic / `SPASI`, ketuk lagi buat betulin, `M` buat Bengkel.
3. Pilih suara Zii + 2–3 topik minat → isi "Rekomendasi hari ini" pertama.

Praktika dan Loora sama-sama pakai onboarding yang nanya minat buat nyusun
rencana latihan (lihat [Sumber](#sumber)).

### 4.9 Kamus istilah (biar konsisten)

> **Status:** dipakai di halaman sidebar & Koleksi. Sesi masih nulis "Tes #n
> tersimpan" di progres; kartu koreksi masih "Hampir bener!".

| Pakai | Jangan campur dengan | Arti |
|---|---|---|
| **Sesi** | tes, obrolan | Satu kali latihan dengan Zii |
| **Sesi tersimpan** | tes | Sesi yang sampai target jawaban |
| **Jawaban** | pertanyaan | Satu giliran kamu ngomong |
| **Koreksi** | fix, hampir bener | Kartu kuning pembetulan |
| **Frasa** | kartu, koleksi | Kalimat yang kamu simpan |
| **Momentum** | hari, streak | Skor konsistensi (bukan jumlah hari) |

---

## 5. Roadmap usulan

Dicentang = beres per 14 September 2026.

### Fase 1.5 — Rapiin yang ada (± 2–3 hari)

- [x] B1 timer menit:detik
- [x] B2 orb punya `border-radius` dasar
- [x] B3 + B4 + B5 hero, rotasi harian, buang bar palsu
- [x] B7 tombol Bengkel ("Simpan frasa" & "Balik ngobrol")
- [ ] B8 + B6 spasi kata, highlight pakai offset
- [x] B11 konfirmasi keluar in-app (jadi bagian ringkasan sesi)
- [x] Token warna AA (tabel 3.1) + minimal font 12px + fokus keyboard
- [ ] Favicon, app icon, manifest — *favicon beres; app icon & manifest belum*
- [ ] Istilah (4.9) + konfirmasi keluar in-app — *istilah beres di halaman sidebar; Sesi & konfirmasi keluar belum*
- [ ] Hapus CSS mati; pindahin hex & inline style ke token — *sebagian besar CSS mati udah dihapus; hex & inline style belum*

### Fase 2a — Struktur (± 1–2 minggu)

- [x] Navigasi app (tab bar HP, sidebar laptop)
- [x] Halaman **Pengaturan** (model & suara pindah dari Home)
- [x] Tabel **kategori** + halaman **Topik** (cari, filter, urutkan)
- [ ] **Edit & arsip** topik
- [x] Beranda **Latihan** baru (Lanjutkan, Rekomendasi, Jelajah)

### Fase 2b — Siklus belajar (± 1–2 minggu)

- [x] **Ringkasan sesi**
- [x] **Koleksi frasa**: lihat, cari, filter, dengerin, hapus
- [x] **Latihan ulang** frasa (kotak Leitner) + kartu "frasa perlu diulang" di beranda
- [x] **Progres** dengan metrik kelancaran (menit ngomong, koreksi per 10 jawaban, grafik 8 minggu)
- [x] **Contekan** dari Bengkel + **Latih dulu** (3 langkah, bantuannya makin dikit)

### Fase 2c — Poles (menyusul)

- [ ] Onboarding pertama kali
- [ ] Dark mode (setelah token warna rapi)
- [ ] Pecah `Session.tsx` (sekarang 907 baris) jadi komponen kecil
- [ ] Jadiin skrip audit visual ini bagian dari cek rutin sebelum rilis

### Fase 3 — Akun & online

Detailnya di [Login & akun](#login--akun).

- [x] **Login email & password**, data per akun, akun pertama admin
- [ ] **Login Google** — *kolom `google_sub` udah disiapin; kerjain bareng online*
- [ ] **Topik & kategori per akun** — *sekarang masih dipakai bareng*
- [ ] **Batas pemakaian AI per akun** (chat, Bengkel, token suara)
- [x] **Full container**: app + Postgres jalan di Docker (`Dockerfile`, `docker-compose.yml`, `npm run docker:up`)
- [ ] **Online**: domain + HTTPS, batas salah password pindah ke database
- [ ] Lupa password & verifikasi email
- [ ] Menu admin
- [ ] Pendaftaran tertutup / kode undangan

### Urutan berikutnya yang disarankan

Siklus belajarnya (ringkasan sesi, latihan ulang, metrik kelancaran, area
obrolan HP, contekan & Latih dulu di Bengkel) udah beres 20 Sep — lihat
[Siklus belajar](#siklus-belajar).

1. **Sisa bug kecil Sesi & Bengkel:** B8 + B6 (highlight & spasi kata), B12
   (backdrop HP), B14 + B15 (aksesibilitas).
2. **Edit & arsip topik,** sekalian mutusin topik per akun.
3. **Pengaturan yang belum ada:** kecepatan bicara, ekspresi on/off, koreksi
   on/off, target jawaban, status database.
4. **Poles latihan ulang:** filter per topik, dan catat berapa kali contekan
   diintip sebagai tanda frasa itu masih susah.

---

## 6. Keputusan yang perlu kamu ambil

Jawaban ini ngubah desain fase 2:

1. ~~**Satu pengguna atau nanti banyak pengguna (login)?**~~ **Diputuskan 15
   Sep: banyak pengguna.** Login email & password dulu; Google, topik per akun,
   batas pemakaian AI, dan online menyusul. Akun pertama jadi admin dan dapet
   data lama. Lihat [Login & akun](#login--akun).
2. **Prioritas perangkat: HP atau laptop?** Menentukan navigasi mana yang
   dirancang duluan.
3. **Arah visual:** tetap ceria ala Duolingo tapi lebih rapi, atau lebih kalem
   ala Speak/Loora? Section 3.5 ngusulin di tengah-tengah.
4. **Perlu level kesulitan per topik** (misal A2/B1/B2)? Kalau iya, masukin ke
   tabel kategori/topik sekalian di Fase 2a.
5. **"Tes minimal 10 jawaban" tetap jadi syarat tersimpan**, atau semua sesi
   dicatat (dengan tanda "lengkap/belum")? Ini ngaruh ke angka di Progres.

---

## Lampiran

### Angka pengukuran

#### Waktu audit (13 September 2026)

| Layar | Teks dicek | Kontras rendah | Tombol < 44px | Font < 12px |
|---|---|---|---|---|
| Home HP | 36 | 7 | 4 | 17 |
| Home HP, 36 topik | 90 | 11 | 4 | 44 |
| Dashboard laptop, 36 topik | 244 | 27 | 4 | 87 |
| Detail topik laptop | 279 | 40 | 4 | 106 |
| Dashboard HP | 300 | 23 | 5 | 185 |
| Form tambah topik | 261 | 32 | 29 | 99 |
| Sesi HP (awal) | 12 | 5 | 2 | 6 |
| Sesi HP (tengah) | 23 | 9 | 6 | 8 |
| Bengkel HP (hasil) | 81 | 24 | 24 | 23 |
| Sesi laptop | 33 | 12 | 6 | 13 |
| Bengkel laptop | 90 | 27 | 24 | 27 |

- Horizontal overflow: **nggak ada** di semua layar yang dicek.
- Error console: cuma `favicon.ico` 404. Error `/api/speech/token` 503 sengaja
  dari audit, karena Azure dimatiin.
- Kontras dihitung dengan rumus luminans relatif WCAG 2.x terhadap latar efektif
  (warna latar induk + opacity). Latar gradien diabaikan, jadi teks di atas orb
  atau gradien bisa sedikit meleset.

#### Setelah perbaikan (14 September 2026)

Diukur dengan cara yang sama, dengan AI & Azure Speech aktif (tombol Mulai nyala).
HP = 375px dengan layar sentuh, laptop = 1280px.

**Halaman sidebar & form** (sampai commit `931f351`):

| Layar | Kontras rendah | Font < 12px | Kontrol < 44px | Overflow |
|---|---|---|---|---|
| Latihan HP | 0 | 0 | 0 | nggak ada |
| Topik HP | 0 | 0 | 5 (tombol status 40px ×3, kotak cari 42px, urutkan 42px) | nggak ada |
| Form tambah topik HP | 0 | 0 | 0 | — |
| Dashboard HP | 0 | 0 | 3 (tombol status 40px) | nggak ada |
| Pengaturan HP | 0 | 0 | 0 | nggak ada |
| Latihan laptop | 0 | 0 | 2 link teks tingginya 19px ("Lihat semua", "Semua topik") | nggak ada |
| Topik laptop | 0 | 0 | kotak ketik cari 22px (bingkainya 44px) | nggak ada |
| Dashboard laptop | 0 | 0 | 0 | nggak ada |
| Pengaturan laptop | 0 | 0 | 0 | nggak ada |

**Sesi, Bengkel & Koleksi** (perbaikan Sesi, Bengkel & Koleksi):

| Layar | Kontras rendah | Font < 12px | Kontrol di bawah acuan | Catatan |
|---|---|---|---|---|
| Sesi HP (awal + contoh kartu koreksi) | 0 | 0 | chip "Ulangi" 40px, "Kenapa?" 43px | — |
| Bengkel HP (hasil terjemahan) | 0 | 0 | "Ngomong ulang", "Ketik aja", "Pelanin", dengerin 40px; titik pilihan 13×23px | tombol aksi 48px, nempel di bawah layar (812/812px) |
| Pita DIJEDA | 0 (4.95:1) | 0 | — | — |
| Sesi + Bengkel laptop | 0 | 0 | titik pilihan 13×23px | tombol aksi nempel di bawah panel (800/800px), nggak ada scroll horizontal |
| Rail sesi laptop | 0 | 0 | 0 | — |
| Tab bar HP (5 menu) | — | — | — | tiap tab 69px, nggak ada label kepotong |
| Koleksi HP | 0 | 0 | kotak ketik cari 42px (bingkainya 44px) | tombol dengerin & hapus 44px |
| Koleksi laptop | 0 | 0 | kotak ketik cari 23px (bingkainya 44px) | — |

- Kolom kontrol HP pakai acuan 44px, laptop pakai acuan WCAG 24px.
- Nama topik kepotong di Dashboard: **nol** di 1024px, 1280px, dan HP (dulu
  "Saat K…" di 1280px).
- Buat Sesi & Bengkel, respons chat, terjemahan, dan token suara dipalsukan di
  browser (nggak ada biaya AI, nggak ada suara). Kartu koreksi cuma muncul setelah
  rekaman mic, jadi diukur dari contoh kartu yang disisipkan sementara ke halaman.
- Simpan & hapus frasa diuji ke database asli lewat UI, lalu dihapus lagi. Data
  sesi contoh buat ngecek kartu "Terakhir dilatih" & transkrip juga dihapus lagi.

### Screenshot

Semua di [`img/`](img/), diambil dengan data asli + simulasi waktu audit
(kondisi **sebelum** perbaikan):
`home-m-full`, `home-d`, `home-many-m-full`, `home-many-d`, `sess-open-m`,
`sess-mid-m`, `sess-rec-m`, `sess-mid-d`, `bengkel-empty-m`, `bengkel-result-m`,
`bengkel-result-d`, `bengkel-result-1024`, `dash-many-d`, `dash-detail-d`,
`dash-detail-m`, `form-d`.

### Sumber

- [AI Voice Language Learning Apps – ISSEN (Juli 2026)](https://www.issen.com/blog/ai-language-learning-apps-voice-practice/): Loora (role-play, pelajaran harian, ringkasan setelah sesi), Praktika (rencana harian dari minat, onboarding), review kosakata yang nempel ke obrolan
- [Best AI English Speaking Apps – ISSEN](https://www.issen.com/blog/best-ai-apps-for-learning-english-speaking/)
- [10 Best AI Language Learning Apps for Speaking – Talkio](https://www.talkio.ai/blog/best-ai-language-speaking-practice-apps-in-2026)
- [App Showcase: Loora AI – ScreensDesign](https://screensdesign.com/showcase/speak-english-with-loora-ai)
- [Praktika](https://praktika.ai/)
- [8 Best Spaced Repetition Apps – Lingopie](https://lingopie.com/blog/spaced-repetition/): Memrise "My words", Busuu vocabulary trainer
- [Best Spaced Repetition Apps for Vocabulary – Ling](https://ling-app.com/blog/best-spaced-repetition-apps-for-vocabulary/)
- [Spaced Repetition – Busuu](https://www.busuu.com/en/languages/spaced-repetition)
- WCAG 2.2: SC 1.4.3 Contrast (Minimum), SC 2.5.8 Target Size (Minimum), SC 2.4.7 Focus Visible, SC 3.1.2 Language of Parts
