import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, RotateCcw, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { errorMessage } from '../api';
import { ErrorBanner, Logo } from '../components/atoms';
import { useLightTheme } from '../hooks/useTheme';

const PERKS = [
  [Zap, 'Instant submit', 'Jobs return in milliseconds and run in the background.'],
  [RotateCcw, 'Automatic retries', 'Failures back off and retry before anyone is paged.'],
  [CheckCircle2, 'Live status', 'Every state change shows up on screen as it happens.'],
];

export default function Login() {
  useLightTheme();
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [apiDown, setApiDown] = useState('');

  // Check the API once, so a stopped server is reported before anyone types a password.
  useEffect(() => {
    api.get('/health').then(() => setApiDown('')).catch((e) => {
      const d = e?.response?.data;
      // /health answers 503 with { ok: false } when MongoDB or Redis is down.
      if (d && d.ok === false) setApiDown(`The API is running but ${!d.mongo ? 'MongoDB' : 'Redis'} is not reachable. Start it and reload this page.`);
      else setApiDown(errorMessage(e, 'Cannot reach the API server.'));
    });
  }, []);

  if (user) return <Navigate to="/app" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (email, password, name) => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'register' && name !== undefined) await register(name, email, password, remember);
      else await login(email, password, remember);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(form.email, form.password, mode === 'register' ? form.name : undefined);
  };

  const demo = (email, password) => {
    setMode('login');
    setForm((f) => ({ ...f, email, password }));
    setBusy(true);
    setError('');
    login(email, password, remember)
      .then(() => navigate('/app', { replace: true }))
      .catch((err) => setError(errorMessage(err, 'Demo accounts are created when the server starts with seeding on.')))
      .finally(() => setBusy(false));
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <Link to="/" className="brand"><Logo size={32} />Orchestra</Link>
        <div className="auth-copy">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Send the slow work to the back room. <em>Keep the front desk quick.</em>
          </motion.h2>
          <motion.p className="lede" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
            Emails, reports and CSV imports run on background workers. You see every job's status as it changes.
          </motion.p>
          <ul className="auth-perks">
            {PERKS.map(([Icon, t, d], i) => (
              <motion.li key={t} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.1 }}>
                <span><Icon size={17} /></span>
                <div><b>{t}</b><small>{d}</small></div>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link to="/" className="back"><ArrowLeft size={15} /> Back to home</Link>
          <div>
            <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {mode === 'login' ? 'Sign in, or try a demo workspace below.' : 'New accounts get member access. Admins are set up by the server.'}
            </p>
          </div>

          {apiDown && !error && <ErrorBanner>{apiDown}</ErrorBanner>}
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <form className="form" onSubmit={submit}>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required minLength={2} />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw">
                <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} />
                <button type="button" className="btn ghost icon sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mode === 'register' && <span className="hint">At least 8 characters.</span>}
            </div>
            <label className="check" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ marginTop: 0 }} />
              <span className="hint">Keep me signed in on this browser (shared by all tabs)</span>
            </label>
            <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>

          {mode === 'login' && (
            <>
              <div className="divider">or explore with a demo account</div>
              <div className="demo-row">
                <button className="btn" disabled={busy} onClick={() => demo('demo@orchestra.dev', 'Demo@1234')}>Member demo</button>
                <button className="btn" disabled={busy} onClick={() => demo('admin@orchestra.dev', 'Admin@123')}>Admin demo</button>
              </div>
            </>
          )}

          <p className="switch">
            {mode === 'login' ? 'New to Orchestra? ' : 'Already have an account? '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
