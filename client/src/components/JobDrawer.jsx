import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, RotateCcw, Ban, ExternalLink, Sparkles } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../context/LiveContext';
import { useToast } from '../context/ToastContext';
import { StatusPill, Priority, TypeLabel, Meter, SkeletonRows, ErrorBanner } from './atoms';
import { fmtDateTime, fmtClock, fmtDuration, shortId, timeAgo } from '../lib/format';

export default function JobDrawer({ jobId, onClose, onChanged }) {
  const { isAdmin } = useAuth();
  const { subscribe } = useLive();
  const toast = useToast();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [to, setTo] = useState('');
  const closeRef = useRef(null);

  const load = useCallback(() => {
    api
      .get(`/jobs/${jobId}`)
      .then((r) => {
        setJob(r.data);
        if (r.data.type === 'send-email') setTo((cur) => cur || r.data.payload?.to || '');
        setError('');
      })
      .catch((e) => setError(errorMessage(e, 'Could not load this job.')));
  }, [jobId]);

  useEffect(() => {
    setJob(null);
    setTo('');
    load();
  }, [load]);

  // Refresh when this job changes. Debounced so a burst of events is one fetch.
  useEffect(() => {
    let timer;
    const off = subscribe((e) => {
      if (e.id !== jobId) return;
      clearTimeout(timer);
      timer = setTimeout(load, 350);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [jobId, subscribe, load]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      toast.push(okMessage);
      load();
      onChanged?.();
    } catch (e) {
      toast.push(errorMessage(e), { kind: 'err' });
    } finally {
      setBusy(false);
    }
  };

  const explain = async () => {
    setExplaining(true);
    try {
      const res = await api.post(`/jobs/${jobId}/explain`);
      setJob((j) => ({ ...j, explanation: res.data }));
    } catch (e) {
      toast.push(errorMessage(e, 'Could not explain this failure.'), { kind: 'err' });
    } finally {
      setExplaining(false);
    }
  };

  const cancel = () => act(() => api.post(`/jobs/${jobId}/cancel`), 'Job cancelled');
  const retry = () => act(() => api.post(`/admin/dead-letter/${jobId}/retry`, job.type === 'send-email' ? { to } : {}), 'Job sent back to the queue');

  const download = async () => {
    try {
      const res = await api.get(`/jobs/${jobId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.result.file.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.push(errorMessage(e, 'Could not download the file.'), { kind: 'err' });
    }
  };

  const canCancel = job && ['queued', 'scheduled', 'retrying'].includes(job.status);
  const canRetry = job && job.status === 'dead' && isAdmin;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Job details">
        <div className="drawer-head">
          <div className="grow">
            {job ? (
              <>
                <h2>{job.name}</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusPill status={job.status} />
                  <span className="mono faint">{job.id}</span>
                </div>
              </>
            ) : (
              <h2>Job {shortId(jobId)}</h2>
            )}
          </div>
          <button ref={closeRef} className="btn ghost icon sm" onClick={onClose} aria-label="Close details">
            <X size={17} />
          </button>
        </div>

        <div className="drawer-body">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {!job && !error && <SkeletonRows rows={7} />}
          {job && (
            <>
              <dl className="dl">
                <div>
                  <dt>Type</dt>
                  <dd><TypeLabel type={job.type} /></dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd><Priority value={job.priority} /></dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd className="num">{job.attempts} of {job.maxAttempts}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd className="num">{fmtDuration(job.durationMs)}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{fmtDateTime(job.createdAt)} <span className="muted">({timeAgo(job.createdAt)})</span></dd>
                </div>
                {job.scheduledFor ? (
                  <div>
                    <dt>Runs at</dt>
                    <dd>{fmtDateTime(job.scheduledFor)}</dd>
                  </div>
                ) : (
                  <div>
                    <dt>Finished</dt>
                    <dd>{job.finishedAt ? fmtDateTime(job.finishedAt) : '-'}</dd>
                  </div>
                )}
                {job.createdBy?.name && (
                  <div>
                    <dt>Owner</dt>
                    <dd>{job.createdBy.name}</dd>
                  </div>
                )}
              </dl>

              {job.status === 'processing' && (
                <div>
                  <div className="sec-title">Progress · {job.progress}%</div>
                  <Meter value={job.progress} />
                </div>
              )}

              {job.error && ['dead', 'retrying'].includes(job.status) && (
                <div className="callout">
                  <b>{job.status === 'dead' ? 'Failed after all attempts' : 'Last attempt failed'}</b>
                  <p>{job.error}</p>
                </div>
              )}

              {job.error && ['dead', 'retrying'].includes(job.status) && (
                <div className="explain">
                  {job.explanation ? (
                    <>
                      <div className="sec-title" style={{ margin: 0 }}>What this means</div>
                      <p>{job.explanation.summary}</p>
                      <span className="hint">
                        {job.explanation.source === 'groq'
                          ? 'Written by an AI model from the error and log lines only. Job data is not sent.'
                          : 'Built-in analysis of the error message.'}
                      </span>
                    </>
                  ) : (
                    <button className="btn sm" disabled={explaining} onClick={explain}>
                      <Sparkles size={14} /> {explaining ? 'Explaining…' : 'Explain this failure'}
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="sec-title">Execution log</div>
                {job.logs?.length ? (
                  <ol className="timeline">
                    {job.logs.map((l, i) => (
                      <li key={i} data-l={l.level}>
                        <i />
                        <div className="msg">{l.message}</div>
                        <time>{fmtClock(l.at)}</time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">No log entries yet. The worker adds entries as it runs the job.</p>
                )}
              </div>

              {job.result && (
                <div>
                  <div className="sec-title">Result</div>
                  <pre className="code">{JSON.stringify(job.result, null, 2)}</pre>
                  {job.result.previewUrl && (
                    <a className="btn sm" style={{ marginTop: 10 }} href={job.result.previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Open email preview
                    </a>
                  )}
                </div>
              )}

              <div>
                <div className="sec-title">Payload</div>
                <pre className="code">{JSON.stringify(job.payload, null, 2)}</pre>
              </div>
            </>
          )}
        </div>

        {job && (canCancel || canRetry || job.hasFile) && (
          <div className="drawer-foot">
            {job.hasFile && (
              <button className="btn primary" onClick={download}>
                <Download size={15} /> Download file
              </button>
            )}
            {canRetry && job.type === 'send-email' && (
              <input className="input" style={{ maxWidth: 220, height: 34 }} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient email" aria-label="Recipient email for the retry" />
            )}
            {canRetry && (
              <button className="btn primary" disabled={busy} onClick={retry}>
                <RotateCcw size={15} /> {busy ? 'Retrying…' : 'Retry job'}
              </button>
            )}
            {canCancel && (
              <button className="btn danger" disabled={busy} onClick={cancel}>
                <Ban size={15} /> {busy ? 'Cancelling…' : 'Cancel job'}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
