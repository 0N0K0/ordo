import { useEffect, useState } from 'react';

/**
 * Current time, refreshed every second while `active` (a running timer), frozen otherwise.
 * @param {boolean} active Whether to tick.
 * @returns {number} Current time in ms.
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
