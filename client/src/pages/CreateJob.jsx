import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, FileText, FileSpreadsheet, UploadCloud, Send } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../context/ToastContext';
import { ErrorBanner } from '../components/atoms';
import { CRON_PRESETS } from '../lib/format';

const TYPES = [
  { id: 'send-email', label: 'Send email', hint: 'Deliver one message through SMTP', icon: Mail },
  { id: 'generate-report', label: 'Generate report', hint: 'Build a PDF or CSV from employee data', icon: FileText },
  { id: 'process-csv', label: 'Process CSV', hint: 'Upload a file and analyse every row', icon: FileSpreadsheet },
];

const DEFAULTS = {
  'send-email': { name: 'Payment confirmation', to: 'finance@example.com', subject: 'Your payment was received', body: 'Thanks for your payment. Your receipt is attached to your account.', forceFail: false },
  'generate-report': { name: 'November attendance report', title: 'November Attendance Report', employees: 5000, format: 'pdf' },
  'process-csv': { name: 'Customer import' },
};

export default function CreateJob() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const initial = DEFAULTS[params.get('type')] ? params.get('type') : 'send-email';
  const [type, setType] = useState(initial);
  const [form, setForm] = useState(DEFAULTS[initial]);
  const [priority, setPriority] = useState('normal');
  const [mode, setMode] = useState('now');
  const [delayMin, setDelayMin] = useState(5);
  const [runAt, setRunAt] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // One key per form. A double-click sends the same key, so the API creates one job.
  const idemKey = useRef(crypto.randomUUID());
  const fileInput = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const pickType = (t) => {
    setType(t);
    setForm(DEFAULTS[t]);
    setFile(null);
    setError('');
    if (t === 'process-csv') setMode('now');
  };

  const body = useMemo(() => {
    const { name, ...payload } = form;
    const out = { type, name, priority, payload: { ...payload } };
    if (type === 'generate-report') out.payload.employees = Number(payload.employees) || 1;
    if (type === 'send-email' && !payload.forceFail) delete out.payload.forceFail;
    if (mode === 'delay') out.delayMs = Math.max(1, Number(delayMin) || 1) * 60_000;
    if (mode === 'at' && runAt) out.runAt = new Date(runAt).toISOString();
    return out;
  }, [form, type, priority, mode, delayMin, runAt]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name?.trim()) return setError('Give the job a name so you can find it later.');
    if (type === 'process-csv' && !file) return setError('Choose a CSV file to upload.');
    if (mode === 'at' && !runAt) return setError('Pick the date and time this job should run.');
    if (mode === 'repeat' && !/^(\S+\s+){4}\S+$/.test(cron.trim())) {
      return setError('Use a 5-field cron expression, for example 0 9 * * *.');
    }
    setBusy(true);
    try {
      if (mode === 'repeat') {
        await api.post('/schedules', { name: form.name, type, payload: body.payload, priority, cron: cron.trim() });
        toast.push('Schedule created');
        navigate('/app/schedules');
        return;
      }
      let job;
      if (type === 'process-csv') {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', form.name);
        fd.append('priority', priority);
        job = (await api.post('/uploads/csv', fd)).data;
      } else {
        job = (await api.post('/jobs', body, { headers: { 'Idempotency-Key': idemKey.current } })).data;
      }
      idemKey.current = crypto.randomUUID();
      toast.push(job.status === 'scheduled' ? 'Job scheduled' : 'Job queued', {
        action: { label: 'View', onClick: () => navigate(`/jobs?open=${job.id}`) },
      });
      navigate('/app/jobs');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const preview = mode === 'repeat'
    ? `POST /api/schedules\n\n${JSON.stringify({ name: form.name, type, priority, cron, payload: body.payload }, null, 2)}`
    : type === 'process-csv'
    ? `POST /api/uploads/csv\nContent-Type: multipart/form-data\n\nfile=${file ? file.name : '(choose a file)'}\nname=${form.name}\npriority=${priority}`
    : `POST /api/jobs\nIdempotency-Key: ${idemKey.current.slice(0, 18)}…\n\n${JSON.stringify(body, null, 2)}`;

  return (
    <form className="create" onSubmit={submit} noValidate>
      <div className="panel">
        <div className="form-sec">
          <h2>What should run?</h2>
          <div className="type-pick" role="group" aria-label="Job type">
            {TYPES.map((t) => (
              <button type="button" key={t.id} className="type-opt" aria-pressed={type === t.id} onClick={() => pickType(t.id)}>
                <t.icon size={18} />
                <b>{t.label}</b>
                <span>{t.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-sec">
          <h2>Details</h2>
          <div className="field">
            <label htmlFor="name">Job name</label>
            <input id="name" className="input" value={form.name || ''} onChange={set('name')} />
          </div>

          {type === 'send-email' && (
            <>
              <div className="field">
                <label htmlFor="to">Recipient</label>
                <input id="to" className="input" type="email" value={form.to} onChange={set('to')} />
              </div>
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input id="subject" className="input" value={form.subject} onChange={set('subject')} />
              </div>
              <div className="field">
                <label htmlFor="msg">Message</label>
                <textarea id="msg" className="textarea" value={form.body} onChange={set('body')} />
              </div>
              <label className="check">
                <input type="checkbox" checked={form.forceFail} onChange={set('forceFail')} />
                <span>
                  <span className="label">Simulate an SMTP outage</span>
                  <span className="hint" style={{ display: 'block' }}>The job fails on every attempt, so you can watch it retry and land in Dead letters.</span>
                </span>
              </label>
            </>
          )}

          {type === 'generate-report' && (
            <>
              <div className="field">
                <label htmlFor="title">Report title</label>
                <input id="title" className="input" value={form.title} onChange={set('title')} />
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="employees">Employees</label>
                  <input id="employees" className="input" type="number" min="1" max="50000" value={form.employees} onChange={set('employees')} />
                </div>
                <div className="field">
                  <span className="label">Format</span>
                  <div className="segmented" role="group" aria-label="Format">
                    {['pdf', 'csv'].map((f) => (
                      <button type="button" key={f} aria-pressed={form.format === f} onClick={() => setForm((x) => ({ ...x, format: f }))}>{f.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {type === 'process-csv' && (
            <div className="field">
              <span className="label">CSV file</span>
              <div
                className={`drop ${over ? 'over' : ''}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
              >
                <UploadCloud size={22} />
                {file ? <b>{file.name}</b> : <b>Drop a .csv here or browse</b>}
                <span className="hint">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Up to 5 MB. The first row must be a header.'}</span>
                <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}
        </div>

        <div className="form-sec">
          <h2>Priority and timing</h2>
          <div className="row2">
            <div className="field">
              <span className="label">Priority</span>
              <div className="segmented" role="group" aria-label="Priority">
                {['high', 'normal', 'low'].map((p) => (
                  <button type="button" key={p} aria-pressed={priority === p} onClick={() => setPriority(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
                ))}
              </div>
              <span className="hint">High priority jobs run before waiting low priority ones.</span>
            </div>
            {type !== 'process-csv' && (
              <div className="field">
                <span className="label">Run</span>
                <div className="segmented" role="group" aria-label="When to run">
                  <button type="button" aria-pressed={mode === 'now'} onClick={() => setMode('now')}>Now</button>
                  <button type="button" aria-pressed={mode === 'delay'} onClick={() => setMode('delay')}>Delay</button>
                  <button type="button" aria-pressed={mode === 'at'} onClick={() => setMode('at')}>At time</button>
                  <button type="button" aria-pressed={mode === 'repeat'} onClick={() => setMode('repeat')}>Repeat</button>
                </div>
              </div>
            )}
          </div>
          {mode === 'delay' && type !== 'process-csv' && (
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="delay">Delay in minutes</label>
              <input id="delay" className="input" type="number" min="1" value={delayMin} onChange={(e) => setDelayMin(e.target.value)} />
            </div>
          )}
          {mode === 'at' && type !== 'process-csv' && (
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor="runat">Run at</label>
              <input id="runat" className="input" type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
            </div>
          )}
          {mode === 'repeat' && type !== 'process-csv' && (
            <div className="row2">
              <div className="field">
                <label htmlFor="cron-preset">Repeats</label>
                <select
                  id="cron-preset"
                  className="select"
                  value={CRON_PRESETS.some((p) => p.value === cron) ? cron : ''}
                  onChange={(e) => e.target.value && setCron(e.target.value)}
                >
                  {CRON_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  <option value="">Custom (edit the expression)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="cron-expr">Cron expression</label>
                <input id="cron-expr" className="input mono" value={cron} onChange={(e) => setCron(e.target.value)} />
                <span className="hint">Minute, hour, day of month, month, day of week.</span>
              </div>
            </div>
          )}
        </div>

        <div className="form-foot">
          <div className="grow">{error && <ErrorBanner>{error}</ErrorBanner>}</div>
          <button type="button" className="btn" onClick={() => navigate('/app/jobs')}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>
            <Send size={15} /> {busy ? 'Submitting…' : mode === 'repeat' ? 'Create schedule' : 'Submit job'}
          </button>
        </div>
      </div>

      <aside className="panel preview" aria-label="Request preview">
        <div className="panel-head">
          <h2>Request preview</h2>
          <span className="sub">sent to the API</span>
        </div>
        <pre className="code">{preview}</pre>
        <ul>
          <li>The API validates the request, saves the job in MongoDB, then adds it to the queue.</li>
          <li>You get a response straight away. A worker runs the job in the background.</li>
          <li>The same Idempotency-Key never creates two jobs, even if you click twice.</li>
        </ul>
      </aside>
    </form>
  );
}
