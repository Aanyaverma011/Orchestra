import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/atoms';
import LiveDemo from '../components/landing/LiveDemo';
import SiteFooter from '../components/SiteFooter';
import Lifecycle from '../components/landing/Lifecycle';
import { useLightTheme } from '../hooks/useTheme';

const NAV = [['Features', '#features'], ['How it works', '#how'], ['Lifecycle', '#lifecycle'], ['Architecture', '#architecture'], ['FAQ', '#faq']];

const METRICS = [['3', 'job types built in'], ['4', 'attempts before a job is dead'], ['30s', 'dashboard stats cache'], ['2', 'roles: member and admin']];

const STEPS = [
  ['1', 'Submit', 'Send a job with a type, a priority and an optional delay or schedule.'],
  ['2', 'Queue', 'It is saved first, then queued, so a crash never loses work.'],
  ['3', 'Process', 'A worker runs it, writes logs and progress, and reports back live.'],
];

const FEATURES = [
  ['Instant submit, slow work in the background.', 'The API saves your job and answers right away. Emails, PDFs and CSV imports run on workers, so nobody waits on a spinner.'],
  ['Retries with backoff.', 'Failed attempts retry after 2, 4 and 8 seconds before a job is marked dead.'],
  ['Dead-letter inbox.', 'Read the last error, then retry in one click.'],
  ['Delayed and recurring jobs.', 'Run now, after a delay, at a set time or on a cron schedule.'],
  ['Priorities that matter.', 'High priority jobs jump ahead of low priority ones in the same queue.'],
  ['Idempotency keys.', 'A double-click or a network retry creates one job, never two. Emails are never sent twice.'],
  ['Roles and private data.', 'Members see their own jobs. Admins see everything and manage workers.'],
  ['Plain-language failure explainer.', 'Turns a stack of error text into two sentences you can act on. Your job payload is never sent.'],
];

const ARCH = [
  ['Dashboard', 'Live view and controls'],
  ['API', 'Auth, validation, enqueue'],
  ['Queue and database', 'Fast queue, permanent history'],
  ['Workers', 'Run jobs, scale freely'],
];

const FAQ = [
  ['What happens if a worker crashes in the middle of a job?', 'The job is detected as stalled and goes back to the queue. Another worker finishes it, and idempotent processors make sure nothing is done twice.'],
  ['Can I scale workers without touching the API?', 'Yes. Workers are separate processes that pull from the same queue. Start more of them and throughput goes up, and the Workers page shows each one live.'],
  ['What kinds of jobs can I run?', 'Send email, generate a PDF or CSV report, and process an uploaded CSV file. Each one is a processor, so adding a new type is a small, isolated change.'],
  ['Who can see my jobs?', 'You see only the jobs you created. Administrators see all jobs, the dead-letter inbox and the worker fleet. Public sign-up can never create an admin.'],
  ['Do I need to set anything up to try it?', 'No. Use the demo buttons on the sign-in page to explore as a member or as an admin.'],
];

