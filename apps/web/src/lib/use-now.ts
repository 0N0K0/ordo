import { useEffect, useState } from 'react';

/**
 * Current time, refreshed at an interval while `active` (a running timer, a cell shown…), frozen otherwise. The
 * refreshes fall just after each change of the interval on the clock (each new second, each new minute…), so a time
 * shown to the minute is never a minute late.
 * @param {boolean} active Whether to tick.
 * @param {number} [everyMs=1000] Interval between refreshes, in ms. Optional. Default = every second.
 * @returns {number} Current time in ms.
 */
export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    /**
     * Waits for the next change of the interval on the clock, then for each one after.
     * @returns {void}
     */
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        everyMs - (Date.now() % everyMs) + 50,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [active, everyMs]);
  return now;
}
