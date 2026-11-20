import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ListChecks } from 'lucide-react';
import api, { errorMessage } from '../api';
import { fmtNumber } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../context/LiveContext';
import Pipeline from '../components/Pipeline';
import ThroughputChart from '../components/ThroughputChart';
import ActivityFeed from '../components/ActivityFeed';
import JobsTable from '../components/JobsTable';
import JobDrawer from '../components/JobDrawer';
import { Empty, ErrorBanner, SkeletonRows } from '../components/atoms';
import { KpiRow, StatusBars } from '../components/Widgets';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Overview() {
  const { user, isAdmin } = useAuth();
  const { subscribe } = useLive();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const timers = useRef({});

  const loadStats = useCallback(() => {
    api.get('/stats').then((r) => { setStats(r.data); setError(''); }).catch((e) => setError(errorMessage(e, 'Could not load statistics.')));
  }, []);
  const loadJobs = useCallback(() => {
    api.get('/jobs', { params: { limit: 8 } }).then((r) => setJobs(r.data.items)).catch((e) => setError(errorMessage(e, 'Could not load recent jobs.')));
  }, []);

  const debounced = useCallback((key, fn, ms = 700) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    loadStats();
    loadJobs();
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, [loadStats, loadJobs]);

  useEffect(() => {
    const off = subscribe((e) => {
      if (e.type === 'created') {
        setJobs((cur) => (cur ? [e.job, ...cur.filter((j) => j.id !== e.job.id)].slice(0, 8) : cur));
        setEvents((cur) => [{ key: `${e.id}-q-${Date.now()}`, id: e.id, status: e.job.status, at: Date.now(), fresh: true }, ...cur].slice(0, 40));
      } else {
        setJobs((cur) => {
          if (!cur) return cur;
          if (!cur.some((j) => j.id === e.id)) {
            debounced('jobs', loadJobs);
            return cur;
          }
          return cur.map((j) => (j.id === e.id ? { ...j, status: e.status, progress: e.progress ?? j.progress, error: e.error ?? j.error } : j));
        });
        setEvents((cur) => [{ key: `${e.id}-${e.status}-${Date.now()}`, id: e.id, status: e.status, error: e.error, at: Date.now(), fresh: true }, ...cur].slice(0, 40));
        if (e.status !== 'processing' || e.progress == null) debounced('jobs', loadJobs, 1200); // fills in attempts and duration
      }
      setFlashId(e.id);
      debounced('stats', loadStats);
    });
    return off;
  }, [subscribe, debounced, loadJobs, loadStats]);

  const names = Object.fromEntries((jobs || []).map((j) => [j.id, j.name]));

  const dead = stats?.failedOrDead || 0;
  const first = (user?.name || '').split(' ')[0];

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <section className="hello">
        <div>
          <h2>{greeting()}{first ? `, ${first}` : ''}</h2>
          <p className="muted">
            {stats
              ? stats.inFlight > 0
                ? `${fmtNumber(stats.inFlight)} job${stats.inFlight === 1 ? ' is' : 's are'} moving through the pipeline right now.`
                : 'The queue is quiet. Everything submitted so far has finished.'
              : 'Loading your workspace…'}
          </p>
        </div>
      </section>

      {dead > 0 && (
        <Link to={isAdmin ? '/app/dead-letter' : '/app/jobs?status=dead'} className="attention">
          <AlertTriangle size={17} />
          <span><b>{fmtNumber(dead)} job{dead === 1 ? '' : 's'} failed every attempt.</b> Open the error and retry {dead === 1 ? 'it' : 'them'}.</span>
          <ArrowRight size={16} />
        </Link>
      )}

      <KpiRow stats={stats} />

      <Pipeline stats={stats} />

      <div className="grid-overview">
        <section className="panel">
          <div className="panel-head">
            <h2>Throughput</h2>
            <span className="sub">per minute, last 30 minutes</span>
          </div>
          <div style={{ paddingTop: 12 }}>{stats ? <ThroughputChart series={stats.series} /> : <SkeletonRows rows={5} height={30} />}</div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Jobs by status</h2>
          </div>
          <div className="panel-body"><StatusBars stats={stats} /></div>
        </section>
      </div>

      <div className="grid-overview">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent jobs</h2>
            <div className="right">
              <Link to="/app/jobs" className="btn sm">View all</Link>
            </div>
          </div>
          {jobs === null ? (
            <SkeletonRows rows={5} />
          ) : jobs.length === 0 ? (
            <Empty icon={ListChecks} title="No jobs yet" action={<Link to="/app/jobs/new" className="btn primary">Submit your first job</Link>}>
              Jobs you submit show up here and move through the pipeline as workers process them.
            </Empty>
          ) : (
            <JobsTable jobs={jobs} compact onOpen={setOpenId} flashId={flashId} />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Live activity</h2>
            <span className="live-dot" aria-hidden="true" />
          </div>
          <ActivityFeed events={events} names={names} />
        </section>
      </div>

      {openId && <JobDrawer jobId={openId} onClose={() => setOpenId(null)} onChanged={() => { loadJobs(); loadStats(); }} />}
    </div>
  );
}
