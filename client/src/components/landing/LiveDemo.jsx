import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSpreadsheet, FileText, Mail } from 'lucide-react';

const POOL = [
  { name: 'Attendance report', type: 'report' },
  { name: 'Customer import', type: 'csv' },
  { name: 'Welcome email', type: 'email' },
  { name: 'Payment receipt', type: 'email' },
  { name: 'Payroll export', type: 'csv' },
  { name: 'Monthly summary', type: 'report' },
  { name: 'Password reset', type: 'email' },
  { name: 'Invoice batch', type: 'report' },
];
const ICON = { report: FileText, csv: FileSpreadsheet, email: Mail };
const LABEL = { queued: 'Queued', processing: 'Processing', completed: 'Completed', retrying: 'Retrying', dead: 'Dead' };

let uid = 0;
const make = (i, status = 'queued') => ({ id: ++uid, ...POOL[i % POOL.length], status, progress: 0, flaky: i % 5 === 3, tries: 0, hold: 0 });

/** A small self-running simulation of the pipeline, used on the landing page. */
export default function LiveDemo() {
  const cursor = useRef(4);
  const [jobs, setJobs] = useState(() => [make(0, 'completed'), make(1, 'processing'), make(2), make(3)].map((j, k) => (k === 0 ? { ...j, progress: 100 } : k === 1 ? { ...j, progress: 40 } : j)));
  const [done, setDone] = useState(1284);

  useEffect(() => {
    const t = setInterval(() => {
      let finished = 0;
      setJobs((cur) => {
        let next = cur.map((j) => {
          if (j.status === 'queued') return { ...j, status: 'processing', progress: 6 };
          if (j.status === 'processing') {
            const p = Math.min(100, j.progress + 18 + Math.random() * 16);
            if (p < 100) return { ...j, progress: p };
            if (j.flaky && j.tries === 0) return { ...j, status: 'retrying', progress: 0, tries: 1, hold: 2 };
            finished += 1;
            return { ...j, status: 'completed', progress: 100, hold: 3 };
          }
          if (j.status === 'retrying') return j.hold > 1 ? { ...j, hold: j.hold - 1 } : { ...j, status: 'processing', progress: 8 };
          if (j.status === 'completed') return { ...j, hold: j.hold - 1 };
          return j;
        });
        next = next.filter((j) => !(j.status === 'completed' && j.hold <= 0));
        while (next.length < 4) next = [...next, make(cursor.current++)];
        return next;
      });
      if (finished) setDone((d) => d + finished);
    }, 1100);
    return () => clearInterval(t);
  }, []);

  const count = (s) => jobs.filter((j) => j.status === s).length;

  return (
    <div className="demo" aria-label="Animated preview of the Orchestra dashboard">
      <div className="demo-bar">
        <i /><i /><i />
        <span>orchestra / overview</span>
        <b className="demo-live"><u /> Live</b>
      </div>
      <div className="demo-body">
        <div className="demo-stages">
          {[['queued', count('queued')], ['processing', count('processing') + count('retrying')], ['completed', done]].map(([s, n], i) => (
            <div key={s} className="demo-stage" data-s={s}>
              <span><i />{s === 'processing' ? 'Processing' : s === 'queued' ? 'Queued' : 'Completed'}</span>
              <motion.b key={n} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="num">{n.toLocaleString('en')}</motion.b>
              {i < 2 && <em className={`demo-arrow ${i === 0 ? 'go' : ''}`} />}
            </div>
          ))}
        </div>
        <ul className="demo-list">
          <AnimatePresence initial={false} mode="popLayout">
            {jobs.map((j) => {
              const Icon = ICON[j.type];
              return (
                <motion.li
                  key={j.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <span className="demo-ico"><Icon size={15} /></span>
                  <span className="demo-name">{j.name}<small className="mono">#{String(j.id * 7919).slice(-5)}</small></span>
                  <span className="demo-meter"><b style={{ width: `${j.progress}%` }} data-s={j.status} /></span>
                  <span className="pill" data-status={j.status}><i />{LABEL[j.status]}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
