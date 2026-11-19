import { countOf, plural } from '@ordo/shared';

/** What a synchronisation with GitHub exchanged (a missing count: none). */
export type SyncSummary = Partial<Record<'pulledNew' | 'pushedNew' | 'pulled' | 'pushed' | 'unlinked' | 'sprints' | 'sprintsSkipped' | 'renumbered' | 'comments', number>>;

/**
 * What a synchronisation with GitHub exchanged, in words, the same in its toast and under the link.
 * @param {SyncSummary} summary Counts.
 * @returns {string} « 2 tâches créées depuis GitHub, 1 item créé sur GitHub, … 3 commentaires échangés ».
 */
export function syncSummaryText(summary: SyncSummary): string {
  const { pulledNew = 0, pushedNew = 0, pulled = 0, pushed = 0, unlinked = 0, sprints = 0, sprintsSkipped = 0, renumbered = 0, comments = 0 } = summary;
  return [
    `${countOf(pulledNew, 'tâche')} ${plural(pulledNew, 'créée')} depuis GitHub`,
    `${countOf(pushedNew, 'item')} ${plural(pushedNew, 'créé')} sur GitHub`,
    `${countOf(pulled, 'tâche')} et ${countOf(pushed, 'item')} mis à jour`,
    `${countOf(unlinked, 'tâche')} ${plural(unlinked, 'déliée')}`,
    `${countOf(sprints, 'sprint')} ${plural(sprints, 'créé')} ou mis à jour`,
    // eslint-disable-next-line no-restricted-syntax -- syncSummaryText itself.
    `${countOf(renumbered, 'tâche')} ${plural(renumbered, 'renumérotée')}`,
    ...(sprintsSkipped ? [`${countOf(sprintsSkipped, 'sprint')} sans itération (à créer dans GitHub)`] : []),
    `${countOf(comments, 'commentaire')} ${plural(comments, 'échangé')}`,
  ].join(', ');
}
