import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/icons';
import { TopicForm } from '../components/TopicForm';
import { createCategory, type AppConfig, type Category, type Topic } from '../lib/api';
import { filterTopics, sortTopics, statusText, SORTS, STATUSES, type Sort, type Status } from '../lib/topics';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* Filter ikut di URL (?q=&kategori=&status=&urut=): link dari Latihan langsung
   kebuka dengan filter yang pas, dan balik dari sesi tetap di tempat yang sama. */
function readParams() {
  const p = new URLSearchParams(location.search);
  const status = p.get('status');
  const sort = p.get('urut');
  return {
    q: p.get('q') ?? '',
    category: p.get('kategori'),
    status: (STATUSES.some((s) => s.id === status) ? status : 'all') as Status,
    sort: (SORTS.some((s) => s.id === sort) ? sort : 'default') as Sort,
    adding: p.get('tambah') === '1',
  };
}

export function Topics({
  cfg,
  topics,
  categories,
  onStart,
  onRefresh,
}: {
  cfg: AppConfig;
  topics: Topic[];
  categories: Category[];
  onStart: (id: string) => void;
  onRefresh: () => Promise<unknown>;
}) {
  const init = useMemo(readParams, []);
  const [q, setQ] = useState(init.q);
  const [category, setCategory] = useState<string | null>(init.category);
  const [status, setStatus] = useState<Status>(init.status);
  const [sort, setSort] = useState<Sort>(init.sort);
  const [adding, setAdding] = useState(init.adding);
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const search = useRef<HTMLInputElement | null>(null);

  const modelReady = cfg.models.some((m) => m.ready);
  /* kategori di URL udah nggak ada (salah ketik / link lama) = anggap "Semua" */
  const activeCat = category && categories.some((c) => c.id === category) ? category : null;

  useEffect(() => {
    const prev = document.title;
    document.title = 'Topik — Zii Talk';
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (activeCat) p.set('kategori', activeCat);
    if (status !== 'all') p.set('status', status);
    if (sort !== 'default') p.set('urut', sort);
    const qs = p.toString();
    const url = `/topik${qs ? `?${qs}` : ''}`;
    if (location.pathname + location.search !== url) history.replaceState(null, '', url);
  }, [q, activeCat, status, sort]);

  /* "/" = langsung ke kotak cari, kayak di kebanyakan web app */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== '/' || adding) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [adding]);

  const perCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of topics) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
    return m;
  }, [topics]);

  /* angka di tombol status ngikut kategori & kata kunci yang lagi aktif */
  const statusCounts = useMemo(() => {
    const base = filterTopics(topics, { q, category: activeCat, status: 'all' });
    const tested = base.filter((t) => t.tests).length;
    return { all: base.length, untested: base.length - tested, tested } satisfies Record<Status, number>;
  }, [topics, q, activeCat]);

  const shown = useMemo(
    () => sortTopics(filterTopics(topics, { q, category: activeCat, status }), sort),
    [topics, q, activeCat, status, sort],
  );

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
  const filtered = q.trim() !== '' || activeCat !== null || status !== 'all';
  const reset = () => {
    setQ('');
    setCategory(null);
    setStatus('all');
  };

  const addCategory = async (name: string) => {
    const c = await createCategory(name);
    await onRefresh();
    setCategory(c.id);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Topik</h1>
          <p>
            {topics.length} topik di {categories.length} kategori
          </p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={17} />
          Tambah topik
        </button>
      </header>

      {err && <div className="err dash-err">{err}</div>}

      <div className="lib">
        <aside className="lib-side" aria-label="Kategori">
          <div className="lib-lbl">Kategori</div>
          <button className={`lib-cat${activeCat === null ? ' on' : ''}`} aria-pressed={activeCat === null} onClick={() => setCategory(null)}>
            <span>Semua topik</span>
            <i>{topics.length}</i>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`lib-cat${activeCat === c.id ? ' on' : ''}`}
              aria-pressed={activeCat === c.id}
              onClick={() => setCategory(c.id)}
            >
              <span>{c.name}</span>
              <i>{perCategory.get(c.id) ?? 0}</i>
            </button>
          ))}
          <NewCategory onCreate={addCategory} />
        </aside>

        <section className="lib-main">
          <div className="lib-tools">
            <label className="search">
              <Icon name="search" size={17} />
              <input
                ref={search}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && q) {
                    e.preventDefault();
                    setQ('');
                  }
                }}
                placeholder="Cari nama atau deskripsi topik"
                aria-label="Cari topik"
              />
              {q ? (
                <button
                  type="button"
                  className="search-x"
                  onClick={() => {
                    setQ('');
                    search.current?.focus();
                  }}
                  aria-label="Hapus pencarian"
                >
                  <Icon name="x" size={14} />
                </button>
              ) : (
                <kbd className="kb-only">/</kbd>
              )}
            </label>

            <div className="seg" role="group" aria-label="Status topik">
              {STATUSES.map((s) => (
                <button key={s.id} className={status === s.id ? 'on' : ''} aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
                  {s.label}
                  <i>{statusCounts[s.id]}</i>
                </button>
              ))}
            </div>

            <label className="sort">
              <span>Urutkan</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={15} />
            </label>
          </div>

          {/* HP: kategori jadi chip yang bisa digeser, gantiin sidebar */}
          <div className="chips m-only" role="group" aria-label="Kategori">
            <button className={`chip-btn${activeCat === null ? ' on' : ''}`} aria-pressed={activeCat === null} onClick={() => setCategory(null)}>
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip-btn${activeCat === c.id ? ' on' : ''}`}
                aria-pressed={activeCat === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.name} · {perCategory.get(c.id) ?? 0}
              </button>
            ))}
          </div>

          <div className="lib-meta">
            <span>{shown.length === topics.length ? `${topics.length} topik` : `${shown.length} dari ${topics.length} topik`}</span>
            {filtered && (
              <button className="link" onClick={reset}>
                Reset filter
              </button>
            )}
            <span className="lib-rule">
              <Icon name="info" size={15} />
              Sesi tersimpan kalau kamu jawab minimal {cfg.minAnswers} kali — kurang dari itu dianggap nggak ada.
            </span>
          </div>

          {shown.length > 0 ? (
            <ul className="tlist">
              {shown.map((t) => (
                <li key={t.id} id={`topic-${t.id}`} className={`tl-row${fresh === t.id ? ' fresh' : ''}`}>
                  <i className="tico" style={{ background: t.tint, color: t.ink }}>
                    <Icon name={t.icon} size={19} />
                  </i>
                  <div className="tl-main">
                    <b>{t.name}</b>
                    {t.blurb && <span>{t.blurb}</span>}
                  </div>
                  <div className="tl-meta">
                    <span className="tl-cat">{catName(t.categoryId)}</span>
                    <span className={`tl-status${t.tests ? ' done' : ''}`}>{statusText(t)}</span>
                  </div>
                  <button
                    className="btn primary sm tl-go"
                    disabled={!modelReady}
                    onClick={() => onStart(t.id)}
                    aria-label={`Mulai sesi ${t.name}`}
                  >
                    <Icon name="mic" size={15} />
                    Mulai
                  </button>
                </li>
              ))}
            </ul>
          ) : topics.length === 0 ? (
            <div className="empty">
              <b>Belum ada topik</b>
              <span>Tambah topik pertama kamu buat mulai latihan.</span>
              <button className="btn primary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} />
                Tambah topik
              </button>
            </div>
          ) : (
            <div className="empty">
              <b>Nggak ada topik yang cocok</b>
              <span>{q.trim() ? `Coba kata lain selain “${q.trim()}”, atau longgarin filternya.` : 'Coba ubah filternya.'}</span>
              <button className="btn ghost" onClick={reset}>
                Reset filter
              </button>
            </div>
          )}
        </section>
      </div>

      {adding && (
        <TopicForm
          categories={categories}
          initialCategory={activeCat}
          onCategoriesChanged={onRefresh}
          onClose={() => setAdding(false)}
          onSaved={(t) => {
            setAdding(false);
            /* tampilin topik barunya: filter dibuka ke kategorinya, lalu di-scroll & disorot */
            setQ('');
            setStatus('all');
            setSort('default');
            setCategory(t.categoryId);
            setFresh(t.id);
            window.setTimeout(() => setFresh(null), 2200);
            onRefresh()
              .then(() =>
                requestAnimationFrame(() =>
                  document.getElementById(`topic-${t.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
                ),
              )
              .catch((e) => setErr(errText(e)));
          }}
        />
      )}
    </div>
  );
}

function NewCategory({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setName('');
    setErr(null);
  };

  if (!open) {
    return (
      <button className="lib-new" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} />
        Kategori baru
      </button>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onCreate(n);
      close();
    } catch (e2) {
      setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="lib-newform" onSubmit={submit}>
      <input
        autoFocus
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        placeholder="Nama kategori"
        aria-label="Nama kategori baru"
      />
      <div className="lib-newacts">
        <button type="submit" className="btn primary sm" disabled={!name.trim() || busy}>
          {busy ? <span className="spin" /> : 'Tambah'}
        </button>
        <button type="button" className="btn ghost sm" onClick={close}>
          Batal
        </button>
      </div>
      {err && <p className="lib-err">{err}</p>}
    </form>
  );
}
