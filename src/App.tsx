import { lazy, Suspense, useEffect, useState } from 'react';
import { Home } from './screens/Home';

/* SDK Azure Speech gede; dimuat baru saat sesi dibuka. */
const Session = lazy(() => import('./screens/Session').then((m) => ({ default: m.Session })));
import { Orb } from './components/bits';
import { loadConfig, type AppConfig, type Phrase } from './lib/api';
import { load, save, touchMomentum, addPhrase, type State } from './lib/store';
import { byId } from './data/topics';

export default function App() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [st, setSt] = useState<State>(() => load());
  const [picked, setPicked] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    loadConfig()
      .then((c) => {
        setCfg(c);
        setSt((s) => {
          const ok = s.model && c.models.some((m) => m.id === s.model);
          if (ok) return s;
          const first = c.models.find((m) => m.ready) ?? c.models[0];
          return { ...s, model: first ? first.id : '' };
        });
      })
      .catch((e) => setFatal(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    save(st);
  }, [st]);

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

  if (!cfg) return <Booting label="Nyalain Zii..." />;

  if (active) {
    const topic = byId(active);
    return (
      <div className="app">
        <Suspense fallback={<Booting label="Nyiapin mikrofon..." />}>
        <Session
          key={active}
          cfg={cfg}
          topic={topic}
          model={st.model}
          frasa={st.collection.length}
          momentum={st.momentum}
          onPhrase={(p: Phrase) => setSt((s) => addPhrase(s, p, topic.id))}
          onExit={(turns) => {
            setSt((s) => ({
              ...s,
              progress: { ...s.progress, [topic.id]: Math.max(s.progress[topic.id] ?? 0, Math.min(8, turns)) },
            }));
            setActive(null);
          }}
        />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <Home
        cfg={cfg}
        state={st}
        picked={picked}
        onPick={setPicked}
        onModel={(model) => setSt((s) => ({ ...s, model }))}
        onStart={(id) => {
          setSt((s) => touchMomentum(s));
          setActive(id);
        }}
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
