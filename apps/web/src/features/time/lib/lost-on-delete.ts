import { countOf, plural } from '../../../lib/text';
import type { CalendarEventScope } from '../../calendar/api';
import type { LostOnDelete } from '../api';

/**
 * Sentences telling what a deletion takes with it: times without project left with nothing attached (extra A of
 * decision D17) and comments of what is deleted (decision D19).
 * @param {LostOnDelete} lost Numbers.
 * @returns {string} Sentences (empty without any).
 */
export function lostOnDeleteText({ times, comments }: LostOnDelete): string {
  return [
    times
      ? `${times} temps sans projet, qui ne ${plural(times, 'porte', 'portent')} sur rien d’autre, ${plural(times, 'sera', 'seront')} aussi ${plural(times, 'supprimé')} (les temps facturés sont gardés).`
      : '',
    comments ? `${countOf(comments, 'commentaire')} ${plural(comments, 'sera', 'seront')} aussi ${plural(comments, 'supprimé')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Choices of the scope question, as named in its note. */
const SCOPE_NAMES: Record<CalendarEventScope, string> = { THIS: 'cette occurrence', FOLLOWING: 'celle-ci et les suivantes', ALL: 'toutes' };

/**
 * Note of the scope question of a deletion: what each choice takes with it (times, comments); none when nothing.
 * @param {Partial<Record<CalendarEventScope, LostOnDelete>>} lost Numbers by choice offered.
 * @returns {string | undefined} Note.
 */
export function scopeLostNote(lost: Partial<Record<CalendarEventScope, LostOnDelete>>): string | undefined {
  const choices = (Object.keys(SCOPE_NAMES) as CalendarEventScope[]).filter((scope) => lost[scope]);
  /**
   * Part of the note for one kind of thing deleted.
   * @param {keyof LostOnDelete} kind Times or comments.
   * @param {string} label Its heading.
   * @param {string} [after] Text after the numbers. Optional.
   * @returns {string} Part (empty when none).
   */
  const part = (kind: keyof LostOnDelete, label: string, after = '') =>
    choices.some((scope) => lost[scope]![kind]) ? `${label} : ${choices.map((scope) => `${SCOPE_NAMES[scope]} ${lost[scope]![kind]}`).join(', ')}${after}.` : '';
  const note = [part('times', 'Temps sans projet supprimés avec', ' (les temps facturés sont gardés)'), part('comments', 'Commentaires supprimés avec')].filter(Boolean).join(' ');
  return note || undefined;
}
