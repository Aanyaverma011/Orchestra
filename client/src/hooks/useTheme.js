import { useEffect, useLayoutEffect, useState } from 'react';

const KEY = 'orchestra-theme';
const EVENT = 'orchestra:theme';

const savedTheme = () => {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

/**
 * Dark/light switch for the dashboard. Applies the saved choice when the dashboard
 * mounts, and keeps every component using this hook in step.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(savedTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setTheme(savedTheme());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setTheme(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [theme, toggle];
}

/** Public pages (home, sign in, register) are always light, whatever the dashboard uses. */
export function useLightTheme() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);
}
