import { ROUTINE_REPETITIONS, ROUTINE_STATES, readOpens } from '@ordo/shared';
import { opensText } from './opens-format';
import type { TaskContext } from '../tasks/use-task-context';
import type { Routine, RoutineCategory } from './api';
import { ruleOf } from './routine-format';
import * as fmt from '../../lib/format';

/**
 * « À partir du » of the rule of a routine in words (« Le 15 du mois »); null without one.
 * @param {Routine} routine Routine.
 * @returns {string | null} Words.
 */
export function opensWords(routine: Routine): string | null {
  const opens = readOpens(routine.opensOn);
  const frequency = ruleOf(routine)?.frequency;
  const words = opens && frequency ? opensText(opens, frequency) : '';
  return words ? fmt.capitalize(words) : null;
}

export const ROUTINE_STATE_LABELS: Record<(typeof ROUTINE_STATES)[number], string> = { late: 'En retard', due: 'À faire', upcoming: 'À venir', done: 'Faite' };

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
export const repetitionOf = (routine: Routine): (typeof ROUTINE_REPETITIONS)[number] => ruleOf(routine)?.frequency ?? 'DAILY';

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
  /** Kinds of slots, to filter on. Optional. */
  /** Calendar schedules (the « Plages » filter). */
  slotKinds?: { value: string; label: string }[];
  /** People routines can be for, to filter on. Optional. */
  beneficiaries?: { value: string; label: string }[];
}
