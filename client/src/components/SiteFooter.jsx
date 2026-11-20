import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Logo } from './atoms';

export const LEGAL_LINKS = [
  ['Privacy', '/privacy'],
  ['Terms of use', '/terms'],
  ['Legal disclosure', '/legal-disclosure'],
  ['Copyright', '/copyright'],
  ['Trademark', '/trademark'],
  ['Disclaimer', '/disclaimer'],
  ['API Policy', '/api-policy'],
];

// What Orchestra keeps in the browser. There are no cookies and no tracking.
const STORAGE = [
  ['orchestra-token', 'Essential', 'Keeps you signed in. Kept for this tab only, or for the browser if you tick "Keep me signed in".'],
  ['orchestra-theme', 'Preference', 'Remembers light or dark mode for the dashboard.'],
  ['orchestra-density', 'Preference', 'Remembers compact or comfortable tables.'],
];
const PREF_KEYS = ['orchestra-theme', 'orchestra-density'];

function CookiePreferences({ onClose }) {
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clearPrefs = () => {
    try { PREF_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
    setCleared(true);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
        <div className="cookie-head">
          <h2 id="cookie-title">Cookie preferences</h2>
          <button className="lp-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p>Orchestra does not use cookies, analytics or advertising trackers. It keeps a few small values in your browser&apos;s storage:</p>
        <table className="cookie-table">
          <thead><tr><th>Name</th><th>Type</th><th>Purpose</th></tr></thead>
          <tbody>
            {STORAGE.map(([k, t, d]) => (
              <tr key={k}><td className="mono">{k}</td><td>{t}</td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">The sign-in value is needed for the app to work. Signing out removes it.</p>
        <div className="cookie-actions">
          <button className="lp-btn" onClick={clearPrefs} disabled={cleared}>{cleared ? 'Preferences cleared' : 'Clear saved preferences'}</button>
          <button className="lp-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}

export default function SiteFooter() {
  const [cookies, setCookies] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="site-foot">
      <div className="lp-wrap">
        <div className="site-foot-top">
          <div className="site-foot-brand">
            <span className="lp-brand"><Logo size={20} />Orchestra</span>
            <p>Distributed job scheduling and monitoring.</p>
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            <a href="/#features">Features</a>
            <a href="/#how">How it works</a>
            <a href="/#architecture">Architecture</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <nav aria-label="Support">
            <h3>Support</h3>
            <Link to="/help">Help portal</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/api-policy">API Policy</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
        <div className="site-foot-bottom">
          <span>© {year} Orchestra</span>
          <nav aria-label="Legal">
            {LEGAL_LINKS.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
            <button type="button" onClick={() => setCookies(true)}>Cookie Preferences</button>
            <Link to="/contact">Contact</Link>
            <Link to="/help">Help portal</Link>
          </nav>
        </div>
      </div>
      {cookies && <CookiePreferences onClose={() => setCookies(false)} />}
    </footer>
  );
}
