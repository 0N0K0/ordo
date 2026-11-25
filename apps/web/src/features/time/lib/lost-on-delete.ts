import { countOf, plural } from '../../../lib/text';
import type { CalendarEventScope } from '../../calendar/api';
import type { LostOnDelete } from '../api';

/**
 * Sentences telling what a deletion takes with it: times without project left with nothing attached, comments,
 * checklists started and links between routines and events of what is deleted.
 * @param {LostOnDelete} lost Numbers (checklists and links: none when not given).
 * @returns {string} Sentences (empty without any).
 */
export function lostOnDeleteText({ times, comments, checklists = 0, links = 0 }: Pick<LostOnDelete, 'times' | 'comments'> & Partial<LostOnDelete>): string {
  return [
    times
      ? `${times} temps sans projet, qui ne ${plural(times, 'porte', 'portent')} sur rien d’autre, ${plural(times, 'sera', 'seront')} aussi ${plural(times, 'supprimé')} (les temps facturés sont gardés).`
      : '',
    comments ? `${countOf(comments, 'commentaire')} ${plural(comments, 'sera', 'seront')} aussi ${plural(comments, 'supprimé')}.` : '',
    checklists ? `${countOf(checklists, 'liste à cocher commencée', 'listes à cocher commencées')} ${plural(checklists, 'sera', 'seront')} aussi ${plural(checklists, 'supprimée')}.` : '',
    links ? `${countOf(links, 'lien entre routine et évènement', 'liens entre routines et évènements')} ${plural(links, 'sera', 'seront')} aussi ${plural(links, 'supprimé')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Choices of the scope question, as named in its note. */
const SCOPE_NAMES: Record<CalendarEventScope, string> = { THIS: 'cette occurrence', FOLLOWING: 'celle-ci et les suivantes', ALL: 'toutes' };

/**
 * Note of the scope question of a deletion: what each choice takes with it (times, comments, checklists started,
 * links between routines and events); none when nothing.
 * @param {Partial<Record<CalendarEventScope, LostOnDelete>>} lost Numbers by choice offered.
 * @returns {string | undefined} Note.
 */
export function scopeLostNote(lost: Partial<Record<CalendarEventScope, LostOnDelete>>): string | undefined {
  const choices = (Object.keys(SCOPE_NAMES) as CalendarEventScope[]).filter((scope) => lost[scope]);
  /**
   * Part of the note for one kind of thing deleted.
   * @param {keyof LostOnDelete} kind Times, comments, checklists or links.
   * @param {string} label Its heading.
   * @param {string} [after] Text after the numbers. Optional.
   * @returns {string} Part (empty when none).
   */
  const part = (kind: keyof LostOnDelete, label: string, after = '') =>
    choices.some((scope) => lost[scope]![kind]) ? `${label} : ${choices.map((scope) => `${SCOPE_NAMES[scope]} ${lost[scope]![kind]}`).join(', ')}${after}.` : '';
  const note = [
    part('times', 'Temps sans projet supprimés avec', ' (les temps facturés sont gardés)'),
    part('comments', 'Commentaires supprimés avec'),
    part('checklists', 'Listes à cocher commencées supprimées avec'),
    part('links', 'Liens entre routines et évènements supprimés avec'),
  ]
    .filter(Boolean)
    .join(' ');
  return note || undefined;
}
