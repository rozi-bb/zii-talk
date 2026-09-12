-- Topik latihan. id = slug (kebaca di URL dashboard), bukan angka.
CREATE TABLE topics (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  grp         text NOT NULL CHECK (grp IN ('daily', 'work')),
  icon        text NOT NULL,
  tint        text NOT NULL,
  ink         text NOT NULL,
  blurb       text NOT NULL DEFAULT '',
  -- skenario buat Zii; tiap sesi dipilih satu secara acak
  situations  text[] NOT NULL CHECK (cardinality(situations) > 0),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Satu sesi tes. Baru ditulis begitu jawaban ke-10 masuk: sesi yang
-- berhenti sebelum itu dianggap nggak pernah ada.
CREATE TABLE test_runs (
  id              uuid PRIMARY KEY,  -- dibikin browser waktu sesi dibuka
  topic_id        text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  attempt_no      integer NOT NULL,  -- tes ke-berapa buat topik ini
  situation       text NOT NULL DEFAULT '',
  model           text NOT NULL,
  question_count  integer NOT NULL DEFAULT 0,  -- = jumlah jawabanku
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz NOT NULL,        -- aktivitas terakhir
  UNIQUE (topic_id, attempt_no)
);

-- Transkrip. seq = posisi di layar sesi (mulai 0, salam pembuka Zii).
CREATE TABLE messages (
  run_id      uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  role        text NOT NULL CHECK (role IN ('ai', 'me')),
  text        text NOT NULL,
  correction  jsonb,  -- kartu koreksi {wrong, right, why}, cuma di jawabanku
  created_at  timestamptz NOT NULL,
  PRIMARY KEY (run_id, seq)
);

CREATE TABLE phrases (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  en          text NOT NULL,
  meaning     text NOT NULL DEFAULT '',
  topic_id    text REFERENCES topics(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX phrases_en_key ON phrases (lower(en));

-- Usernya cuma satu, jadi state-nya cuma satu baris.
CREATE TABLE app_state (
  id           smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  model        text NOT NULL DEFAULT '',
  momentum     integer NOT NULL DEFAULT 0,
  last_played  date
);
INSERT INTO app_state DEFAULT VALUES;

-- Status "sudah/belum dites" sengaja dihitung, bukan disimpan sebagai flag:
-- angkanya nggak mungkin beda sama data aslinya.
CREATE VIEW topic_stats AS
SELECT
  t.id,
  count(r.id)::int                        AS tests,
  coalesce(sum(r.question_count), 0)::int AS questions,
  max(r.ended_at)                         AS last_tested_at
FROM topics t
LEFT JOIN test_runs r ON r.topic_id = t.id
GROUP BY t.id;
