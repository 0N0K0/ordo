import { useLostOnDelete, type LostOnDeleteQuery } from '../api';
import { lostOnDeleteText } from '../lib/lost-on-delete';

/**
 * Risk of the deletion of tasks, routines, occurrences of a routine, an event or a calendar: the times without project
 * left with nothing attached and the comments of what is deleted go with them;
 * nothing shown when there is none.
 * @param {{ query: LostOnDeleteQuery }} props Component props: the items deleted, as their deletion takes them.
 * @returns {JSX.Element | null} Sentences, after a space.
 */
export function LostOnDeleteRisk({ query }: { query: LostOnDeleteQuery }) {
  const { data } = useLostOnDelete(query);
  const text = data ? lostOnDeleteText(data) : '';
  return text ? <> {text}</> : null;
}
