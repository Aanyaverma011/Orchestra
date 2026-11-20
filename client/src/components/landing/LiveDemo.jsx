import { useState } from 'react';

/*
 * A still snapshot of the queue monitor, shown in the landing hero.
 * No timers or motion: it reads like a screenshot, but the filter tabs work.
 */

const JOBS = [
  { id: '7c78f7', name: 'payroll-2026-11', type: 'generate-report', worker: 'w-2', attempt: '2/4', started: '14:02:11', time: '1.1s', status: 'running' },
  { id: '571f64', name: 'attendance-q4', type: 'generate-report', worker: 'w-1', attempt: '1/4', started: '14:02:09', time: '2.7s', status: 'running' },
  { id: 'aaa3b8', name: 'invoice-reminder', type: 'send-email', worker: '—', attempt: '1/4', started: '14:02:10', time: '+1.3s', status: 'retrying' },
  { id: 'c6c3ec', name: 'customers.csv', type: 'process-csv', worker: 'w-3', attempt: '1/4', started: '14:02:11', time: '1.4s', status: 'running' },
  { id: 'e712ab', name: 'password-reset', type: 'send-email', worker: 'w-1', attempt: '1/4', started: '14:02:10', time: '142ms', status: 'completed' },
  { id: '23819f', name: 'receipt-88214', type: 'send-email', worker: 'w-3', attempt: '1/4', started: '14:02:08', time: '228ms', status: 'completed' },
  { id: '6e34c5', name: 'catalogue-sync.csv', type: 'process-csv', worker: '—', attempt: '—', started: '—', time: '—', status: 'queued' },
];

const WORKERS = [['w-1', 2], ['w-2', 1], ['w-3', 1]];
const SLOTS = 5;
const LABEL = { queued: 'queued', running: 'running', retrying: 'backoff', completed: 'done' };

export default function LiveDemo() {
  const [filter, setFilter] = useState('all');
  const count = (s) => JOBS.filter((j) => j.status === s).length;
  const tabs = [['all', 'All', JOBS.length], ['running', 'Running', count('running')], ['retrying', 'Backoff', count('retrying')], ['completed', 'Done', count('completed')]];
  const rows = filter === 'all' ? JOBS : JOBS.filter((j) => j.status === filter);

  return (
    <div className="mock" aria-label="Snapshot of the Orchestra queue monitor">
      <div className="mock-bar">
        <span>orchestra <i>/</i> overview</span>
        <span className="mock-live">3 workers online</span>
      </div>

      <div className="mock-tools">
        <div className="mock-tabs" role="tablist" aria-label="Filter jobs">
          {tabs.map(([k, label, c]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
              {label} <span>{c}</span>
            </button>
          ))}
        </div>
        <span className="mock-query">queue:orchestra-jobs</span>
      </div>

      <div className="mock-stats">
        <div><span>completed</span><b>18,421</b></div>
        <div><span>p95</span><b>3.0s</b></div>
        <div><span>retries</span><b>4 × exp</b></div>
        <div><span>workers</span><b>3 × {SLOTS}</b></div>
      </div>

      <div className="mock-scroll">
        <table className="mock-table">
          <thead>
            <tr><th>id</th><th>job</th><th>worker</th><th className="r">try</th><th className="r">started</th><th className="r">time</th><th>state</th></tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} data-s={j.status}>
                <td className="dim">{j.id}</td>
                <td><span className="mock-name">{j.name}</span><span className="mock-type">{j.type}</span></td>
                <td className={j.worker === '—' ? 'dim' : ''}>{j.worker}</td>
                <td className="r">{j.attempt}</td>
                <td className="r dim">{j.started}</td>
                <td className="r">{j.time}</td>
                <td><span className="mock-state">{LABEL[j.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mock-workers">
        {WORKERS.map(([w, used]) => (
          <div key={w} className="mock-worker">
            <span>{w}</span>
            <span className="slots" aria-label={`${used} of ${SLOTS} slots busy`}>
              {Array.from({ length: SLOTS }, (_, i) => <i key={i} className={i < used ? 'on' : ''} />)}
            </span>
            <span className="dim">{used}/{SLOTS}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
