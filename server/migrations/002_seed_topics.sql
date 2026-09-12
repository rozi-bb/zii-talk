-- 9 topik awal (dulu di src/data/topics.ts). Topik baru ditambah lewat
-- dashboard, bukan lewat file ini. String pakai $$...$$ biar tanda kutip
-- di skenario nggak perlu di-escape.
INSERT INTO topics (id, name, grp, icon, tint, ink, blurb, situations, sort_order) VALUES
(
  'macet', $$Saat Kamu Macet$$, 'daily', 'ring', '#E9E1FF', '#6B36D6',
  $$8 kalimat penyelamat biar obrolan nggak mati di tengah jalan.$$,
  ARRAY[
    $$Chat naturally, but speak in a way that is a little fast and uses one uncommon word or idiom sometimes. If the learner seems to fumble for a word or hesitates, naturally offer: "you can just say... " or "were you trying to say...?" Never announce that this is a lesson.$$,
    $$Chat naturally about anything, staying fully on what the learner just said. Every third reply or so, phrase your own sentence in a slightly quick or run-on way. If the learner asks you to repeat or slow down, happily do it and say something like "good question, sure". Do not comment on the learner's grammar in this situation — that is handled elsewhere.$$
  ],
  1
),
(
  'kenalan', $$Kenalan & Basa-basi$$, 'daily', 'chat', '#E9E1FF', '#6B36D6',
  $$Nama, kerjaan, cuaca, weekend — pembuka yang kepakai terus.$$,
  ARRAY[
    $$You just met the learner at a co-working space. Small talk: name, what they do, how long they have been here.$$,
    $$Monday morning small talk about the weekend.$$
  ],
  2
),
(
  'pesan', $$Pesan & Beli$$, 'daily', 'cup', '#FFE8D8', '#E0630F',
  $$Kafe, resto, toko, ojek — transaksi sehari-hari.$$,
  ARRAY[
    $$You are a friendly barista. The learner is ordering coffee, asking about sizes and paying.$$,
    $$You are a shop assistant. The learner wants to ask the price and whether there is a smaller size.$$
  ],
  3
),
(
  'cerita', $$Cerita Kejadian$$, 'daily', 'clock', '#DCEEFF', '#1573C4',
  $$Tadi aku..., kemarin ada... — cerita hal yang udah lewat.$$,
  ARRAY[
    $$Ask the learner to tell you about something that happened to them recently. Keep pulling for details in past simple.$$
  ],
  4
),
(
  'pendapat', $$Pendapat & Rasa$$, 'daily', 'heart', '#FFE0EA', '#D63A73',
  $$Suka, nggak suka, setuju, nolak halus.$$,
  ARRAY[
    $$Chat about something the learner has an opinion on — a film, a city, a habit. Push them to agree, disagree and soften opinions.$$
  ],
  5
),
(
  'progres', $$Update Progres$$, 'work', 'chart', '#D7F4E7', '#0A8A61',
  $$Lagi ngerjain apa, kendalanya apa, kapan kelar.$$,
  ARRAY[
    $$You are a friendly team lead in a stand-up. Ask what the learner worked on, what is blocking them, and what is next.$$
  ],
  6
),
(
  'meeting', $$Meeting Survival$$, 'work', 'people', '#E9E1FF', '#6B36D6',
  $$Interupsi, minta klarifikasi, minta diulang.$$,
  ARRAY[
    $$You are in a meeting talking a bit fast, sometimes running two points together. Occasionally ask a quick check like "does that make sense?" or "any questions?" so the learner has a natural moment to jump in and ask you to clarify or slow down.$$
  ],
  7
),
(
  'klien', $$Ngomong ke Klien$$, 'work', 'case', '#FFF0CE', '#B87C00',
  $$Nanya kebutuhan, kasih estimasi, geser jadwal.$$,
  ARRAY[
    $$You are a client. The learner needs to ask what you actually need, then give a timeline and reschedule a call.$$
  ],
  8
),
(
  'interview', $$Interview & Kenalan Pro$$, 'work', 'badge', '#DCEEFF', '#1573C4',
  $$Ngenalin diri secara profesional, jawab pertanyaan klasik.$$,
  ARRAY[
    $$You are a warm interviewer. Ask the learner to introduce themselves, then about a project they are proud of.$$
  ],
  9
);
