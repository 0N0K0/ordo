import { plural } from '../../../lib/text';
import { useTimeLost, type TimeLostQuery } from '../api';

/**
 * Sentence telling how many times a deletion takes with it (extra A of decision D17).
 * @param {number} count Number of times.
 * @returns {string} Sentence (empty without any).
 */
function timeLostText(count: number): string {
  if (!count) return '';
  return `${count} temps sans projet, qui ne ${plural(count, 'porte', 'portent')} sur rien d’autre, ${plural(count, 'sera', 'seront')} aussi ${plural(count, 'supprimé')} (les temps facturés sont gardés).`;
}

/**
 * Risk of the deletion of tasks, routines, an event or a calendar: the times without project left with nothing attached are
 * deleted with them (extra A of decision D17); nothing shown when there is none.
 * @param {{ query: TimeLostQuery }} props Component props: the items deleted, as their deletion takes them.
 * @returns {JSX.Element | null} Sentence, after a space.
 */
export function TimeLostRisk({ query }: { query: TimeLostQuery }) {
  const { data: count } = useTimeLost(query);
  return count ? <> {timeLostText(count)}</> : null;
}
