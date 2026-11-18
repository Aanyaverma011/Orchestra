import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useScroll, useSpring } from 'framer-motion';
import {
  ArrowRight, BellRing, CalendarClock, ChevronDown, Database, Gauge, KeyRound, LayoutDashboard, Menu, Moon,
  Monitor, Play, Repeat, ShieldCheck, Skull, Sparkles, Sun, Server, Cpu, X, Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/atoms';
import LiveDemo from '../components/landing/LiveDemo';
import Lifecycle from '../components/landing/Lifecycle';
import useCountUp from '../hooks/useCountUp';
import useTheme from '../hooks/useTheme';

const NAV = [['Features', '#features'], ['How it works', '#how'], ['Lifecycle', '#lifecycle'], ['Architecture', '#architecture'], ['FAQ', '#faq']];

const FEATURES = [
  { icon: Zap, title: 'Instant submit, slow work in the background', text: 'The API saves your job and answers right away. Emails, PDFs and CSV imports run on workers, so nobody waits on a spinner.', span: 'wide', tag: 'Fast' },
  { icon: Repeat, title: 'Retries with backoff', text: 'Failed attempts retry after 2, 4 and 8 seconds before a job is marked dead.', tag: 'Reliable' },
  { icon: Skull, title: 'Dead-letter inbox', text: 'Read the last error, then retry in one click.', tag: 'Recoverable' },
  { icon: CalendarClock, title: 'Delayed and recurring jobs', text: 'Run now, after a delay, at a set time or on a cron schedule.', tag: 'Scheduling' },
  { icon: Gauge, title: 'Priorities that matter', text: 'High priority jobs jump ahead of low priority ones in the same queue.', tag: 'Control' },
  { icon: KeyRound, title: 'Idempotency keys', text: 'A double-click or a network retry creates one job, never two. Emails are never sent twice.', tag: 'Safe', span: 'wide' },
  { icon: ShieldCheck, title: 'Roles and private data', text: 'Members see their own jobs. Admins see everything and manage workers.', tag: 'Secure', span: 'wide' },
  { icon: Sparkles, title: 'Plain-language failure explainer', text: 'Turns a stack of error text into two sentences you can act on. Your job payload is never sent.', tag: 'Helpful', span: 'wide' },
];

const FAQ = [
  ['What happens if a worker crashes in the middle of a job?', 'The job is detected as stalled and goes back to the queue. Another worker finishes it, and idempotent processors make sure nothing is done twice.'],
  ['Can I scale workers without touching the API?', 'Yes. Workers are separate processes that pull from the same queue. Start more of them and throughput goes up, and the Workers page shows each one live.'],
  ['What kinds of jobs can I run?', 'Send email, generate a PDF or CSV report, and process an uploaded CSV file. Each one is a processor, so adding a new type is a small, isolated change.'],
  ['Who can see my jobs?', 'You see only the jobs you created. Administrators see all jobs, the dead-letter inbox and the worker fleet. Public sign-up can never create an admin.'],
  ['Do I need to set anything up to try it?', 'No. Use the demo buttons on the sign-in page to explore as a member or as an admin.'],
];

const reveal = { hidden: { opacity: 0, y: 28 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }) };

function Reveal({ children, i = 0, className = '', as = 'div', ...rest }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={reveal} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} {...rest}>
      {children}
    </Tag>
  );
}

