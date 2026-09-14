import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { Topics } from './screens/Topics';
import { Collection } from './screens/Collection';
import { Dashboard } from './screens/Dashboard';
import { Settings } from './screens/Settings';
import { Shell } from './components/Shell';

/* SDK Azure Speech gede; dimuat baru saat sesi dibuka. */
const Session = lazy(() => import('./screens/Session').then((m) => ({ default: m.Session })));
import { Orb } from './components/bits';
import {
  addPhrase,
  loadCategories,
  loadConfig,
  loadState,
  loadTopics,
  saveModel,
  saveVoice,
  touchMomentum,
  type AppConfig,
  type AppState,
  type Category,
  type Phrase,
  type Topic,
} from './lib/api';
import { usePath } from './lib/nav';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* halaman di dalam Shell; path lain jatuh ke Latihan */
const PAGES = ['/', '/topik', '/koleksi', '/dashboard', '/pengaturan'];

export default function App() {
  const [path, go] = usePath();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [st, setSt] = useState<AppState | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  /* sesi yang lagi jalan + halaman buat balik habis selesai */
  const [active, setActive] = useState<{ id: string; back: string } | null>(null);

  useEffect(() => {
    Promise.all([loadConfig(), loadState(), loadTopics(), loadCategories()])
      .then(([c, s, t, k]) => {
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
      .catch((e) => setFatal(errText(e)));
  }, []);

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
    setActive({ id, back: location.pathname + location.search });
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

  if (!cfg || !st || !topics || !categories) return <Booting label="Nyalain Zii..." />;

  const topic = active && topics.find((t) => t.id === active.id);
  if (active && topic) {
    return (
      <div className="app">
        <Suspense fallback={<Booting label="Nyiapin mikrofon..." />}>
          <Session
            key={active.id}
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
          />
        </Suspense>
      </div>
    );
  }

  const page = PAGES.includes(path) ? path : '/';
  const needsSetup = !cfg.models.some((m) => m.ready) || !cfg.speech.ready;

  return (
    <div className="app">
      <Shell path={page} go={go} momentum={st.momentum} phrases={st.phrases} needsSetup={needsSetup}>
        {page === '/topik' ? (
          <Topics cfg={cfg} topics={topics} categories={categories} onStart={start} onRefresh={refresh} />
        ) : page === '/koleksi' ? (
          <Collection cfg={cfg} voice={st.voice} go={go} onChanged={merge} />
        ) : page === '/dashboard' ? (
          <Dashboard cfg={cfg} topics={topics} categories={categories} onRefresh={refresh} onStart={start} />
        ) : page === '/pengaturan' ? (
          <Settings
            cfg={cfg}
            state={st}
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
