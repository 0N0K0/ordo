import { useEffect, useState } from 'react';
import classes from './HeaderClock.module.css';

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Text with a capital first letter.
 * @param {string} text Text.
 * @returns {string} Text.
 */
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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
 * Date and time in the middle of the app header: the full date on large screens, shortened on medium ones, the
 * time alone on very small ones.
 * @returns {JSX.Element} Clock.
 */
export function HeaderClock() {
  const now = useMinute();
  return (
    <time className={classes.clock} dateTime={now.toISOString()}>
      <span className={classes.long}>{capitalized(longDate.format(now))}</span>
      <span className={classes.short}>{capitalized(shortDate.format(now))}</span>
      <span className={classes.time}>{timeFormat.format(now)}</span>
    </time>
  );
}
