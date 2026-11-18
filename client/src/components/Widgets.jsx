import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, CheckCircle2, Clock3, Layers, Skull } from 'lucide-react';
import useCountUp from '../hooks/useCountUp';
import { STATUS_LABEL, TYPE_LABEL, fmtDuration, fmtNumber } from '../lib/format';
import { TypeIcon } from './atoms';

/** Tiny dependency-free sparkline. */
export function Sparkline({ data = [], color = 'var(--accent)', height = 34 }) {
  const max = Math.max(1, ...data);
  const w = 120;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, height - 3 - (v / max) * (height - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${w} ${height} L0 ${height} Z` : '';
  const id = `sp-${color.replace(/[^a-z]/gi, '')}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${id})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function Ring({ value = 0, color = 'var(--completed)' }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="23" cy="23" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} transform="rotate(-90 23 23)" style={{ transition: 'stroke-dashoffset 0.9s ease' }} />
    </svg>
  );
}

function Kpi({ icon: Icon, tone, label, children, foot, visual }) {
  return (
    <div className="kpi" data-tone={tone}>
      <div className="kpi-top">
        <span className="kpi-ico"><Icon size={16} /></span>
        <span className="k">{label}</span>
      </div>
      <div className="kpi-main">
        <span className="v">{children}</span>
        {visual}
      </div>
      <span className="d">{foot}</span>
    </div>
  );
}

export function KpiRow({ stats }) {
  const total = useCountUp(stats?.total ?? 0);
  const rate = useCountUp(stats?.successRate ?? 0, { decimals: 1 });
  const dead = useCountUp(stats?.failedOrDead ?? 0);
  const s = stats?.series || [];
  return (
    <section className="kpis" aria-label="Summary">
      <Kpi icon={Layers} tone="accent" label="Total jobs" foot={stats ? `${fmtNumber(stats.inFlight)} in flight` : ' '} visual={<Sparkline data={s.map((x) => x.submitted)} />}>
        {stats ? fmtNumber(total) : '-'}
      </Kpi>
      <Kpi icon={CheckCircle2} tone="good" label="Success rate" foot="of finished jobs" visual={<Ring value={stats?.successRate ?? 0} />}>
        {stats?.successRate != null ? <>{rate.toFixed(1)}<small>%</small></> : '-'}
      </Kpi>
      <Kpi icon={Clock3} tone="info" label="Average run time" foot="completed jobs only" visual={<Sparkline data={s.map((x) => x.completed)} color="var(--processing)" />}>
        {stats ? fmtDuration(stats.avgMs) : '-'}
      </Kpi>
      <Kpi icon={Skull} tone={stats?.failedOrDead ? 'bad' : 'muted'} label="Dead jobs" foot={stats?.failedOrDead ? 'need a human to look' : 'nothing needs attention'} visual={<Sparkline data={s.map((x) => x.failed)} color="var(--dead)" />}>
        {stats ? fmtNumber(dead) : '-'}
      </Kpi>
    </section>
  );
}

const ORDER = ['completed', 'processing', 'queued', 'scheduled', 'retrying', 'dead', 'cancelled'];

export function StatusDonut({ stats }) {
  const by = stats?.byStatus || {};
  const rows = ORDER.map((k) => ({ key: k, value: by[k] || 0 })).filter((r) => r.value > 0);
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <div className="donut-wrap">
      <div className="donut" role="img" aria-label="Jobs by status">
        {total === 0 ? (
          <div className="donut-empty">No jobs yet</div>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="94%" paddingAngle={2} stroke="none" cornerRadius={4} animationDuration={700}>
                {rows.map((r) => <Cell key={r.key} fill={`var(--${r.key})`} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div className="tip"><i style={{ background: `var(--${payload[0].payload.key})` }} />{STATUS_LABEL[payload[0].payload.key]} <b className="num">{payload[0].value}</b></div>
              ) : null} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="donut-center"><b className="num">{fmtNumber(total)}</b><span>jobs</span></div>
      </div>
      <ul className="legend">
        {(rows.length ? rows : ORDER.slice(0, 4).map((k) => ({ key: k, value: 0 }))).map((r) => (
          <li key={r.key}>
            <i style={{ background: `var(--${r.key})` }} />
            <span>{STATUS_LABEL[r.key]}</span>
            <b className="num">{fmtNumber(r.value)}</b>
            <small className="faint num">{total ? `${Math.round((r.value / total) * 100)}%` : '0%'}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TypeBreakdown({ stats }) {
  const rows = [...(stats?.byType || [])].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <div className="mini-empty">Type breakdown appears after your first job.</div>;
  return (
    <ul className="types">
      {rows.map((r) => {
        const other = Math.max(0, r.total - r.completed - r.dead);
        return (
          <li key={r.type}>
            <div className="types-top">
              <span className="type"><TypeIcon type={r.type} />{TYPE_LABEL[r.type] || r.type}</span>
              <b className="num">{fmtNumber(r.total)}</b>
            </div>
            <div className="stackbar" style={{ width: `${(r.total / max) * 100}%` }} title={`${r.completed} completed · ${other} other · ${r.dead} dead`}>
              <b style={{ flex: r.completed, background: 'var(--completed)' }} />
              <b style={{ flex: other, background: 'var(--processing)' }} />
              <b style={{ flex: r.dead, background: 'var(--dead)' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function QueueHealth({ stats }) {
  const q = stats?.queue || { waiting: 0, active: 0, delayed: 0 };
  const max = Math.max(1, q.waiting, q.active, q.delayed);
  const workers = stats?.workers ?? 0;
  const state = !stats ? 'idle' : workers === 0 && q.waiting > 0 ? 'bad' : q.waiting > workers * 10 && workers > 0 ? 'warn' : 'good';
  const copy = { idle: 'Checking…', good: 'Healthy', warn: 'Backlog building', bad: 'No workers online' }[state];
  return (
    <div className="qh">
      <div className="qh-state" data-s={state}><Activity size={15} /> {copy}<span className="faint">{workers} worker{workers === 1 ? '' : 's'} online</span></div>
      {[['Waiting', q.waiting, 'var(--queued)'], ['Active', q.active, 'var(--processing)'], ['Delayed', q.delayed, 'var(--scheduled)']].map(([k, v, c]) => (
        <div key={k} className="qh-row">
          <span>{k}</span>
          <div className="meter wide"><b style={{ width: `${(v / max) * 100}%`, background: c }} /></div>
          <b className="num">{fmtNumber(v)}</b>
        </div>
      ))}
    </div>
  );
}
