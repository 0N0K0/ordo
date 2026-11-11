import { useEffect, useState } from 'react';
import classes from './HeaderClock.module.css';

const weekdayInitial = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });
const numericDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

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
 * Date and time of the app header, on the left above the sidebar: « M 11/11/26 07:52 » (initial of the weekday);
 * none on a phone.
 * @returns {JSX.Element} Clock.
 */
export function HeaderClock() {
  const now = useMinute();
  return (
    <time className={classes.clock} dateTime={now.toISOString()}>
      <span>{`${weekdayInitial.format(now).toUpperCase()} ${numericDate.format(now)}`}</span>
      <span className={classes.time}>{timeFormat.format(now)}</span>
    </time>
  );
}
