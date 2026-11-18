import { useEffect, useRef, useState } from 'react';

/** Animates a number from its previous value to `target`. Respects reduced motion. */
export default function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const [value, setValue] = useState(target ?? 0);
  const from = useRef(target ?? 0);

  useEffect(() => {
    if (target == null || Number.isNaN(target)) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(target); from.current = target; return undefined; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = a + (target - a) * eased;
      setValue(decimals ? Number(v.toFixed(decimals)) : Math.round(v));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals]);

  return value;
}
