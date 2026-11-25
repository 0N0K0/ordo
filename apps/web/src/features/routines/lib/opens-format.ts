import { LAST_DAY, lastDayWords, MONTH_LABELS, ofMonth, opensFits, ordinal, POSITION_LABELS, WEEKDAY_LABELS, type Recurrence, type RoutineOpens } from '@ordo/shared';
import * as fmt from '../../../lib/format';

/**
 * « Ouverture » in words, without « dès »: « le 15 du mois », « le 15 mars », « le dernier jour du mois », « le dernier jour
 * de mars », « le 2e mardi du mois », « le lundi
 * de la semaine 12 », « 3 jours avant l’échéance ».
 * @param {RoutineOpens} opens « Ouverture ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @param {{ ofDue?: boolean }} [options] Options. Optional.
 * @param {boolean} [options.ofDue=true] Days before followed by « de l’échéance » (false: « la veille », « 3 jours avant », under the due day). Optional. Default = true.
 * @returns {string} Words (empty when it does not fit the frequency).
 */
export function opensText(opens: RoutineOpens, frequency: Recurrence['frequency'], { ofDue = true }: { ofDue?: boolean } = {}): string {
  if (!opensFits(opens, frequency)) return '';
  switch (opens.mode) {
    case 'BEFORE':
      return `${opens.days === 1 ? 'la veille' : `${opens.days} jours avant`}${ofDue ? (opens.days === 1 ? ' de l’échéance' : ' l’échéance') : ''}`;
    case 'DAY':
      if (opens.day === LAST_DAY) return `le ${lastDayWords(opens.month)}`;
      return opens.month ? `le ${ordinal(opens.day)} ${MONTH_LABELS[opens.month - 1]}` : `le ${ordinal(opens.day)} du mois`;
    case 'WEEKDAY':
      return `le ${POSITION_LABELS[opens.position]} ${WEEKDAY_LABELS[opens.weekday - 1]} ${opens.month ? ofMonth(opens.month) : 'du mois'}`;
    case 'WEEK':
      return frequency === 'YEARLY' ? `le ${WEEKDAY_LABELS[opens.weekday - 1]} de la semaine ${opens.week}` : `le ${WEEKDAY_LABELS[opens.weekday - 1]} de la ${ordinal(opens.week)} semaine du mois`;
  }
}

/**
 * When an occurrence opens, under its due day, in the words of its « Ouverture »: « Ouverte 3 jours avant (le 5 nov.) »,
 * « Ouverte dès la veille (le 4 nov.) », « Ouverte dès le 15 du mois (le 15 oct.) », « Ouverte le jour même » (its
 * first day is its due day).
 * @param {RoutineOpens} opens « Ouverture » it follows.
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @param {string} open Its first day, as the API computes it (YYYY-MM-DD).
 * @param {string} due Its due day (YYYY-MM-DD).
 * @returns {string} Line (empty when the « Ouverture » does not fit the frequency).
 */
export function occurrenceOpensText(opens: RoutineOpens, frequency: Recurrence['frequency'], open: string, due: string): string {
  const words = opensText(opens, frequency, { ofDue: false });
  if (!words) return '';
  if (open >= due) return 'Ouverte le jour même';
  return `Ouverte ${opens.mode === 'BEFORE' && opens.days > 1 ? '' : 'dès '}${words} (le ${fmt.dayShort(open)})`;
}
