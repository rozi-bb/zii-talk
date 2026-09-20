-- Latihan ulang frasa (kotak Leitner). Kotak 1-5 = jarak ulangnya makin jauh:
-- 1, 3, 7, 14, 30 hari (angkanya di server/routes/state.py).
--
-- Frasa yang udah ada langsung jatuh tempo (next_review_at = now()), jadi
-- koleksi lama nggak perlu nunggu buat mulai dilatih.
ALTER TABLE phrases
  ADD COLUMN box             smallint    NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  ADD COLUMN next_review_at  timestamptz NOT NULL DEFAULT now(),
  -- hasil latihan terakhir; null = belum pernah dilatih
  ADD COLUMN last_result     text CHECK (last_result IN ('pas', 'hampir', 'belum')),
  ADD COLUMN reviewed_at     timestamptz,
  ADD COLUMN reviews         integer     NOT NULL DEFAULT 0;

CREATE INDEX phrases_due_idx ON phrases (user_id, next_review_at);
