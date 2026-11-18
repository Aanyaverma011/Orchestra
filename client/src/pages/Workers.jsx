import { useEffect, useState } from 'react';
import { Cpu, Info, Users } from 'lucide-react';
import api, { errorMessage } from '../api';
import { Empty, ErrorBanner, SkeletonRows } from '../components/atoms';
import { uptime } from '../lib/format';

export default function Workers() {
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.get('/admin/workers').then((r) => { if (alive) { setItems(r.data.items); setError(''); } }).catch((e) => alive && setError(errorMessage(e, 'Could not load workers.')));
      api.get('/admin/online-users').then((r) => alive && setPeople(r.data.items)).catch(() => {});
    };
    load();
    const poll = setInterval(load, 4000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); };
  }, []);

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="explain-banner">
        <Info size={18} />
        <div>
          <b>Workers are not people.</b> A worker is a background process that picks jobs off the queue and runs them. Signing in as another user never adds a worker.
          By default one worker runs. To add more, run <span className="mono">docker compose up -d --scale worker=3</span> and this page will show three.
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2><Users size={15} style={{ verticalAlign: -2, marginRight: 8 }} />People signed in</h2>
          <span className="sub">{people.length} online now</span>
        </div>
        {people.length === 0 ? (
          <div className="mini-empty">Nobody is connected yet.</div>
        ) : (
          <ul className="people">
            {people.map((p) => (
              <li key={p.id}>
                <span className="avatar">{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                <span className="who"><b>{p.name}</b><small>{p.role === 'admin' ? 'Administrator' : 'Member'}</small></span>
                <span className="muted">{p.tabs} tab{p.tabs === 1 ? '' : 's'}</span>
                <span className="muted">since {new Date(p.since).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="pill" data-status="completed"><i />Online</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="section-title"><Cpu size={15} /> Worker processes</div>

      {items === null ? (
        <section className="panel"><SkeletonRows rows={3} height={24} /></section>
      ) : items.length === 0 ? (
        <section className="panel">
          <Empty icon={Cpu} title="No workers online">
            Jobs stay queued until a worker starts. Run <span className="mono">docker compose up --scale worker=3</span> to bring some online.
          </Empty>
        </section>
      ) : (
        <>
          <div className="worker-sum">
            <div><span>Online</span><b className="num">{items.length}</b></div>
            <div><span>Total capacity</span><b className="num">{items.reduce((a, w) => a + (w.concurrency || 0), 0)}<small> at once</small></b></div>
            <div><span>Processed</span><b className="num">{items.reduce((a, w) => a + (w.processed || 0), 0)}</b></div>
            <div><span>Failed</span><b className="num">{items.reduce((a, w) => a + (w.failed || 0), 0)}</b></div>
          </div>
          <div className="workers">
            {items.map((w) => (
              <article key={w.id} className="panel worker">
                <header>
                  <span className="pill" data-status="completed"><i />Online</span>
                  <b className="mono">{w.id}</b>
                </header>
                <dl>
                  <div><dt>Processed</dt><dd>{w.processed}</dd></div>
                  <div><dt>Failed</dt><dd>{w.failed}</dd></div>
                  <div><dt>Concurrency</dt><dd>{w.concurrency}</dd></div>
                </dl>
                <div className="worker-rate" title={`${w.processed} processed, ${w.failed} failed`}>
                  <div className="stackbar"><b style={{ flex: w.processed || 0.001, background: 'var(--completed)' }} /><b style={{ flex: w.failed, background: 'var(--dead)' }} /></div>
                  <span className="muted">{w.processed + w.failed ? `${Math.round((w.processed / (w.processed + w.failed)) * 100)}% succeeded` : 'No jobs yet'}</span>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>Up for {uptime(w.startedAt)} · PID {w.pid}</span>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
