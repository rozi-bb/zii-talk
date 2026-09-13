-- Suara Zii yang dipilih dari dropdown di Home.
-- Kosong = belum pernah milih; server yang nentuin default-nya (server/voices.py).
ALTER TABLE app_state ADD COLUMN voice text NOT NULL DEFAULT '';
