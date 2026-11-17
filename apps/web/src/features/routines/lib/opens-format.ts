import { MONTHS, ofMonth, WEEKDAY_NAMES } from '../../../components/recurrence/describe-recurrence';

export { WEEKDAY_NAMES };
import { opensFits, type Recurrence, type RoutineOpens } from '@ordo/shared';

export const MONTH_NAMES = MONTHS;
export const POSITION_NAMES: Record<number, string> = { 1: 'premier', 2: 'deuxième', 3: 'troisième', 4: 'quatrième', [-1]: 'dernier' };

/**
 * Ordinal of a number in French (« 1er », « 3e »).
 * @param {number} value Number.
 * @returns {string} Ordinal.
 */
const ordinal = (value: number) => (value === 1 ? '1er' : `${value}e`);

/**
 * « À partir du » in words, without « dès »: « le 15 du mois », « le 15 mars », « le deuxième mardi du mois », « le lundi
 * de la semaine 12 », « 3 jours avant l’échéance ».
 * @param {RoutineOpens} opens « À partir du ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {string} Words (empty when it does not fit the frequency).
 */
export function opensText(opens: RoutineOpens, frequency: Recurrence['frequency']): string {
  if (!opensFits(opens, frequency)) return '';
  switch (opens.mode) {
    case 'BEFORE':
      return opens.days === 1 ? 'la veille de l’échéance' : `${opens.days} jours avant l’échéance`;
    case 'DAY':
      return opens.month ? `le ${ordinal(opens.day)} ${MONTH_NAMES[opens.month - 1]}` : `le ${ordinal(opens.day)} du mois`;
    case 'WEEKDAY':
      return `le ${POSITION_NAMES[opens.position]} ${WEEKDAY_NAMES[opens.weekday - 1]} ${opens.month ? ofMonth(opens.month) : 'du mois'}`;
    case 'WEEK':
      return frequency === 'YEARLY' ? `le ${WEEKDAY_NAMES[opens.weekday - 1]} de la semaine ${opens.week}` : `le ${WEEKDAY_NAMES[opens.weekday - 1]} de la ${ordinal(opens.week)} semaine du mois`;
  }
}
