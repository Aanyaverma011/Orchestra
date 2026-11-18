import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Cpu, CornerDownLeft, LayoutDashboard, ListChecks, LogOut, Moon, PlusCircle, Search, Settings as SettingsIcon, Skull, Sun } from 'lucide-react';
import api from '../api';
import { StatusPill } from './atoms';
import { shortId } from '../lib/format';

/** Ctrl/Cmd+K launcher: jump to a page, run an action or find a job by name. */
export default function CommandPalette({ open, onClose, isAdmin, theme, toggleTheme, logout }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const base = useMemo(() => {
    const go = (to) => () => navigate(to);
    return [
      { id: 'overview', group: 'Go to', icon: LayoutDashboard, label: 'Overview', hint: 'G O', run: go('/app') },
      { id: 'jobs', group: 'Go to', icon: ListChecks, label: 'Jobs', hint: 'G J', run: go('/app/jobs') },
      { id: 'schedules', group: 'Go to', icon: CalendarClock, label: 'Schedules', hint: 'G S', run: go('/app/schedules') },
      ...(isAdmin ? [
        { id: 'dead', group: 'Go to', icon: Skull, label: 'Dead letters', hint: 'G D', run: go('/app/dead-letter') },
        { id: 'workers', group: 'Go to', icon: Cpu, label: 'Workers', hint: 'G W', run: go('/app/workers') },
      ] : []),
      { id: 'settings', group: 'Go to', icon: SettingsIcon, label: 'Settings', run: go('/app/settings') },
      { id: 'new', group: 'Actions', icon: PlusCircle, label: 'Create a new job', hint: 'N', run: go('/app/jobs/new') },
      { id: 'theme', group: 'Actions', icon: theme === 'dark' ? Sun : Moon, label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, run: toggleTheme },
      { id: 'out', group: 'Actions', icon: LogOut, label: 'Sign out', run: logout },
    ];
  }, [navigate, isAdmin, theme, toggleTheme, logout]);

  useEffect(() => {
    if (open) { setQ(''); setJobs([]); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  // Search jobs by name once the person pauses typing.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setJobs([]); return undefined; }
    const t = setTimeout(() => {
      api.get('/jobs', { params: { q: term, limit: 5 } }).then((r) => setJobs(r.data.items)).catch(() => setJobs([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term ? base.filter((i) => i.label.toLowerCase().includes(term)) : base;
    const jobItems = jobs.map((j) => ({ id: `job-${j.id}`, group: 'Jobs', job: j, label: j.name, run: () => navigate(`/app/jobs?open=${j.id}`) }));
    return [...filtered, ...jobItems];
  }, [q, base, jobs, navigate]);

  useEffect(() => setIdx(0), [q, jobs.length]);

  const choose = (item) => { onClose(); item?.run(); };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (i + 1) % Math.max(1, items.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (i - 1 + items.length) % Math.max(1, items.length)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[idx]); }
    else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" style={{ zIndex: 70 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="cmdk" role="dialog" aria-label="Command palette" initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
            <div className="cmdk-input">
              <Search size={17} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search pages, actions or jobs by name…" aria-label="Search" />
              <kbd>Esc</kbd>
            </div>
            <ul className="cmdk-list" role="listbox">
              {items.length === 0 && <li className="cmdk-empty">Nothing matches “{q}”.</li>}
              {items.map((item, i) => {
                const head = item.group !== lastGroup ? <li className="cmdk-group" key={`g-${item.group}`}>{item.group}</li> : null;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <li key={item.id} style={{ display: 'contents' }}>
                    {head}
                    <button role="option" aria-selected={i === idx} className={`cmdk-item ${i === idx ? 'on' : ''}`} onMouseMove={() => setIdx(i)} onClick={() => choose(item)}>
                      {Icon ? <Icon size={16} /> : <ListChecks size={16} />}
                      <span className="cmdk-label">{item.label}</span>
                      {item.job && <><span className="mono faint">#{shortId(item.job.id)}</span><StatusPill status={item.job.status} /></>}
                      {item.hint && <span className="cmdk-hint">{item.hint.split(' ').map((k) => <kbd key={k}>{k}</kbd>)}</span>}
                      {i === idx && !item.hint && !item.job && <CornerDownLeft size={14} className="faint" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>Esc</kbd> close</span></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
