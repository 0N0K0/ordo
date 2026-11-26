import { windowText, type RoutineGroupState } from '@ordo/shared';
import { ProgressBadge } from '../feedback/ProgressBadge';
import { countOf } from '../../lib/text';

interface RoutineGroupProgressProps {
  /** Its state that day (`routineGroupStatesOn`). */
  state: RoutineGroupState;
  /** The day, in words, after « dues » (« aujourd’hui », « ce jour-là »). */
  when: string;
}

/**
 * Progress of a parent routine (a group) on a day, the same in « Ma journée » and the routines table: « 2/3 », its
 * sub-routines done out of those due that day, green once all are; its tooltip tells it, and with several moments the
 * state of each (« 08:00–09:00 : fait »).
 * @param {RoutineGroupProgressProps} props Component props.
 * @returns {JSX.Element | null} Badge.
 */
export function RoutineGroupProgress({ state, when }: RoutineGroupProgressProps) {
  const moments = state.moments.length > 1 ? state.moments.map((moment) => `${windowText(moment) || `fois ${moment.index + 1}`} : ${moment.done ? 'fait' : 'à faire'}`) : [];
  const label = [`${countOf(state.done, 'sous-routine faite', 'sous-routines faites')} sur ${countOf(state.due, 'due', 'dues')} ${when}`, ...moments].join(' · ');
  return <ProgressBadge done={state.done} total={state.due} label={label} />;
}
