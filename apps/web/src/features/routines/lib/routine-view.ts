import { ROUTINE_REPETITIONS, ROUTINE_STATES, readOpens, routineCaseOn, type RoutineCase, type RoutineGroupState } from '@ordo/shared';
import { occurrenceOpensText, opensText } from './opens-format';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import type { Routine, RoutineCategory, RoutineOccurrence } from '../api';
import { ruleOf } from './routine-format';
import * as fmt from '../../../lib/format';
import { FEEDBACK_COLORS, LATE_COLOR } from '../../../components/feedback/feedback-colors';
import type { ColumnState } from '../../../components/data-table/table/state-column';

/**
 * « Ouverture » of the rule of a routine in words (« Le 15 du mois »); null without one.
 * @param {Routine} routine Routine.
 * @returns {string | null} Words.
 */
export function opensWords(routine: Routine): string | null {
  const opens = readOpens(routine.opensOn);
  const frequency = ruleOf(routine)?.frequency;
  const words = opens && frequency ? opensText(opens, frequency) : '';
  return words ? fmt.capitalize(words) : null;
}

/**
 * When an occurrence of a routine opens, under its due day (« Ouverte 3 jours avant (le 5 nov.) »): the « Ouverture »
 * it follows (that of its case, else of its rule; inherited ones included, the routine being read as the screens read
 * it) and its first day as the API computes it; null without « Ouverture ».
 * @param {Routine} routine Routine.
 * @param {Pick<RoutineOccurrence, 'date' | 'dueDate' | 'startDate' | 'movedFrom'> & { ruleDueDate?: string }} occurrence Occurrence: the day that identifies it, its real due day, its due day by its rule (what its « Ouverture » counts from), its first day, the day of its rule it was moved from.
 * @returns {string | null} Line.
 */
export function occurrenceOpensWords(routine: Routine, occurrence: Pick<RoutineOccurrence, 'date' | 'dueDate' | 'startDate' | 'movedFrom'> & { ruleDueDate?: string }): string | null {
  const cases = (routine.cases as RoutineCase[] | null) ?? [];
  const item = cases.length ? routineCaseOn(cases, routine.startDate, occurrence.movedFrom ?? occurrence.date) : null;
  const opens = readOpens(cases.length ? item?.opens : routine.opensOn);
  const frequency = cases.length ? item?.recurrence.frequency : ruleOf(routine)?.frequency;
  return (opens && frequency && occurrenceOpensText(opens, frequency, occurrence.startDate, occurrence.ruleDueDate ?? occurrence.dueDate)) || null;
}

const ROUTINE_STATE_LOOKS: Record<(typeof ROUTINE_STATES)[number], { label: string; color: string }> = {
  late: { label: 'En retard', color: LATE_COLOR },
  // Blue, as the badge of a routine due today.
  due: { label: 'À faire', color: FEEDBACK_COLORS.info },
  upcoming: { label: 'À venir', color: 'gray' },
  done: { label: 'Faite', color: FEEDBACK_COLORS.success },
};

/** States of a routine today, in their order, with their badges (« En retard », « À faire », « À venir », « Faite »). */
export const ROUTINE_STATE_BADGES: ColumnState<(typeof ROUTINE_STATES)[number]>[] = ROUTINE_STATES.map((id) => ({ id, ...ROUTINE_STATE_LOOKS[id] }));

export const REPETITION_LABELS: Record<(typeof ROUTINE_REPETITIONS)[number], string> = {
  DAILY: 'Chaque jour',
  WEEKLY: 'Chaque semaine',
  MONTHLY: 'Chaque mois',
  YEARLY: 'Chaque année',
  SCHEDULE: 'Selon un planning',
};

/**
 * Repetition of a routine: the frequency of its rule.
 * @param {Routine} routine Routine.
 * @returns {(typeof ROUTINE_REPETITIONS)[number]} Repetition.
 */
export const routineFrequency = (routine: Routine): (typeof ROUTINE_REPETITIONS)[number] => ruleOf(routine)?.frequency ?? 'DAILY';

/** What the evaluation of the routine filters needs. */
export interface RoutineEnv {
  today: string;
  byId: Map<string, Routine>;
  categories: RoutineCategory[];
  context: TaskContext;
  /** Whether the slot rule of a routine allows now. */
  doable: (routine: Routine) => boolean;
  /** Comments by routine (its description counts as one more). Optional. */
  comments?: Map<string, number>;
  /** Calendar schedules (the « Créneaux » filter), to filter on. Optional. */
  slotKinds?: { value: string; label: string }[];
  /** People routines can be for, to filter on. Optional. */
  beneficiaries?: { value: string; label: string }[];
  /** Today's state of the parent routines present today (`routineGroupStatesOn`). Optional. Default = none. */
  groupStates?: ReadonlyMap<string, RoutineGroupState>;
}
