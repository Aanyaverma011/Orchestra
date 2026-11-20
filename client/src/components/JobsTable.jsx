import { StatusPill, Priority, TypeLabel, Meter } from './atoms';
import { fmtDuration, shortId, timeAgo } from '../lib/format';

export default function JobsTable({ jobs, onOpen, flashId, showOwner = false, compact = false }) {
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Job</th>
            <th>Type</th>
            {!compact && <th>Priority</th>}
            <th>Status</th>
            {!compact && <th>Progress</th>}
            <th className="right">Attempts</th>
            <th className="right">Duration</th>
            <th className="right">Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr
              key={j.id}
              className={`clickable ${flashId === j.id ? 'flash' : ''}`}
              onClick={() => onOpen(j.id)}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(j.id))}
              aria-label={`Open ${j.name}`}
            >
              <td>
                <div className="name-cell">
                  <b title={j.name}>{j.name}</b>
                  <span className="mono">
                    #{shortId(j.id)}
                    {showOwner && j.createdBy?.name ? ` · ${j.createdBy.name}` : ''}
                  </span>
                </div>
              </td>
              <td><TypeLabel type={j.type} /></td>
              {!compact && <td><Priority value={j.priority} /></td>}
              <td><StatusPill status={j.status} /></td>
              {!compact && (
                <td>
                  {j.status === 'processing' ? <Meter value={j.progress} /> : <span className="faint">-</span>}
                </td>
              )}
              <td className="right num">{j.attempts}/{j.maxAttempts}</td>
              <td className="right num">{fmtDuration(j.durationMs)}</td>
              <td className="right muted" title={new Date(j.createdAt).toLocaleString()}>{timeAgo(j.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
