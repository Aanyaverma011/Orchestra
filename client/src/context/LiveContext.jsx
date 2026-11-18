import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const LiveContext = createContext({ connected: false, subscribe: () => () => {}, notifications: [], unread: 0, markRead: () => {}, clearNotifications: () => {}, nameOf: () => '' });
export const useLive = () => useContext(LiveContext);

// Only these changes are worth interrupting someone for.
const NOTIFY = new Set(['completed', 'dead', 'retrying', 'cancelled']);

/**
 * One Socket.io connection for the whole app. Pages call `subscribe(fn)` to
 * receive `job:update` / `job:created` events. The server only sends events for
 * this user's jobs (or every job for admins), so no filtering is needed here.
 *
 * The provider also keeps a short notification history for the bell in the top bar.
 */
export function LiveProvider({ children }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set());
  const names = useRef(new Map());

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    const fan = (evt) => listeners.current.forEach((fn) => fn(evt));
    const note = (evt) => {
      if (!NOTIFY.has(evt.status)) return;
      setNotifications((cur) => [{ key: `${evt.id}-${evt.status}-${Date.now()}`, id: evt.id, status: evt.status, error: evt.error, at: Date.now() }, ...cur].slice(0, 30));
      setUnread((n) => n + 1);
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('job:update', (payload) => {
      const evt = { type: 'update', ...payload };
      fan(evt);
      note(evt);
    });
    socket.on('job:created', (job) => {
      names.current.set(job.id, job.name);
      fan({ type: 'created', id: job.id, job });
    });

    return () => {
      socket.close();
      setConnected(false);
    };
  }, [token]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const markRead = useCallback(() => setUnread(0), []);
  const clearNotifications = useCallback(() => { setNotifications([]); setUnread(0); }, []);
  const nameOf = useCallback((id) => names.current.get(id), []);

  const value = useMemo(
    () => ({ connected, subscribe, notifications, unread, markRead, clearNotifications, nameOf }),
    [connected, subscribe, notifications, unread, markRead, clearNotifications, nameOf]
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
