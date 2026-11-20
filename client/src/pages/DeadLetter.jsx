import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
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
  const [fixes, setFixes] = useState({}); // corrected email addresses, by job id

  const load = useCallback(() => {
    api.get('/admin/dead-letter').then((r) => { setItems(r.data.items); setError(''); }).catch((e) => setError(errorMessage(e, 'Could not load dead letters.')));
  }, []);
  useEffect(load, [load]);

  useEffect(() => subscribe((e) => e.status === 'dead' && setTimeout(load, 600)), [subscribe, load]);

  const bodyFor = (job) => (job.type === 'send-email' ? { to: fixes[job.id] ?? job.payload?.to ?? '' } : {});

  const retry = async (job) => {
    setBusyId(job.id);
    try {
      await api.post(`/admin/dead-letter/${job.id}/retry`, bodyFor(job));
      toast.push(`"${job.name}" is back in the queue`);
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
    const results = await Promise.allSettled(items.map((j) => api.post(`/admin/dead-letter/${j.id}/retry`, bodyFor(j))));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = items.length - ok;
    toast.push(failed ? `${ok} re-queued, ${failed} need a fix first (see the message on each card)` : `${ok} job${ok === 1 ? '' : 's'} re-queued`, { kind: ok ? 'ok' : 'err' });
    setBusyId(null);
    load();
  };

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {items?.length > 0 && (
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <span><b>{items.length}</b> dead job{items.length === 1 ? '' : 's'}. Read the error, fix the input if needed, then retry.</span>
          <div className="toolbar-end">
            <button className="btn sm" onClick={retryAll} disabled={busyId === 'all'}><RotateCcw size={14} /> {busyId === 'all' ? 'Retrying…' : 'Retry all'}</button>
          </div>
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
                    <RotateCcw size={14} /> {busyId === j.id ? 'Retrying…' : 'Retry'}
                  </button>
                </div>
              </header>
              <div className="callout"><b>Last error</b><p>{j.error || 'No error message recorded.'}</p></div>
              {j.type === 'send-email' && (
                <label className="dead-fix">
                  <span className="muted">Send to</span>
                  <input
                    className="input"
                    value={fixes[j.id] ?? j.payload?.to ?? ''}
                    onChange={(e) => setFixes((f) => ({ ...f, [j.id]: e.target.value }))}
                    placeholder="name@example.com"
                  />
                  {j.payload?.forceFail && <span className="hint">The simulated outage is switched off when you retry.</span>}
                </label>
              )}
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
