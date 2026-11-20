import { MONTH_LABELS, ofMonth, opensFits, ordinal, POSITION_LABELS, WEEKDAY_LABELS, type Recurrence, type RoutineOpens } from '@ordo/shared';

/**
 * « Ouverture » in words, without « dès »: « le 15 du mois », « le 15 mars », « le 2e mardi du mois », « le lundi
 * de la semaine 12 », « 3 jours avant l’échéance ».
 * @param {RoutineOpens} opens « Ouverture ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {string} Words (empty when it does not fit the frequency).
 */
export function opensText(opens: RoutineOpens, frequency: Recurrence['frequency']): string {
  if (!opensFits(opens, frequency)) return '';
  switch (opens.mode) {
    case 'BEFORE':
      return opens.days === 1 ? 'la veille de l’échéance' : `${opens.days} jours avant l’échéance`;
    case 'DAY':
      return opens.month ? `le ${ordinal(opens.day)} ${MONTH_LABELS[opens.month - 1]}` : `le ${ordinal(opens.day)} du mois`;
    case 'WEEKDAY':
      return `le ${POSITION_LABELS[opens.position]} ${WEEKDAY_LABELS[opens.weekday - 1]} ${opens.month ? ofMonth(opens.month) : 'du mois'}`;
    case 'WEEK':
      return frequency === 'YEARLY' ? `le ${WEEKDAY_LABELS[opens.weekday - 1]} de la semaine ${opens.week}` : `le ${WEEKDAY_LABELS[opens.weekday - 1]} de la ${ordinal(opens.week)} semaine du mois`;
  }
}
