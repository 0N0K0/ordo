import { useEffect, useState } from 'react';
import * as fmt from '../lib/format';
import classes from './HeaderClock.module.css';

/**
 * Current time, refreshed at each new minute.
 * @returns {Date} Now.
 */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      // The next change of minute, then each one after.
      timer = window.setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

/**
 * Date and time of the app header, on the left above the sidebar: « Mer. 11 nov. 07:52 »;
 * none on a phone.
 * @returns {JSX.Element} Clock.
 */
export function HeaderClock() {
  const now = useMinute();
  return (
    <time className={classes.clock} dateTime={now.toISOString()}>
      <span>{fmt.capitalize(fmt.weekday(now))}</span>
      <span className={classes.time}>{fmt.time(now)}</span>
    </time>
  );
}
