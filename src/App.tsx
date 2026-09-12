import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { Dashboard } from './screens/Dashboard';

/* SDK Azure Speech gede; dimuat baru saat sesi dibuka. */
const Session = lazy(() => import('./screens/Session').then((m) => ({ default: m.Session })));
import { Orb } from './components/bits';
import {
  addPhrase,
  loadConfig,
  loadState,
  loadTopics,
  saveModel,
  touchMomentum,
  type AppConfig,
  type AppState,
  type Phrase,
  type Topic,
} from './lib/api';
import { usePath } from './lib/nav';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function App() {
  const [path, go] = usePath();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [st, setSt] = useState<AppState | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  /* sesi yang lagi jalan + halaman buat balik habis selesai (Home / dashboard) */
  const [active, setActive] = useState<{ id: string; back: string } | null>(null);

  useEffect(() => {
    Promise.all([loadConfig(), loadState(), loadTopics()])
      .then(([c, s, t]) => {
        setCfg(c);
        setTopics(t);
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

  const refresh = useCallback(() => loadTopics().then(setTopics), []);

  /* Model dipegang browser (dropdown-nya bisa diganti selagi request lain
     masih jalan) — balasan server cuma dipakai buat angka lainnya. */
  const merge = (s: AppState) => setSt((prev) => (prev ? { ...s, model: prev.model } : s));

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

  if (!cfg || !st || !topics) return <Booting label="Nyalain Zii..." />;

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

  if (path === '/dashboard') {
    return (
      <div className="app">
        <Dashboard cfg={cfg} topics={topics} onRefresh={refresh} onStart={start} go={go} />
      </div>
    );
  }

  return (
    <div className="app">
      <Home
        cfg={cfg}
        topics={topics}
        state={st}
        picked={picked}
        onPick={setPicked}
        onModel={(model) => {
          setSt((s) => s && { ...s, model });
          saveModel(model).catch(() => {});
        }}
        onStart={start}
        go={go}
      />
    </div>
  );
}

function Booting({ label }: { label: string }) {
  return (
    <div className="app" style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
      <Orb size={58} />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}
