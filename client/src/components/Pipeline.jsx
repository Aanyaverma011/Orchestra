import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmtNumber } from '../lib/format';

function Stage({ s, name, n = 0 }) {
  const prev = useRef(n);
  const [bump, setBump] = useState(false);

  // Nudge a stage when its count changes, so you can see jobs moving through.
  useEffect(() => {
    if (prev.current !== n) {
      setBump(true);
      prev.current = n;
      const t = setTimeout(() => setBump(false), 650);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [n]);

  const live = (s === 'processing' || s === 'retrying') && n > 0;
  return (
    <div className={`stage ${live ? 'active' : ''} ${bump ? 'bump' : ''}`} data-s={s}>
      <span className="name"><i />{name}</span>
      <span className="n">{fmtNumber(n)}</span>
    </div>
  );
}

const Link = ({ flow }) => (
  <span className={`link ${flow ? 'flow' : ''}`} aria-hidden="true">
    <ChevronRight size={16} />
  </span>
);

/**
 * The job state machine from the architecture, drawn with live counts.
 * Happy path on top, failure path below.
 */
export default function Pipeline({ stats }) {
  const b = stats?.byStatus || {};
  const waiting = (b.queued || 0) + (b.scheduled || 0);
  const busy = (b.processing || 0) > 0;

  return (
    <section className="panel pipeline" aria-label="Job pipeline">
      <div className="pipeline-head">
        <h2>Pipeline</h2>
        <span>
          {stats
            ? `${fmtNumber(stats.queue.waiting + stats.queue.active)} in Redis now · ${stats.workers} worker${stats.workers === 1 ? '' : 's'} online`
            : 'Loading…'}
        </span>
      </div>

      <div className="lane">
        <div className="lane-label">On success</div>
        <div className="lane-track">
          <Stage s="queued" name="Queued" n={waiting} />
          <Link flow={busy} />
          <Stage s="processing" name="Processing" n={b.processing} />
          <Link flow={busy} />
          <Stage s="completed" name="Completed" n={b.completed} />
        </div>
      </div>

      <div className="lane">
        <div className="lane-label">On error</div>
        <div className="lane-track">
          <span className="lane-gap" />
          <span className="lane-gap" />
          <Stage s="retrying" name="Retrying with backoff" n={b.retrying} />
          <Link />
          <Stage s="dead" name="Dead after 4 attempts" n={b.dead} />
        </div>
      </div>
    </section>
  );
}
