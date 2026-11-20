import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, ListChecks, Plus, PlusCircle, CalendarClock, Skull, Cpu, LogOut, Sun, Moon, Menu, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../context/LiveContext';
import { Logo } from './atoms';
import NotificationBell from './NotificationBell';
import useTheme from '../hooks/useTheme';
import api from '../api';

const TITLES = {
  '/app': ['Overview', 'Live view of the queue'],
  '/app/jobs': ['Jobs', 'Every job you can access'],
  '/app/jobs/new': ['New job', 'Submit work to the queue'],
  '/app/schedules': ['Schedules', 'Recurring jobs'],
  '/app/dead-letter': ['Dead letters', 'Jobs that failed every attempt'],
  '/app/workers': ['Workers', 'Processes consuming the queue'],
  '/app/settings': ['Settings', 'Profile and appearance'],
};

const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

export default function Shell() {
  const { user, isAdmin, logout } = useAuth();
  const { connected } = useLive();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [title, sub] = TITLES[pathname] || ['Orchestra', ''];

  // Restore the saved density on first load.
  useEffect(() => { document.documentElement.setAttribute('data-density', pref('orchestra-density', 'comfortable')); }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { document.title = `${title} · Orchestra`; }, [title]);

  // Worker heartbeat count and queue badges for the sidebar.
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/stats').then((r) => alive && setStats(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const inFlight = stats?.inFlight || 0;
  const dead = stats?.byStatus?.dead || 0;
  const workers = stats?.workers;

  const link = (to, Icon, label, { end = false, badge, tone } = {}) => (
    <NavLink to={to} end={end}>
      <Icon size={18} />
      <span className="nav-label">{label}</span>
      {badge > 0 && <em className={`count ${tone || ''}`}>{badge > 99 ? '99+' : badge}</em>}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary">
        <div className="brand">
          <Logo />
          <span>Orchestra</span>
        </div>
        <nav className="nav">
          <div className="nav-group">Workspace</div>
          {link('/app', LayoutDashboard, 'Overview', { end: true })}
          {link('/app/jobs', ListChecks, 'Jobs', { end: true, badge: inFlight })}
          {link('/app/jobs/new', PlusCircle, 'New job')}
          {link('/app/schedules', CalendarClock, 'Schedules')}
          {isAdmin && (
            <>
              <div className="nav-group">Admin</div>
              {link('/app/dead-letter', Skull, 'Dead letters', { badge: dead, tone: 'bad' })}
              {link('/app/workers', Cpu, 'Workers')}
            </>
          )}
          <div className="nav-group">Account</div>
          {link('/app/settings', SettingsIcon, 'Settings')}
        </nav>

        <div className="side-foot">
          <div className="system" aria-label="System status">
            <div className="row"><span className="sys-k"><i className={connected ? 'ok' : 'bad'} />API</span><b>{connected ? 'Connected' : 'Offline'}</b></div>
            <div className="row"><span className="sys-k" title="Background worker processes, not signed-in people"><i className={workers ? 'ok' : 'warn'} />Workers</span><b>{workers ?? '-'}</b></div>
          </div>
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="who">
              <b>{user?.name}</b>
              <span>{isAdmin ? 'Administrator' : 'Member'}</span>
            </div>
            <button className="btn ghost icon sm" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation"><Menu size={18} /></button>
          <div className="topbar-title">
            <h1>{title}</h1>
            <span className="sub">{sub}</span>
          </div>
          <span className="spacer" />
          <NotificationBell />
          <button className="btn ghost icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {pathname !== '/app/jobs/new' && <button className="btn primary" onClick={() => navigate('/app/jobs/new')}><Plus size={16} /> <span className="hide-sm">New job</span></button>}
        </header>
        <main className="page">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
      {open && <div className="scrim" style={{ zIndex: 45 }} onClick={() => setOpen(false)} />}
    </div>
  );
}
