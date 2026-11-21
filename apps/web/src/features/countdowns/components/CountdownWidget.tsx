import { countdownRemaining, formatClock } from '@ordo/shared';
import { RunningPill } from '../../../components/feedback/RunningPill';
import { useNow } from '../../../lib/use-now';
import { countOf } from '../../../lib/text';
import { useCountdowns } from '../api';
import { countdownName } from '../lib/countdowns';
import { CountdownList } from './CountdownList';

/**
 * Timers in the app header, on every page and in every workspace: the soonest to ring, its name (or the
 * number of timers) and the time left, opening the list of them (each with its commands, « Lancer un minuteur »).
 * @returns {JSX.Element | null} Pill, while a timer counts down.
 */
export function CountdownWidget() {
  const { data: countdowns } = useCountdowns();
  const list = countdowns ?? [];
  const soonest = list[0];
  const paused = list.every((countdown) => countdown.endsAt === null);
  const now = useNow(Boolean(soonest) && !paused);
  if (!soonest) return null;
  return (
    <RunningPill
      tone="countdown"
      label="Minuteurs en cours"
      paused={paused}
      subject={list.length > 1 ? countOf(list.length, 'minuteur') : countdownName(soonest)}
      clock={formatClock(countdownRemaining(soonest, now))}
      details={<CountdownList compact />}
      detailsWidth={420}
    />
  );
}
