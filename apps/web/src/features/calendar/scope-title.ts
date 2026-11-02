/**
 * Title of the scope question.
 * @param {'update' | 'delete'} action Change or deletion.
 * @returns {string} Title.
 */
export function scopeTitle(action: 'update' | 'delete'): string {
  return action === 'delete' ? 'Supprimer un évènement récurrent' : 'Modifier un évènement récurrent';
}
