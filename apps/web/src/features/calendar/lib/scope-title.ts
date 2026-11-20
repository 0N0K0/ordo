/** Titles of the scope question, by action. */
const TITLES = {
  update: 'Modifier un évènement récurrent',
  delete: 'Supprimer un évènement récurrent',
  cancel: 'Annuler un évènement récurrent',
  restore: 'Rétablir un évènement récurrent',
  cancelOrDelete: 'Annuler ou supprimer une occurrence',
} as const;

/**
 * Title of the scope question.
 * @param {'update' | 'delete' | 'cancel' | 'restore' | 'cancelOrDelete'} action Change, deletion, cancellation, restoration,
 * or cancellation of one occurrence / deletion of it and the following ones.
 * @returns {string} Title.
 */
export function scopeTitle(action: keyof typeof TITLES): string {
  return TITLES[action];
}
