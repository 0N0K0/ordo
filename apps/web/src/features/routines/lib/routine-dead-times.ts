import { routinesRingPage } from '@ordo/shared';
import type { DeadTimeItem } from '../../countdowns/lib/countdowns';
import type { Routine } from '../api';

/**
 * A routine (its occurrence) as the timers of its dead times keep it: its ring links to the routines.
 * @param {Pick<Routine, 'id' | 'label'>} routine Routine.
 * @param {string | null} occurrenceDate Occurrence (its current one, the one open in its panel).
 * @returns {DeadTimeItem} Item.
 */
export const routineDeadTimeItem = (routine: Pick<Routine, 'id' | 'label'>, occurrenceDate: string | null): DeadTimeItem => {
  const page = routinesRingPage();
  return { routineId: routine.id, occurrenceDate, subject: routine.label, path: page.path, linkLabel: page.label };
};
