import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, Skull } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useLive } from '../context/LiveContext';
import { useToast } from '../context/ToastContext';
import JobDrawer from '../components/JobDrawer';
import { Empty, ErrorBanner, SkeletonRows, TypeLabel, StatusPill } from '../components/atoms';
import { shortId, timeAgo } from '../lib/format';

export default function DeadLetter() {
  const toast = useToast();
  const { subscribe } = useLive();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/dead-letter').then((r) => { setItems(r.data.items); setError(''); }).catch((e) => setError(errorMessage(e, 'Could not load dead letters.')));
  }, []);
  useEffect(load, [load]);

  useEffect(() => subscribe((e) => e.status === 'dead' && setTimeout(load, 600)), [subscribe, load]);

  const retry = async (job) => {
    setBusyId(job.id);
    try {
      await api.post(`/admin/dead-letter/${job.id}/retry`);
      toast.push(`"${job.name}" re-queued`);
      setItems((cur) => cur.filter((j) => j.id !== job.id));
    } catch (e) {
      toast.push(errorMessage(e), { kind: 'err' });
    } finally {
      setBusyId(null);
    }
  };

  const retryAll = async () => {
    if (!items?.length) return;
    setBusyId('all');
    const results = await Promise.allSettled(items.map((j) => api.post(`/admin/dead-letter/${j.id}/retry`)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    toast.push(`${ok} of ${items.length} jobs re-queued`, { kind: ok ? 'ok' : 'err' });
    setBusyId(null);
    load();
  };

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {items?.length > 0 && (
        <div className="bulkbar">
          <Skull size={16} style={{ color: 'var(--dead)' }} />
          <b>{items.length} dead job{items.length === 1 ? '' : 's'}</b>
          <span className="muted">Read each error first. Retrying puts a job back at the front of the line.</span>
          <span className="grow" />
          <button className="btn primary sm" onClick={retryAll} disabled={busyId === 'all'}><RotateCcw size={14} /> {busyId === 'all' ? 'Retrying…' : 'Retry all'}</button>
        </div>
      )}
      {items === null ? (
        <section className="panel"><SkeletonRows rows={4} height={22} /></section>
      ) : items.length === 0 ? (
        <section className="panel">
          <Empty icon={CheckCircle2} title="No dead jobs">
            Jobs that fail every attempt land here so you can read the error and retry them.
          </Empty>
        </section>
      ) : (
        <div className="dead-list">
          {items.map((j) => (
            <article key={j.id} className="panel dead-item">
              <header>
                <h3>{j.name}</h3>
                <StatusPill status="dead" />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => setOpenId(j.id)}>View log</button>
                  <button className="btn primary sm" disabled={busyId === j.id} onClick={() => retry(j)}>
                    <RotateCcw size={14} /> {busyId === j.id ? 'Retrying…' : 'Retry job'}
                  </button>
                </div>
              </header>
              <div className="callout"><b>Last error</b><p>{j.error || 'No error message recorded.'}</p></div>
              <div className="meta">
                <TypeLabel type={j.type} />
                <span className="mono">#{shortId(j.id)}</span>
                <span>{j.attempts} of {j.maxAttempts} attempts used</span>
                {j.createdBy?.name && <span>Owner: {j.createdBy.name}</span>}
                <span>Died {timeAgo(j.finishedAt || j.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      {openId && <JobDrawer jobId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
