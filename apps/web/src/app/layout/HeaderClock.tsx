import * as fmt from '../../lib/format';
import { useNow } from '../../lib/use-now';
import classes from './HeaderClock.module.css';

/**
 * Date and time of the app header, on the left above the sidebar: « Mer. 11 nov. 07:52 »;
 * none on a phone.
 * @returns {JSX.Element} Clock.
 */
export function HeaderClock() {
  const now = new Date(useNow(true, 60_000));
  return (
    <time className={classes.clock} dateTime={now.toISOString()}>
      <span>{fmt.capitalize(fmt.weekday(now))}</span>
      <span className={classes.time}>{fmt.time(now)}</span>
    </time>
  );
}
