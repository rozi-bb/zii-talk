import { Cards, Flame, Icon } from '../components/icons';
import { TopicCard } from '../components/TopicCard';
import type { AppConfig, AppState, Category, Topic } from '../lib/api';
import { linkTo, type Go } from '../lib/nav';
import { lastMs, lastPracticed, pickOfDay, statusText } from '../lib/topics';

/* kartu per baris di Latihan — sisanya lewat "Lihat semua" ke halaman Topik */
const ROW = 4;

/* Beranda "Latihan". Sengaja NGGAK nampilin semua topik: dia milihin yang
   paling perlu dilatih, dan daftar lengkapnya ada di halaman Topik. */
export function Home({
  cfg,
  topics,
  categories,
  state,
  onStart,
  go,
}: {
  cfg: AppConfig;
  topics: Topic[];
  categories: Category[];
  state: AppState;
  onStart: (id: string) => void;
  go: Go;
}) {
  const min = cfg.minAnswers;
  const modelReady = cfg.models.some((m) => m.ready);
  const missing = [!modelReady && 'AI', !cfg.speech.ready && 'Mic & suara'].filter((x): x is string => !!x);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  const last = lastPracticed(topics);
  const today = pickOfDay(topics, last?.id);
  /* yang udah nongol di kartu besar nggak diulang di baris bawah */
  const featured = new Set([today?.id, last?.id]);
  const rest = topics.filter((t) => !featured.has(t.id));
  const untested = rest.filter((t) => !t.tests);
  const stale = rest.filter((t) => t.tests).sort((a, b) => lastMs(a) - lastMs(b));
  const testedCount = topics.filter((t) => t.tests).length;

  const card = (t: Topic) => (
    <TopicCard
      key={t.id}
      topic={t}
      categoryName={catName(t.categoryId)}
      onStart={() => onStart(t.id)}
      disabled={!modelReady}
    />
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mau latihan apa hari ini?</h1>
          <p>
            {topics.length} topik di {categories.length} kategori · {testedCount} udah pernah tersimpan
          </p>
        </div>
        <div className="head-stats m-only">
          <div className="stat" title="Naik tiap hari kamu latihan, menyusut kalau lama nggak latihan">
            <Flame className="flame" />
            <b>{state.momentum}</b>
            <span>momentum</span>
          </div>
          <div className="stat" title="Frasa yang udah kamu simpan">
            <Cards />
            <b>{state.phrases}</b>
            <span>frasa</span>
          </div>
        </div>
      </header>

      {missing.length > 0 && (
        <a className="notice" {...linkTo('/pengaturan', go)}>
          <Icon name="info" size={18} />
          <span>
            <b>{missing.join(' & ')} belum siap</b>, jadi sesi belum bisa jalan. Lihat detailnya di Pengaturan.
          </span>
          <Icon name="right" size={16} />
        </a>
      )}

      {topics.length === 0 ? (
        <div className="empty">
          <b>Belum ada topik</b>
          <span>Tambah topik pertama kamu dulu, baru bisa mulai latihan.</span>
          <a className="btn primary" {...linkTo('/topik?tambah=1', go)}>
            <Icon name="plus" size={16} />
            Tambah topik
          </a>
        </div>
      ) : (
        <>
          <div className="feat-row">
            {today && (
              <article className="feat today">
                <div className="feat-kicker">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.6l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.1-5.3 3.1 1.3-6L3.4 8.8l6.1-.6L12 2.6Z" />
                  </svg>
                  Rekomendasi hari ini
                </div>
                <h2>{today.name}</h2>
                {today.blurb && <p>{today.blurb}</p>}
                <div className="feat-meta">
                  <span className="pill-soft">{catName(today.categoryId)}</span>
                  <span>{statusText(today)}</span>
                </div>
                <div className="feat-acts">
                  <button className="btn white" disabled={!modelReady} onClick={() => onStart(today.id)}>
                    <Icon name="mic" size={17} />
                    Mulai sesi
                  </button>
                  <span className="feat-note">Minimal {min} jawaban biar tersimpan</span>
                </div>
                <div className="feat-deco" aria-hidden="true">
                  <Icon name={today.icon} size={132} />
                </div>
              </article>
            )}

            {last ? (
              <article className="feat cont">
                <div className="feat-kicker">Terakhir dilatih</div>
                <div className="cont-head">
                  <i className="tico" style={{ background: last.tint, color: last.ink }}>
                    <Icon name={last.icon} size={20} />
                  </i>
                  <div>
                    <h3>{last.name}</h3>
                    <span>{catName(last.categoryId)}</span>
                  </div>
                </div>
                <p>{statusText(last)}</p>
                <button className="btn primary" disabled={!modelReady} onClick={() => onStart(last.id)}>
                  <Icon name="replay" size={16} />
                  Latih lagi
                </button>
              </article>
            ) : (
              <article className="feat cont">
                <div className="feat-kicker">Cara kerjanya</div>
                <h3>Sesi tersimpan setelah {min} jawaban</h3>
                <p>
                  Pilih topik, lalu ngobrol sama Zii pakai suara. Begitu kamu jawab {min} kali, sesinya selesai dan
                  masuk riwayat. Keluar sebelum itu, sesinya dianggap nggak ada.
                </p>
              </article>
            )}
          </div>

          {/* aturannya udah disebut di kartu rekomendasi / "Cara kerjanya" — ini cuma
              kalau dua-duanya nggak nongol */}
          {last && !today && (
            <p className="rule">
              <Icon name="info" size={16} />
              <span>
                Satu sesi baru <b>selesai & tersimpan</b> kalau kamu jawab minimal {min} kali. Kurang dari itu,
                sesinya dianggap nggak ada.
              </span>
            </p>
          )}

          {untested.length > 0 && (
            <section className="home-sec">
              <div className="sec-head">
                <h2>Belum pernah dicoba</h2>
                <span className="count">{topics.filter((t) => !t.tests).length} topik</span>
                <a className="link" {...linkTo('/topik?status=untested', go)}>
                  Lihat semua
                  <Icon name="right" size={15} />
                </a>
              </div>
              <div className="card-grid">{untested.slice(0, ROW).map(card)}</div>
            </section>
          )}

          {stale.length > 0 && (
            <section className="home-sec">
              <div className="sec-head">
                <h2>Waktunya diulang</h2>
                <span className="count">paling lama nggak dilatih duluan</span>
                <a className="link" {...linkTo('/topik?status=tested&urut=stale', go)}>
                  Lihat semua
                  <Icon name="right" size={15} />
                </a>
              </div>
              <div className="card-grid">{stale.slice(0, ROW).map(card)}</div>
            </section>
          )}

          <section className="home-sec">
            <div className="sec-head">
              <h2>Jelajah kategori</h2>
              <a className="link" {...linkTo('/topik', go)}>
                Semua topik
                <Icon name="right" size={15} />
              </a>
            </div>
            <div className="cat-grid">
              {categories.map((c) => {
                const list = topics.filter((t) => t.categoryId === c.id);
                const done = list.filter((t) => t.tests).length;
                return (
                  <a key={c.id} className="cat-tile" {...linkTo(`/topik?kategori=${encodeURIComponent(c.id)}`, go)}>
                    <div className="cat-icons" aria-hidden="true">
                      {list.slice(0, 3).map((t) => (
                        <i key={t.id} style={{ background: t.tint, color: t.ink }}>
                          <Icon name={t.icon} size={15} />
                        </i>
                      ))}
                    </div>
                    <b>{c.name}</b>
                    <span>
                      {list.length} topik · {done} udah dilatih
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
