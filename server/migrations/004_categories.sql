-- Kategori topik jadi tabel sendiri. Dulu dikunci di kolom topics.grp
-- (cuma 'daily' / 'work'); sekarang bisa ditambah dari aplikasi.
-- id-nya slug, sama kayak topik — kebaca di URL (/topik?kategori=daily).
CREATE TABLE categories (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_key ON categories (lower(name));

-- dua grup lama jadi dua kategori pertama, id-nya dipertahankan
INSERT INTO categories (id, name, sort_order) VALUES
  ('daily', 'Sehari-hari', 1),
  ('work', 'Buat Kerja', 2);

ALTER TABLE topics ADD COLUMN category_id text REFERENCES categories(id) ON DELETE RESTRICT;
UPDATE topics SET category_id = grp;
ALTER TABLE topics ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE topics DROP COLUMN grp;
CREATE INDEX topics_category_idx ON topics (category_id);
