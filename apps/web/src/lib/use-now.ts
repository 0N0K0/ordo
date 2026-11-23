import { useEffect, useState } from 'react';
import { localDay } from './dates';

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
     * @param {number} [delay] Wait before the next refresh, in ms. Optional. Default = until the next change of the interval.
     * @returns {void}
     */
    const schedule = (delay = everyMs - (Date.now() % everyMs) + 50) => {
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    // Refreshed at once: the time kept while frozen (since the mount) is old.
    schedule(0);
    return () => window.clearTimeout(timer);
  }, [active, everyMs]);
  return now;
}

/**
 * User's current day (YYYY-MM-DD), changing at midnight on its own (checked every minute): what is shown « today »
 * (the menu badges…) follows the day without a reload or a navigation.
 * @returns {string} Day.
 */
export function useToday(): string {
  return localDay(new Date(useNow(true, 60_000)));
}
