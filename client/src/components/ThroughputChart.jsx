import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SERIES = [
  { key: 'submitted', label: 'Submitted', color: 'var(--accent)' },
  { key: 'completed', label: 'Completed', color: 'var(--completed)' },
  { key: 'failed', label: 'Dead', color: 'var(--dead)' },
];

const clock = (t) => new Date(t).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip" style={{ display: 'block' }}>
      <div className="muted" style={{ marginBottom: 4 }}>{clock(label)}</div>
      {SERIES.map((s) => (
        <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <i style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} />
          <span style={{ flex: 1 }}>{s.label}</span>
          <b className="num">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</b>
        </div>
      ))}
    </div>
  );
}

export default function ThroughputChart({ series }) {
  const sum = (k) => (series || []).reduce((a, p) => a + (p[k] || 0), 0);
  return (
    <div>
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label} <b className="num">{sum(s.key)}</b></span>
        ))}
      </div>
      <div style={{ height: 240, padding: '10px 8px 4px 0' }} role="img" aria-label="Jobs submitted, completed and dead per minute over the last 30 minutes">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line-soft)" />
            <XAxis dataKey="t" tickFormatter={clock} tick={{ fill: 'var(--faint)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} minTickGap={48} />
            <YAxis allowDecimals={false} domain={[0, (max) => Math.max(4, max)]} width={36} tick={{ fill: 'var(--faint)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ stroke: 'var(--line)' }} />
            {SERIES.map((s) => (
              <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
