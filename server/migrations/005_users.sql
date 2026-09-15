-- Akun & sesi login. Sebelumnya app ini satu user, jadi data lama belum punya
-- pemilik (user_id NULL). Akun pertama yang dibikin jadi admin dan ngambil
-- semuanya — lihat create_user di server/auth.py.
CREATE TABLE users (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          text NOT NULL,
  -- null = akun tanpa password (disiapin buat login Google)
  password_hash  text,
  google_sub     text UNIQUE,
  role           text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Token aslinya cuma ada di cookie browser; di sini yang disimpan sha256-nya.
CREATE TABLE sessions (
  token_hash  bytea PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- app_state: dari satu baris buat semua jadi satu baris per akun
ALTER TABLE app_state DROP COLUMN id;
ALTER TABLE app_state ADD COLUMN user_id bigint UNIQUE REFERENCES users(id) ON DELETE CASCADE;

-- frasa kembar dicegah per akun, bukan buat semua orang
ALTER TABLE phrases ADD COLUMN user_id bigint REFERENCES users(id) ON DELETE CASCADE;
DROP INDEX phrases_en_key;
CREATE UNIQUE INDEX phrases_user_en_key ON phrases (user_id, lower(en));

-- tes #1, #2, ... dihitung per akun per topik
ALTER TABLE test_runs ADD COLUMN user_id bigint REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE test_runs DROP CONSTRAINT test_runs_topic_id_attempt_no_key;
ALTER TABLE test_runs ADD CONSTRAINT test_runs_user_topic_attempt_key UNIQUE (user_id, topic_id, attempt_no);
CREATE INDEX test_runs_user_topic_idx ON test_runs (user_id, topic_id);

-- Statistik topik sekarang per akun, dihitung langsung di server/routes/topics.py.
-- View lama ngitung tes semua orang jadi satu.
DROP VIEW topic_stats;