function Counter({ to, suffix = '', prefix = '', label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const v = useCountUp(inView ? to : 0, { duration: 1400 });
  return (
    <div ref={ref} className="lp-metric">
      <b className="num">{prefix}{v}{suffix}</b>
      <span>{label}</span>
    </div>
  );
}

function Spotlight({ children, className = '' }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return <div className={`spot ${className}`} onMouseMove={onMove}>{children}</div>;
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="lp-faq">
      {FAQ.map(([q, a], i) => (
        <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            {q}
            <ChevronDown size={18} />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                <p>{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

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
      <motion.div className="lp-progress" style={{ scaleX: progress }} />

      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <a href="#top" className="brand" onClick={(e) => go(e, '#top')}><Logo />Orchestra</a>
          <nav className={`lp-links ${menu ? 'open' : ''}`} aria-label="Sections">
            {NAV.map(([label, href]) => <a key={href} href={href} onClick={(e) => go(e, href)}>{label}</a>)}
          </nav>
          <div className="lp-nav-actions">
            <button className="btn ghost icon" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            {user ? (
              <Link to="/app" className="btn primary"><LayoutDashboard size={16} /> Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn ghost lp-hide-sm">Sign in</Link>
                <Link to="/login" className="btn primary lp-hide-xs">Get started <ArrowRight size={15} /></Link>
              </>
            )}
            <button className="btn ghost icon lp-burger" onClick={() => setMenu((m) => !m)} aria-label="Menu">{menu ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ───────── Hero ───────── */}
        <section className="lp-hero">
          <div className="lp-bg" aria-hidden="true"><span className="orb o1" /><span className="orb o2" /><span className="grid-bg" /></div>
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <motion.span className="lp-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <i /> Job scheduling with a live dashboard
              </motion.span>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                Run background work <em>without making anyone wait</em>
              </motion.h1>
              <motion.p className="lp-lede" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.7 }}>
                Submit a job and move on. Watch it travel from queued to completed, retry what fails, and add workers whenever you need more speed.
              </motion.p>
              <motion.div className="lp-cta" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }}>
                <button className="btn primary lg" onClick={tryDemo} disabled={busy}><Play size={16} /> {busy ? 'Opening…' : user ? 'Open dashboard' : 'Try the live demo'}</button>
                <a href="#how" className="btn lg" onClick={(e) => go(e, '#how')}>See how it works</a>
              </motion.div>
              <motion.ul className="lp-points" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <li>No setup needed for the demo</li>
                <li>Member and admin views</li>
                <li>Light and dark themes</li>
              </motion.ul>
            </div>
            <motion.div className="lp-hero-art" initial={{ opacity: 0, y: 40, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
              <LiveDemo />
              <motion.div className="float f1" animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
                <BellRing size={15} /> Report ready to download
              </motion.div>
              <motion.div className="float f2" animate={{ y: [0, 9, 0] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut', delay: 0.6 }}>
                <Repeat size={15} /> Retry 2 of 4 in 4s
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ───────── Metrics ───────── */}
        <section className="lp-wrap">
          <Reveal className="lp-metrics">
            <Counter to={3} label="job types built in" />
            <Counter to={4} label="attempts before a job is dead" />
            <Counter to={30} suffix="s" label="dashboard stats cache" />
            <Counter to={2} label="roles: member and admin" />
          </Reveal>
        </section>

        {/* ───────── How it works ───────── */}
        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="kicker">How it works</span>
              <h2>Three steps from request to result</h2>
              <p>Your app stays quick because it only decides what to run. Separate workers do the heavy lifting.</p>
            </Reveal>
            <div className="lp-how">
              <div className="how-steps">
                {[
                  ['1', 'Submit', 'Send a job with a type, a priority and an optional delay or schedule.', Zap],
                  ['2', 'Queue', 'It is saved first, then queued, so a crash never loses work.', Database],
                  ['3', 'Process', 'A worker runs it, writes logs and progress, and reports back live.', Cpu],
                ].map(([n, t, d, Icon], i) => (
                  <Reveal key={n} i={i} className="how-step">
                    <span className="how-n">{n}</span>
                    <div><b><Icon size={16} /> {t}</b><p>{d}</p></div>
                  </Reveal>
                ))}
              </div>
              <Reveal i={1} className="codecard">
                <div className="code-bar"><i /><i /><i /><span className="mono">request</span></div>
                <pre className="mono"><span className="c-m">POST</span> /api/jobs{'\n'}<span className="c-k">Idempotency-Key:</span> 7f3c-e21a{'\n\n'}{'{'}{'\n'}  <span className="c-k">"type"</span>: <span className="c-s">"generate-report"</span>,{'\n'}  <span className="c-k">"priority"</span>: <span className="c-s">"high"</span>,{'\n'}  <span className="c-k">"delay"</span>: <span className="c-s">"5m"</span>{'\n'}{'}'}</pre>
                <div className="code-res"><span className="pill" data-status="completed"><i />202 Accepted</span><span className="muted">returned before the work even starts</span></div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ───────── Features ───────── */}
        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="kicker">Features</span>
              <h2>Everything a real queue needs, nothing it does not</h2>
              <p>Reliability, control and visibility in one place.</p>
            </Reveal>
            <div className="bento">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <Reveal key={f.title} i={i % 3} className={`bento-cell ${f.span || ''}`}>
                    <Spotlight className="bento-card">
                      <span className="bento-tag">{f.tag}</span>
                      <span className="bento-ico"><Icon size={20} /></span>
                      <h3>{f.title}</h3>
                      <p>{f.text}</p>
                    </Spotlight>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────── Lifecycle ───────── */}
        <section className="lp-sec" id="lifecycle">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="kicker">Lifecycle</span>
              <h2>Follow a job from start to finish</h2>
              <p>Switch scenarios to see what happens when everything works, and when it does not.</p>
            </Reveal>
            <Reveal className="panel life-panel"><Lifecycle /></Reveal>
          </div>
        </section>

        {/* ───────── Architecture ───────── */}
        <section className="lp-sec" id="architecture">
          <div className="lp-wrap">
            <Reveal className="lp-head">
              <span className="kicker">Architecture</span>
              <h2>Each part does one job well</h2>
              <p>The browser never talks to workers, and workers never block the API.</p>
            </Reveal>
            <Reveal className="arch">
              {[
                [Monitor, 'Dashboard', 'Live view and controls'],
                [Server, 'API', 'Auth, validation, enqueue'],
                [Database, 'Queue and database', 'Fast queue, permanent history'],
                [Cpu, 'Workers', 'Run jobs, scale freely'],
              ].map(([Icon, t, d], i, arr) => (
                <div key={t} className="arch-item">
                  <div className="arch-node"><span><Icon size={20} /></span><b>{t}</b><small>{d}</small></div>
                  {i < arr.length - 1 && <span className="arch-link"><u /></span>}
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ───────── FAQ ───────── */}
        <section className="lp-sec" id="faq">
          <div className="lp-wrap narrow">
            <Reveal className="lp-head">
              <span className="kicker">FAQ</span>
              <h2>Questions, answered</h2>
            </Reveal>
            <Reveal><Faq /></Reveal>
          </div>
        </section>

        {/* ───────── CTA ───────── */}
        <section className="lp-wrap">
          <Reveal className="lp-final">
            <span className="orb o3" aria-hidden="true" />
            <h2>See your queue move in real time</h2>
            <p>Open the demo workspace and submit your first job in under a minute.</p>
            <div className="lp-cta" style={{ justifyContent: 'center' }}>
              <button className="btn primary lg" onClick={tryDemo} disabled={busy}><Play size={16} /> {user ? 'Open dashboard' : 'Try the live demo'}</button>
              {!user && <Link to="/login" className="btn lg">Create an account</Link>}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span className="brand"><Logo size={24} />Orchestra</span>
          <span className="muted">Distributed job scheduling and monitoring.</span>
          <nav>{NAV.slice(0, 4).map(([l, h]) => <a key={h} href={h} onClick={(e) => go(e, h)}>{l}</a>)}</nav>
        </div>
      </footer>
    </div>
  );
}
