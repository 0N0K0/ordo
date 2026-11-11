import { useEffect, useState } from 'react';
import classes from './HeaderClock.module.css';

const weekdayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const numericDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
 * Date and time of the app header, on the left above the sidebar: « Mercredi 11/11/26 07:52 »;
 * none on a phone.
 * @returns {JSX.Element} Clock.
 */
export function HeaderClock() {
  const now = useMinute();
  return (
    <time className={classes.clock} dateTime={now.toISOString()}>
      <span>{`${capitalized(weekdayName.format(now))} ${numericDate.format(now)}`}</span>
      <span className={classes.time}>{timeFormat.format(now)}</span>
    </time>
  );
}
