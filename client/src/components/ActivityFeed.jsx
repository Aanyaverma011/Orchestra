import { Activity } from 'lucide-react';
import { Empty } from './atoms';
import { STATUS_LABEL, fmtClock, shortId } from '../lib/format';

const VERB = {
  queued: 'was queued',
  scheduled: 'was scheduled',
  processing: 'started processing',
  completed: 'completed',
  retrying: 'failed and will retry',
  dead: 'failed permanently',
  cancelled: 'was cancelled',
};

export default function ActivityFeed({ events, names }) {
  if (!events.length) {
    return (
      <Empty icon={Activity} title="Waiting for activity">
        Submit a job and its status changes appear here as workers pick it up.
      </Empty>
    );
  }
  return (
    <ul className="feed" aria-live="polite">
      {events.map((e) => (
        <li key={e.key} className={e.fresh ? 'fresh' : ''}>
          <i className="dot" style={{ '--c': `var(--${e.status})` }} />
          <div>
            <div className="t1">
              <b>{names[e.id] || `Job #${shortId(e.id)}`}</b> {VERB[e.status] || STATUS_LABEL[e.status]}
            </div>
            {e.error && <div className="t2">{e.error}</div>}
          </div>
          <time>{fmtClock(e.at)}</time>
        </li>
      ))}
    </ul>
  );
}
