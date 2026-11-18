import { useEffect, useState } from 'react';

/**
 * Current time, refreshed at an interval while `active` (a running timer, a cell shown…), frozen otherwise.
 * @param {boolean} active Whether to tick.
 * @param {number} [everyMs=1000] Interval between refreshes, in ms. Optional. Default = every second.
 * @returns {number} Current time in ms.
 */
export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [active, everyMs]);
  return now;
}