// Sections below the hero fade in once as you scroll. Nothing at the top moves.
const reveal = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } };
function Reveal({ children, className = '', as = 'div' }) {
  const Tag = motion[as];
  return <Tag className={className} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>{children}</Tag>;
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="lp-faq">
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            {q}
            <ChevronDown size={16} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                <p>{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function SectionHead({ label, title, children }) {
  return (
    <div className="lp-head">
      <span className="lp-label">{label}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export default function Landing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  useLightTheme();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  // Signs in to the seeded member account and opens the dashboard.
  const tryDemo = async () => {
    if (user) return navigate('/app');
    setBusy(true);
    try {
      await login('demo@orchestra.dev', 'Demo@1234');
      navigate('/app');
    } catch {
      navigate('/login');
    } finally {
      setBusy(false);
    }
  };

  const go = (e, href) => {
    e.preventDefault();
    setMenu(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <a href="#top" className="lp-brand" onClick={(e) => go(e, '#top')}><Logo size={22} />Orchestra</a>
          <nav className={`lp-links ${menu ? 'open' : ''}`} aria-label="Sections">
            {NAV.map(([label, href]) => <a key={href} href={href} onClick={(e) => go(e, href)}>{label}</a>)}
          </nav>
          <div className="lp-nav-actions">
            {user ? (
              <Link to="/app" className="lp-btn primary">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="lp-btn ghost lp-hide-sm">Sign in</Link>
                <Link to="/login" className="lp-btn primary">Get started <ArrowRight size={15} /></Link>
              </>
            )}
            <button className="lp-icon lp-burger" onClick={() => setMenu((m) => !m)} aria-label="Menu">{menu ? <X size={16} /> : <Menu size={16} />}</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">Job scheduling with a live dashboard</p>
              <h1>Run background work without making anyone wait</h1>
              <p className="lp-lede">
                Submit a job and move on. Watch it travel from queued to completed, retry what fails, and add workers whenever you need more speed.
              </p>
              <div className="lp-cta">
                <button className="lp-btn primary lg" onClick={tryDemo} disabled={busy}>{busy ? 'Opening…' : user ? 'Open dashboard' : 'Try the live demo'}</button>
                <a href="#how" className="lp-btn lg" onClick={(e) => go(e, '#how')}>See how it works</a>
              </div>
              <ul className="lp-points">
                <li>No setup needed for the demo</li>
                <li>Member and admin views</li>
                <li>Light and dark themes</li>
              </ul>
            </div>
            <div className="lp-hero-art">
              <LiveDemo />
              <p className="lp-caption">The overview page with three workers running. Click the tabs to filter.</p>
            </div>
          </div>
        </section>

        <section className="lp-wrap">
          <dl className="lp-metrics">
            {METRICS.map(([n, label]) => (
              <div key={label}><dt>{n}</dt><dd>{label}</dd></div>
            ))}
          </dl>
        </section>

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <SectionHead label="How it works" title="Three steps from request to result">
              Your app stays quick because it only decides what to run. Separate workers do the heavy lifting.
            </SectionHead>
            <div className="lp-how">
              <ol className="how-steps">
                {STEPS.map(([n, t, d]) => (
                  <li key={n} className="how-step">
                    <span className="how-n">{n}</span>
                    <div><b>{t}</b><p>{d}</p></div>
                  </li>
                ))}
              </ol>
              <Reveal className="codecard">
                <div className="code-bar"><span>request</span></div>
                <pre className="mono"><span className="c-m">POST</span> /api/jobs{'\n'}<span className="c-k">Idempotency-Key:</span> 7f3c-e21a{'\n\n'}{'{'}{'\n'}  <span className="c-k">"type"</span>: <span className="c-s">"generate-report"</span>,{'\n'}  <span className="c-k">"priority"</span>: <span className="c-s">"high"</span>,{'\n'}  <span className="c-k">"delay"</span>: <span className="c-s">"5m"</span>{'\n'}{'}'}</pre>
                <div className="code-res"><b className="c-ok">202 Accepted</b><span className="muted">returned before the work even starts</span></div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <SectionHead label="Features" title="Everything a real queue needs, nothing it does not">
              Reliability, control and visibility in one place.
            </SectionHead>
            <Reveal className="does">
              <ul className="does-list">
                {FEATURES.map(([lead, rest]) => (
                  <li key={lead}><b>{lead}</b> {rest}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="lifecycle">
          <div className="lp-wrap">
            <SectionHead label="Lifecycle" title="Follow a job from start to finish">
              Switch scenarios to see what happens when everything works, and when it does not.
            </SectionHead>
            <Reveal className="life-panel"><Lifecycle /></Reveal>
          </div>
        </section>

        <section className="lp-sec" id="architecture">
          <div className="lp-wrap">
            <SectionHead label="Architecture" title="Each part does one job well">
              The browser never talks to workers, and workers never block the API.
            </SectionHead>
            <Reveal className="arch">
              {ARCH.map(([t, d], i) => (
                <div key={t} className="arch-node">
                  <span className="arch-i">{String(i + 1).padStart(2, '0')}</span>
                  <b>{t}</b>
                  <small>{d}</small>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="lp-sec" id="faq">
          <div className="lp-wrap">
            <SectionHead label="FAQ" title="Questions, answered" />
            <Reveal><Faq /></Reveal>
          </div>
        </section>

        <section className="lp-wrap">
          <div className="lp-final">
            <div>
              <h2>See your queue move in real time</h2>
              <p>Open the demo workspace and submit your first job in under a minute.</p>
            </div>
            <div className="lp-cta">
              <button className="lp-btn primary lg" onClick={tryDemo} disabled={busy}>{user ? 'Open dashboard' : 'Try the live demo'}</button>
              {!user && <Link to="/login" className="lp-btn lg">Create an account</Link>}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
