import { useState } from 'react';

export default function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('orchestra-theme', next); } catch { /* ignore */ }
    setTheme(next);
  };
  return [theme, toggle];
}
