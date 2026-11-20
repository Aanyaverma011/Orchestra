import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ListChecks, Download } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../context/LiveContext';
import { useToast } from '../context/ToastContext';
import JobsTable from '../components/JobsTable';
import JobDrawer from '../components/JobDrawer';
import { Empty, ErrorBanner, SkeletonRows } from '../components/atoms';
import { STATUS_LABEL, TYPE_LABEL, fmtNumber } from '../lib/format';

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const STATUSES = ['queued', 'processing', 'completed', 'retrying', 'dead', 'scheduled', 'cancelled'];
const LIMIT = 15;

export default function Jobs() {
  const { isAdmin } = useAuth();
  const { subscribe } = useLive();
  const toast = useToast();
  const [working, setWorking] = useState(false);
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');
  const timer = useRef(null);

  const status = params.get('status') || '';
  const type = params.get('type') || '';
  const search = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const openId = params.get('open');

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch) && !('open' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    api
      .get('/jobs', { params: { status: status || undefined, type: type || undefined, q: search || undefined, page, limit: LIMIT } })
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(errorMessage(e, 'Could not load jobs.')));
  }, [status, type, search, page]);

  useEffect(() => { load(); }, [load]);

  // Debounce the search box so we query when typing pauses.
  useEffect(() => {
    if (q === search) return undefined;
    const t = setTimeout(() => setParam({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Live: patch the visible row immediately, then refetch shortly after for exact numbers.
  useEffect(() => {
    const off = subscribe((e) => {
      if (e.type === 'created') {
        if (page === 1) {
          clearTimeout(timer.current);
          timer.current = setTimeout(load, 300);
        }
        return;
      }
      setData((cur) => cur && { ...cur, items: cur.items.map((j) => (j.id === e.id ? { ...j, status: e.status, progress: e.progress ?? j.progress, error: e.error ?? j.error } : j)) });
      setFlashId(e.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 900);
    });
    return () => { off(); clearTimeout(timer.current); };
  }, [subscribe, load, page]);

  // Walks every page of the current filter (up to 1,000 rows) and saves it as a CSV file.
  const exportCsv = async () => {
    setWorking(true);
    try {
      const rows = [];
      for (let p = 1; p <= 10; p += 1) {
        const r = await api.get('/jobs', { params: { status: status || undefined, type: type || undefined, q: search || undefined, page: p, limit: 100 } });
        rows.push(...r.data.items);
        if (p >= r.data.pages) break;
      }
      const head = ['id', 'name', 'type', 'status', 'priority', 'attempts', 'max_attempts', 'duration_ms', 'created_at'];
      const body = rows.map((j) => [j.id, j.name, j.type, j.status, j.priority, j.attempts, j.maxAttempts, j.durationMs ?? '', j.createdAt].map(csvCell).join(','));
      const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `orchestra-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.push(`Exported ${rows.length} job${rows.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast.push(errorMessage(e, 'Export failed.'), { kind: 'err' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <div className="search">
          <Search size={15} />
          <input className="input" placeholder="Search by job name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
        </div>
        <select className="select" style={{ width: 170 }} value={type} onChange={(e) => setParam({ type: e.target.value })} aria-label="Filter by type">
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="chips" role="group" aria-label="Filter by status">
          <button className="chip" aria-pressed={!status} onClick={() => setParam({ status: '' })}>All</button>
          {STATUSES.map((s) => (
            <button key={s} className="chip" aria-pressed={status === s} style={{ '--c': `var(--${s})` }} onClick={() => setParam({ status: status === s ? '' : s })}>
              <i /> {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="toolbar-end">
          <button className="btn sm" onClick={exportCsv} disabled={working || !data?.total}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <section className="panel">
        {data === null ? (
          <SkeletonRows rows={8} height={20} />
        ) : data.items.length === 0 ? (
          status || type || search ? (
            <Empty icon={Search} title="No jobs match these filters" action={<button className="btn" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</button>}>
              Try a different status or search term.
            </Empty>
          ) : (
            <Empty icon={ListChecks} title="No jobs yet" action={<Link to="/app/jobs/new" className="btn primary">Submit a job</Link>}>
              Submit a job and it will appear here with live status.
            </Empty>
          )
        ) : (
          <>
            <JobsTable jobs={data.items} onOpen={(id) => setParam({ open: id })} flashId={flashId} showOwner={isAdmin} />
            <div className="pager">
              <span>{fmtNumber(data.total)} job{data.total === 1 ? '' : 's'} · page {data.page} of {data.pages}</span>
              <div className="btns">
                <button className="btn sm" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}><ChevronLeft size={15} /> Previous</button>
                <button className="btn sm" disabled={page >= data.pages} onClick={() => setParam({ page: String(page + 1) })}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </section>

      {openId && <JobDrawer jobId={openId} onClose={() => setParam({ open: '' })} onChanged={load} />}
    </div>
  );
}
