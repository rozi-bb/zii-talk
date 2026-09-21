import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { Topics } from './screens/Topics';
import { Collection } from './screens/Collection';
import { Review } from './screens/Review';
import { Dashboard } from './screens/Dashboard';
import { Settings } from './screens/Settings';
import { Login } from './screens/Login';
import { Shell } from './components/Shell';

/* SDK Azure Speech gede; dimuat baru saat sesi dibuka. */
const Session = lazy(() => import('./screens/Session').then((m) => ({ default: m.Session })));
import { Orb } from './components/bits';
import {
  addPhrase,
  loadCategories,
  loadConfig,
  loadMe,
  loadState,
  loadTopics,
  logout,
  saveModel,
  saveVoice,
  SIGNED_OUT,
  SignedOut,
  touchMomentum,
  type AppConfig,
  type AppState,
  type AuthInfo,
  type Category,
  type Phrase,
  type Topic,
} from './lib/api';
import { usePath } from './lib/nav';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* halaman di dalam Shell; path lain jatuh ke Latihan */
const PAGES = ['/', '/topik', '/koleksi', '/ulang', '/dashboard', '/pengaturan'];

export default function App() {
  const [path, go] = usePath();
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [st, setSt] = useState<AppState | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  /* sesi yang lagi jalan + halaman buat balik habis selesai. `n` naik tiap
     "Ulangi topik" dari ringkasan sesi — dipakai sebagai key biar sesinya
     bener-bener mulai dari nol. */
  const [active, setActive] = useState<{ id: string; back: string; n: number } | null>(null);

  const user = auth?.user ?? null;

  useEffect(() => {
    loadMe()
      .then(setAuth)
      .catch((e) => setFatal(errText(e)));
    /* request mana pun yang dapet 401 = sesi login habis, balik ke halaman Masuk */
    const expired = () => setAuth({ user: null, firstAccount: false });
    window.addEventListener(SIGNED_OUT, expired);
    return () => window.removeEventListener(SIGNED_OUT, expired);
  }, []);

  /* semua data di bawah ini punya akun yang lagi login — ganti akun = muat ulang dari nol */
  useEffect(() => {
    setCfg(null);
    setSt(null);
    setTopics(null);
    setCategories(null);
    setActive(null);
    if (!user) return;
    let live = true;
    Promise.all([loadConfig(), loadState(), loadTopics(), loadCategories()])
      .then(([c, s, t, k]) => {
        if (!live) return;
        setCfg(c);
        setTopics(t);
        setCategories(k);
        if (s.model && c.models.some((m) => m.id === s.model)) {
          setSt(s);
          return;
        }
        const first = c.models.find((m) => m.ready) ?? c.models[0];
        setSt({ ...s, model: first ? first.id : '' });
        if (first) saveModel(first.id).catch(() => {});
      })
      .catch((e) => {
        if (live && !(e instanceof SignedOut)) setFatal(errText(e));
      });
    return () => {
      live = false;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* gagal (server mati) = tetap login; error-nya ditampilin di Pengaturan */
  const signOut = async () => {
    await logout();
    setAuth({ user: null, firstAccount: false });
    go('/');
  };

  /* topik & kategori selalu dimuat bareng: jumlah per kategori ngikut topiknya */
  const refresh = useCallback(
    () =>
      Promise.all([loadTopics(), loadCategories()]).then(([t, k]) => {
        setTopics(t);
        setCategories(k);
      }),
    [],
  );

  /* Model & suara dipegang browser (dropdown-nya bisa diganti selagi request
     lain masih jalan) — balasan server cuma dipakai buat angka lainnya. */
  const merge = (s: AppState) =>
    setSt((prev) => (prev ? { ...s, model: prev.model, voice: prev.voice } : s));

  const start = (id: string) => {
    setActive({ id, back: location.pathname + location.search, n: 0 });
    touchMomentum().then(merge).catch(() => {}); // momentum itu bonus, jangan halangin sesi
  };

  if (fatal) {
    return (
      <div className="app" style={{ placeContent: 'center', padding: 24, display: 'grid' }}>
        <div className="warn">
          <div>
            <b>Nggak bisa nyambung ke server.</b>
            <br />
            {fatal}
          </div>
        </div>
      </div>
    );
  }

  if (!auth) return <Booting label="Nyalain Zii..." />;
  if (!user) {
    return (
      <div className="app">
        <Login firstAccount={auth.firstAccount} onDone={(u) => setAuth({ user: u, firstAccount: false })} />
      </div>
    );
  }
  if (!cfg || !st || !topics || !categories) return <Booting label="Nyalain Zii..." />;

  const topic = active && topics.find((t) => t.id === active.id);
  if (active && topic) {
    return (
      <div className="app">
        <Suspense fallback={<Booting label="Nyiapin mikrofon..." />}>
          <Session
            key={`${active.id}#${active.n}`}
            cfg={cfg}
            topic={topic}
            model={st.model}
            voice={st.voice}
            frasa={st.phrases}
            momentum={st.momentum}
            onPhrase={(p: Phrase) => {
              addPhrase(p, topic.id).then(merge).catch(() => {});
            }}
            onExit={() => {
              setActive(null);
              go(active.back);
              refresh().catch(() => {});
            }}
            /* "Ulangi topik" dari ringkasan sesi: sesi baru, topik yang sama */
            onRestart={() => {
              setActive({ ...active, n: active.n + 1 });
              refresh().catch(() => {});
              touchMomentum().then(merge).catch(() => {});
            }}
          />
        </Suspense>
      </div>
    );
  }

  const page = PAGES.includes(path) ? path : '/';
  const needsSetup = !cfg.models.some((m) => m.ready) || !cfg.speech.ready;

  return (
    <div className="app">
      <Shell
        path={page}
        go={go}
        email={user.email}
        momentum={st.momentum}
        phrases={st.phrases}
        needsSetup={needsSetup}
      >
        {page === '/topik' ? (
          <Topics cfg={cfg} topics={topics} categories={categories} onStart={start} onRefresh={refresh} />
        ) : page === '/koleksi' ? (
          <Collection cfg={cfg} voice={st.voice} due={st.due} go={go} onChanged={merge} />
        ) : page === '/ulang' ? (
          <Review cfg={cfg} model={st.model} voice={st.voice} go={go} onDue={(due) => setSt((s) => s && { ...s, due })} />
        ) : page === '/dashboard' ? (
          <Dashboard cfg={cfg} topics={topics} categories={categories} onRefresh={refresh} onStart={start} />
        ) : page === '/pengaturan' ? (
          <Settings
            cfg={cfg}
            state={st}
            user={user}
            onLogout={signOut}
            onModel={(model) => {
              setSt((s) => s && { ...s, model });
              saveModel(model).catch(() => {});
            }}
            onVoice={(voice) => {
              setSt((s) => s && { ...s, voice });
              saveVoice(voice).catch(() => {});
            }}
          />
        ) : (
          <Home cfg={cfg} topics={topics} categories={categories} state={st} onStart={start} go={go} />
        )}
      </Shell>
    </div>
  );
}

function Booting({ label }: { label: string }) {
  return (
    <div className="app" style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
      <Orb size={58} />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>{label}</div>
    </div>
  );
}
