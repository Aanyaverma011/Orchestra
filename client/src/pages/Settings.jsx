import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Rows3, Rows4, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useTheme from '../hooks/useTheme';

const SHORTCUTS = [
  [['Ctrl', 'K'], 'Open the command palette'],
  [['/'], 'Open the command palette'],
  [['N'], 'Create a new job'],
  [['G', 'O'], 'Go to Overview'],
  [['G', 'J'], 'Go to Jobs'],
  [['G', 'S'], 'Go to Schedules'],
  [['G', 'D'], 'Go to Dead letters (admin)'],
  [['G', 'W'], 'Go to Workers (admin)'],
  [['Esc'], 'Close a drawer or dialog'],
];

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [density, setDensity] = useState(() => document.documentElement.getAttribute('data-density') || 'comfortable');

  const pickDensity = (d) => {
    document.documentElement.setAttribute('data-density', d);
    try { localStorage.setItem('orchestra-density', d); } catch { /* ignore */ }
    setDensity(d);
  };

  return (
    <div className="settings">
      <section className="panel">
        <div className="panel-head"><h2>Profile</h2></div>
        <div className="panel-body profile">
          <div className="avatar lg"><User size={22} /></div>
          <div>
            <b>{user?.name}</b>
            <div className="muted">{user?.email}</div>
          </div>
          <span className="pill" data-status={isAdmin ? 'processing' : 'queued'}><ShieldCheck size={12} />{isAdmin ? 'Administrator' : 'Member'}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Appearance</h2><span className="sub">Saved on this device</span></div>
        <div className="panel-body pref-list">
          <div className="pref">
            <div><b>Theme</b><span className="muted">Switch between the dark and light palettes.</span></div>
            <div className="segmented" role="group" aria-label="Theme">
              <button aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()}><Moon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Dark</button>
              <button aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()}><Sun size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Light</button>
            </div>
          </div>
          <div className="pref">
            <div><b>Table density</b><span className="muted">Compact fits more rows on screen.</span></div>
            <div className="segmented" role="group" aria-label="Density">
              <button aria-pressed={density === 'comfortable'} onClick={() => pickDensity('comfortable')}><Rows3 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Comfortable</button>
              <button aria-pressed={density === 'compact'} onClick={() => pickDensity('compact')}><Rows4 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Compact</button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Keyboard shortcuts</h2><span className="sub">Work without leaving the keys</span></div>
        <ul className="shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <li key={what + keys.join()}>
              <span>{what}</span>
              <span>{keys.map((k, i) => <span key={k}><kbd>{k}</kbd>{i < keys.length - 1 && <em className="faint"> then </em>}</span>)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted" style={{ textAlign: 'center' }}>Want a tour of what Orchestra does? <Link to="/" style={{ color: 'var(--accent)' }}>Visit the home page</Link>.</p>
    </div>
  );
}
