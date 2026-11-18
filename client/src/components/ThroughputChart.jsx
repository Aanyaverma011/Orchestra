import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SERIES = [
  { key: 'submitted', label: 'Submitted', color: 'var(--accent)' },
  { key: 'completed', label: 'Completed', color: 'var(--completed)' },
  { key: 'failed', label: 'Dead', color: 'var(--dead)' },
];

const clock = (t) => new Date(t).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' });

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: 'var(--shadow)' }}>
      <div className="muted" style={{ marginBottom: 4 }}>{clock(label)}</div>
      {SERIES.map((s) => (
        <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
          <span style={{ flex: 1 }}>{s.label}</span>
          <b className="num">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</b>
        </div>
      ))}
    </div>
  );
}

export default function ThroughputChart({ series }) {
  const [hidden, setHidden] = useState({});
  const sum = (k) => (series || []).reduce((a, p) => a + (p[k] || 0), 0);
  return (
    <div>
      <div className="legend-row">
        {SERIES.map((s) => (
          <button key={s.key} className="legend-btn" aria-pressed={!hidden[s.key]} onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))} title="Click to show or hide">
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <b className="num">{sum(s.key)}</b>
          </button>
        ))}
      </div>
      <div style={{ height: 250, padding: '8px 8px 4px 0' }} role="img" aria-label="Jobs submitted, completed and dead per minute over the last 30 minutes">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line-soft)" />
            <XAxis dataKey="t" tickFormatter={clock} tick={{ fill: 'var(--faint)', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis allowDecimals={false} domain={[0, (max) => Math.max(4, max)]} width={36} tick={{ fill: 'var(--faint)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ stroke: 'var(--line)' }} />
            {SERIES.filter((s) => !hidden[s.key]).map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
