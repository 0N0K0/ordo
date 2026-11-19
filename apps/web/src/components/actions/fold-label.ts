/**
 * Action of a fold toggle, the same everywhere (decision AE): « Réduire » when unfolded, « Développer » otherwise.
 * @param {boolean} expanded Unfolded.
 * @returns {string} Action.
 */
// eslint-disable-next-line no-restricted-syntax -- foldAction itself.
export const foldAction = (expanded: boolean): string => (expanded ? 'Réduire' : 'Développer');

/**
 * Hidden label of a fold toggle whose element is not a name: « Réduire les lots de « X » ».
 * @param {boolean} expanded Unfolded.
 * @param {string} about What folds, with its determiner (« les sous-éléments »).
 * @returns {string} Label.
 */
export const foldLabel = (expanded: boolean, about: string): string => `${foldAction(expanded)} ${about}`;
