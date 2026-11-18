import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import { Empty, ErrorBanner, SkeletonRows, TypeLabel, Priority } from '../components/atoms';
import { CRON_PRESETS, TYPE_LABEL, describeCron, timeAgo } from '../lib/format';

const PAYLOADS = {
  'send-email': { to: 'team@example.com', subject: 'Scheduled update', body: 'This message was sent by a recurring Orchestra job.' },
  'generate-report': { title: 'Daily attendance report', employees: 1000, format: 'pdf' },
};

export default function Schedules() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: 'Daily attendance report', type: 'generate-report', priority: 'normal', cron: '0 9 * * *' });

  const load = useCallback(() => {
    api.get('/schedules').then((r) => { setItems(r.data.items); setError(''); }).catch((e) => setError(errorMessage(e, 'Could not load schedules.')));
  }, []);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/schedules', { ...form, payload: PAYLOADS[form.type] });
      toast.push('Schedule created');
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s) => {
    try {
      await api.patch(`/schedules/${s._id}`, { active: !s.active });
      toast.push(s.active ? 'Schedule paused' : 'Schedule resumed');
      load();
    } catch (err) {
      toast.push(errorMessage(err), { kind: 'err' });
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete the schedule "${s.name}"? Jobs it already created are kept.`)) return;
    try {
      await api.delete(`/schedules/${s._id}`);
      toast.push('Schedule deleted');
      load();
    } catch (err) {
      toast.push(errorMessage(err), { kind: 'err' });
    }
  };

  return (
    <div className="stack">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {open && (
        <form className="panel" onSubmit={create}>
          <div className="panel-head"><h2>New schedule</h2></div>
          <div className="form-sec">
            <div className="row2">
              <div className="field">
                <label htmlFor="s-name">Name</label>
                <input id="s-name" className="input" value={form.name} onChange={set('name')} required />
              </div>
              <div className="field">
                <label htmlFor="s-type">Job type</label>
                <select id="s-type" className="select" value={form.type} onChange={set('type')}>
                  {Object.keys(PAYLOADS).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="s-when">Repeats</label>
                <select id="s-when" className="select" value={CRON_PRESETS.some((p) => p.value === form.cron) ? form.cron : ''} onChange={(e) => e.target.value && setForm((f) => ({ ...f, cron: e.target.value }))}>
                  {CRON_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  <option value="">Custom (edit the expression)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-cron">Cron expression</label>
                <input id="s-cron" className="input mono" value={form.cron} onChange={set('cron')} required />
                <span className="hint">Minute, hour, day of month, month, day of week.</span>
              </div>
            </div>
            <div className="field" style={{ maxWidth: 240 }}>
              <span className="label">Priority</span>
              <div className="segmented" role="group" aria-label="Priority">
                {['high', 'normal', 'low'].map((p) => (
                  <button type="button" key={p} aria-pressed={form.priority === p} onClick={() => setForm((f) => ({ ...f, priority: p }))}>{p[0].toUpperCase() + p.slice(1)}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-foot">
            <span className="grow" />
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create schedule'}</button>
          </div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Recurring jobs</h2>
          <div className="right">
            {!open && <button className="btn primary sm" onClick={() => setOpen(true)}><Plus size={15} /> New schedule</button>}
          </div>
        </div>
        {items === null ? (
          <SkeletonRows rows={4} />
        ) : items.length === 0 ? (
          <Empty icon={CalendarClock} title="No schedules yet" action={!open && <button className="btn primary" onClick={() => setOpen(true)}>Create a schedule</button>}>
            A schedule creates a new job on a repeating timetable, like a report every weekday at 6 PM.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Repeats</th><th>Priority</th><th>Last run</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id}>
                    <td><b style={{ fontWeight: 560 }}>{s.name}</b></td>
                    <td><TypeLabel type={s.type} /></td>
                    <td>
                      <div className="name-cell"><b style={{ fontWeight: 500 }}>{describeCron(s.cron)}</b><span className="mono">{s.cron}</span></div>
                    </td>
                    <td><Priority value={s.priority} /></td>
                    <td className="muted">{s.lastRunAt ? timeAgo(s.lastRunAt) : 'Not run yet'}</td>
                    <td>
                      <button className="segmented" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => toggle(s)} aria-label={s.active ? 'Pause schedule' : 'Resume schedule'}>
                        <span className="pill" data-status={s.active ? 'completed' : 'cancelled'} style={{ cursor: 'pointer' }}><i />{s.active ? 'Active' : 'Paused'}</span>
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn ghost icon sm danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
