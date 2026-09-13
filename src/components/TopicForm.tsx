import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './icons';
import { TopicCard } from './TopicCard';
import { createCategory, createTopic, type Category, type Topic } from '../lib/api';

/* pilihan di form — diambil dari ikon & pasangan warna yang udah dipakai topik bawaan */
const ICONS = ['chat', 'cup', 'clock', 'heart', 'chart', 'people', 'case', 'badge', 'ring', 'bookmark', 'send', 'translate', 'keyboard', 'speaker'];
const COLORS = [
  { tint: '#E9E1FF', ink: '#6B36D6' },
  { tint: '#FFE8D8', ink: '#E0630F' },
  { tint: '#DCEEFF', ink: '#1573C4' },
  { tint: '#FFE0EA', ink: '#D63A73' },
  { tint: '#D7F4E7', ink: '#0A8A61' },
  { tint: '#FFF0CE', ink: '#B87C00' },
];

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* Form tambah topik: sheet bawah di HP, dialog di layar lebar.
   Kategori baru bisa dibikin langsung dari sini, tanpa pindah halaman. */
export function TopicForm({
  categories,
  initialCategory,
  onClose,
  onSaved,
  onCategoriesChanged,
}: {
  categories: Category[];
  initialCategory?: string | null;
  onClose: () => void;
  onSaved: (t: Topic) => void;
  /* muat ulang daftar kategori habis nambah yang baru */
  onCategoriesChanged: () => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(
    initialCategory && categories.some((c) => c.id === initialCategory) ? initialCategory : (categories[0]?.id ?? ''),
  );
  /* null = lagi nggak bikin kategori; string = isi kotak nama kategori baru */
  const [newCat, setNewCat] = useState<string | null>(categories.length ? null : '');
  const [catBusy, setCatBusy] = useState(false);
  const [blurb, setBlurb] = useState('');
  const [text, setText] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const situations = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const tooMany = situations.length > 5;
  /* kotak kategori baru masih kebuka = belum jelas topiknya masuk ke mana */
  const ready = name.trim() !== '' && categoryId !== '' && newCat === null && situations.length > 0 && !tooMany && !busy;

  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || busy || catBusy) return;
      if (newCat !== null && categories.length) setNewCat(null);
      else onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [busy, catBusy, newCat, categories.length, onClose]);

  async function addCategory() {
    const n = (newCat ?? '').trim();
    if (!n || catBusy) return;
    setCatBusy(true);
    setErr(null);
    try {
      const c = await createCategory(n);
      await onCategoriesChanged();
      setCategoryId(c.id);
      setNewCat(null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setCatBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      onSaved(
        await createTopic({ name: name.trim(), categoryId, blurb: blurb.trim(), situations, icon, ...COLORS[color] }),
      );
    } catch (e2) {
      setErr(errText(e2));
      setBusy(false);
    }
  }

  const onNewCatKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // jangan sampai ngirim form topiknya
      void addCategory();
    }
  };

  return (
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form className="sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="tf-title">
        <div className="handle" />
        <div className="bk-head">
          <div style={{ flex: 1 }}>
            <b id="tf-title">Tambah topik</b>
            <p>Langsung muncul di Latihan, Topik, dan Dashboard.</p>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="tf-grid">
          <div className="tf-fields">
            <label className="fld">
              <span>Nama topik</span>
              <input
                autoFocus
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Telepon & Voice Note"
              />
            </label>

            <div className="fld">
              <span>Kategori</span>
              {newCat === null ? (
                <div className="cat-pick">
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Kategori">
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn ghost sm" onClick={() => setNewCat('')}>
                    <Icon name="plus" size={15} />
                    Kategori baru
                  </button>
                </div>
              ) : (
                <div className="cat-pick">
                  <input
                    autoFocus
                    maxLength={40}
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={onNewCatKey}
                    placeholder="mis. Travel"
                    aria-label="Nama kategori baru"
                  />
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={!newCat.trim() || catBusy}
                    onClick={() => void addCategory()}
                  >
                    {catBusy ? <span className="spin" /> : 'Tambah'}
                  </button>
                  {categories.length > 0 && (
                    <button type="button" className="btn ghost sm" onClick={() => setNewCat(null)}>
                      Batal
                    </button>
                  )}
                </div>
              )}
            </div>

            <label className="fld">
              <span>
                Deskripsi singkat <em>{blurb.length}/160</em>
              </span>
              <input
                maxLength={160}
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder="Angkat telepon, minta diulang, tutup dengan sopan."
              />
            </label>

            <label className="fld">
              <span>
                Skenario buat Zii <em>satu per baris · maks 5</em>
              </span>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="You call the learner about a late delivery. Ask them to confirm the address."
              />
              <small>Tulis dalam bahasa Inggris. Tiap sesi, Zii pilih satu secara acak.</small>
            </label>

            <div className="fld">
              <span>Ikon</span>
              <div className="swatches">
                {ICONS.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`ico-pick${icon === n ? ' on' : ''}`}
                    onClick={() => setIcon(n)}
                    aria-label={`Ikon ${n}`}
                    aria-pressed={icon === n}
                  >
                    <Icon name={n} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="fld">
              <span>Warna</span>
              <div className="swatches">
                {COLORS.map((c, i) => (
                  <button
                    type="button"
                    key={c.ink + c.tint}
                    className={`clr-pick${color === i ? ' on' : ''}`}
                    style={{ background: c.tint, color: c.ink }}
                    onClick={() => setColor(i)}
                    aria-label={`Warna ${i + 1}`}
                    aria-pressed={color === i}
                  >
                    <i style={{ background: c.ink }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="tf-preview" aria-hidden="true">
            <span className="tf-lbl">Pratinjau</span>
            <TopicCard
              categoryName={categories.find((c) => c.id === categoryId)?.name ?? 'Kategori'}
              topic={{
                id: 'preview',
                name: name.trim() || 'Nama topik',
                categoryId,
                icon,
                ...COLORS[color],
                blurb: blurb.trim() || 'Deskripsi singkat topiknya muncul di sini.',
                situations,
                tests: 0,
                questions: 0,
                lastTestedAt: null,
              }}
            />
          </div>
        </div>

        {tooMany && <div className="err">Skenario maksimal 5 — sekarang ada {situations.length}.</div>}
        {err && <div className="err">{err}</div>}

        <button className="use b3d" type="submit" disabled={!ready}>
          {busy ? <span className="spin" /> : <Icon name="check" size={20} />}
          <b>Simpan topik</b>
        </button>
      </form>
    </div>
  );
}
