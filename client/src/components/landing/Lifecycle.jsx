import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const FLOWS = {
  success: {
    note: 'A worker picks the job up, runs it and records the result.',
    steps: [
      { s: 'queued', name: 'Queued', text: 'Saved to the database, then placed on the queue.' },
      { s: 'processing', name: 'Processing', text: 'A free worker claims it and streams progress.' },
      { s: 'completed', name: 'Completed', text: 'Result stored. The dashboard updates instantly.' },
    ],
  },
  failure: {
    note: 'Errors are retried with growing delays before a human gets involved.',
    steps: [
      { s: 'queued', name: 'Queued', text: 'Waiting for a worker.' },
      { s: 'processing', name: 'Processing', text: 'The attempt throws an error.' },
      { s: 'retrying', name: 'Retrying', text: 'Backs off 2s, then 4s, then 8s.' },
      { s: 'dead', name: 'Dead letter', text: 'After 4 attempts it waits for an admin to retry.' },
    ],
  },
};

export default function Lifecycle() {
  const [mode, setMode] = useState('success');
  const [at, setAt] = useState(0);
  const flow = FLOWS[mode];

  // Step through the states on a timer, then start over.
  useEffect(() => {
    setAt(0);
    const t = setInterval(() => setAt((a) => (a + 1) % (flow.steps.length + 1)), 1500);
    return () => clearInterval(t);
  }, [mode, flow.steps.length]);

  return (
    <div className="life">
      <div className="life-top">
        <div className="segmented" role="group" aria-label="Scenario">
          <button aria-pressed={mode === 'success'} onClick={() => setMode('success')}>Happy path</button>
          <button aria-pressed={mode === 'failure'} onClick={() => setMode('failure')}>When it fails</button>
        </div>
        <p className="muted">{flow.note}</p>
      </div>
      <ol className="life-steps">
        {flow.steps.map((st, i) => {
          const state = i < at ? 'past' : i === at ? 'now' : 'next';
          return (
            <li key={st.name} className={`life-step ${state}`} data-s={st.s}>
              <span className="life-n">Step {i + 1}</span>
              <b>{st.name}</b>
              <span className="life-text">{st.text}</span>
              {state === 'now' && <motion.i className="life-bar" layoutId="life-bar" transition={{ duration: 0.4 }} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
