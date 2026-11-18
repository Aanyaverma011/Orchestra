import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { useLive } from '../context/LiveContext';
import { STATUS_LABEL, fmtClock, shortId } from '../lib/format';

const VERB = { completed: 'completed', dead: 'failed permanently', retrying: 'failed and will retry', cancelled: 'was cancelled' };

export default function NotificationBell() {
  const { notifications, unread, markRead, clearNotifications, nameOf } = useLive();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => { setOpen((o) => !o); if (!open) markRead(); };

  return (
    <div className="bell" ref={ref}>
      <button className="btn ghost icon" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} new` : ''}`} aria-expanded={open}>
        <Bell size={17} />
        {unread > 0 && <motion.span className="bell-dot" initial={{ scale: 0 }} animate={{ scale: 1 }}>{unread > 9 ? '9+' : unread}</motion.span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="bell-pop" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
            <div className="bell-head">
              <b>Notifications</b>
              {notifications.length > 0 && <button className="btn ghost sm" onClick={clearNotifications}><CheckCheck size={14} /> Clear</button>}
            </div>
            {notifications.length === 0 ? (
              <div className="bell-empty"><Bell size={20} /><span>You are all caught up.</span><small>Completed, failed and retried jobs show up here.</small></div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.key}>
                    <button onClick={() => { setOpen(false); navigate(`/app/jobs?open=${n.id}`); }}>
                      <i className="dot" style={{ '--c': `var(--${n.status})` }} />
                      <span>
                        <b>{nameOf(n.id) || `Job #${shortId(n.id)}`}</b> {VERB[n.status] || STATUS_LABEL[n.status]}
                        {n.error && <small>{n.error}</small>}
                      </span>
                      <time>{fmtClock(n.at)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
