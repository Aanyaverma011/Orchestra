import useCountUp from '../hooks/useCountUp';
import { STATUS_LABEL, fmtDuration, fmtNumber } from '../lib/format';

function Kpi({ tone, label, children, foot }) {
  return (
    <div className="kpi" data-tone={tone}>
      <span className="k">{label}</span>
      <span className="v">{children}</span>
      <span className="d">{foot}</span>
    </div>
  );
}

export function KpiRow({ stats }) {
  const total = useCountUp(stats?.total ?? 0);
  const rate = useCountUp(stats?.successRate ?? 0, { decimals: 1 });
  const dead = useCountUp(stats?.failedOrDead ?? 0);
  return (
    <section className="kpis" aria-label="Summary">
      <Kpi tone="accent" label="Total jobs" foot={stats ? `${fmtNumber(stats.inFlight)} still running or waiting` : ' '}>
        {stats ? fmtNumber(total) : '-'}
      </Kpi>
      <Kpi tone="good" label="Success rate" foot="of finished jobs">
        {stats?.successRate != null ? <>{rate.toFixed(1)}<small>%</small></> : '-'}
      </Kpi>
      <Kpi tone="info" label="Average run time" foot="completed jobs only">
        {stats ? fmtDuration(stats.avgMs) : '-'}
      </Kpi>
      <Kpi tone={stats?.failedOrDead ? 'bad' : undefined} label="Dead jobs" foot={stats?.failedOrDead ? 'need someone to look' : 'nothing needs attention'}>
        {stats ? fmtNumber(dead) : '-'}
      </Kpi>
    </section>
  );
}

const ORDER = ['completed', 'processing', 'queued', 'scheduled', 'retrying', 'dead', 'cancelled'];

/** How many jobs sit in each status, as simple labelled bars. */
export function StatusBars({ stats }) {
  const by = stats?.byStatus || {};
  const total = ORDER.reduce((a, k) => a + (by[k] || 0), 0);
  if (!stats) return <div className="mini-empty">Loading…</div>;
  if (!total) return <div className="mini-empty">No jobs yet.</div>;
  return (
    <ul className="bars-list">
      {ORDER.filter((k) => by[k]).map((k) => (
        <li key={k}>
          <span className="lbl"><i style={{ background: `var(--${k})` }} />{STATUS_LABEL[k]}</span>
          <span className="num">{fmtNumber(by[k])}</span>
          <span className="track"><b style={{ width: `${Math.max(2, (by[k] / total) * 100)}%`, background: `var(--${k})` }} /></span>
        </li>
      ))}
    </ul>
  );
}
