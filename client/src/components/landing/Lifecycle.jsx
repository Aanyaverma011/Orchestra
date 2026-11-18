import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CircleAlert, Clock, Cog, Inbox, Skull } from 'lucide-react';

const FLOWS = {
  success: {
    note: 'A worker picks the job up, runs it and records the result.',
    steps: [
      { s: 'queued', icon: Inbox, name: 'Queued', text: 'Saved to the database, then placed on the queue.' },
      { s: 'processing', icon: Cog, name: 'Processing', text: 'A free worker claims it and streams progress.' },
      { s: 'completed', icon: Check, name: 'Completed', text: 'Result stored. The dashboard updates instantly.' },
    ],
  },
  failure: {
    note: 'Errors are retried with growing delays before a human gets involved.',
    steps: [
      { s: 'queued', icon: Inbox, name: 'Queued', text: 'Waiting for a worker.' },
      { s: 'processing', icon: Cog, name: 'Processing', text: 'The attempt throws an error.' },
      { s: 'retrying', icon: Clock, name: 'Retrying', text: 'Backs off 2s, then 4s, then 8s.' },
      { s: 'dead', icon: Skull, name: 'Dead letter', text: 'After 4 attempts it waits for an admin to retry.' },
    ],
  },
};

export default function Lifecycle() {
  const [mode, setMode] = useState('success');
  const [at, setAt] = useState(0);
  const flow = FLOWS[mode];

  useEffect(() => {
    setAt(0);
    const t = setInterval(() => setAt((a) => (a + 1) % (flow.steps.length + 1)), 1500);
    return () => clearInterval(t);
  }, [mode, flow.steps.length]);

  return (
    <div className="life">
      <div className="life-top">
        <div className="segmented" role="group" aria-label="Scenario">
          <button aria-pressed={mode === 'success'} onClick={() => setMode('success')}><Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Happy path</button>
          <button aria-pressed={mode === 'failure'} onClick={() => setMode('failure')}><CircleAlert size={14} style={{ marginRight: 6, verticalAlign: -2 }} />When it fails</button>
        </div>
        <p className="muted">{flow.note}</p>
      </div>
      <div className="life-track" style={{ '--n': flow.steps.length }}>
        <div className="life-rail"><motion.b animate={{ width: `${Math.min(at, flow.steps.length - 1) / (flow.steps.length - 1) * 100}%` }} transition={{ duration: 0.6, ease: 'easeInOut' }} /></div>
        {flow.steps.map((st, i) => {
          const Icon = st.icon;
          const state = i < at ? 'past' : i === at ? 'now' : 'next';
          return (
            <div key={st.name} className={`life-step ${state}`} data-s={st.s}>
              <motion.span className="life-node" animate={state === 'now' ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.8 }}>
                <Icon size={20} />
              </motion.span>
              <b>{st.name}</b>
              <span>{st.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
