import { countOf, plural } from '@ordo/shared';
// eslint-disable-next-line no-restricted-imports -- the one path of collator and normalize in the app.
export { collator, copyName, countOf, countWith, ellipsis, fitName, nameKey, normalize, plural, sameName } from '@ordo/shared';

/**
 * End of the message of a change of project that removed links (they left the project tree): " 2 liens retirés."
 * (nothing without any). Tasks transferred and routines moved alike.
 * @param {number} count Links removed.
 * @returns {string} Note.
 */
export function removedLinksNote(count: number): string {
  return count > 0 ? ` ${countOf(count, 'lien')} ${plural(count, 'retiré')}.` : '';
}
