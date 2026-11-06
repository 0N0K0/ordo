/** Titles of the scope question, by action. */
const TITLES = {
  update: 'Modifier un évènement récurrent',
  delete: 'Supprimer un évènement récurrent',
  cancel: 'Annuler un évènement récurrent',
  restore: 'Rétablir un évènement récurrent',
} as const;

/**
 * Title of the scope question.
 * @param {'update' | 'delete' | 'cancel' | 'restore'} action Change, deletion, cancellation or restoration.
 * @returns {string} Title.
 */
export function scopeTitle(action: keyof typeof TITLES): string {
  return TITLES[action];
}
