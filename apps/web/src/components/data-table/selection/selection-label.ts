import { countOf } from '../../../lib/text';
import { agreed } from '@ordo/shared';

/**
 * Rows selected, told: "3 lignes sélectionnées", "1 fiche sélectionnée".
 * @param {number} count Count.
 * @param {[string, string]} [names] Singular and plural name. Optional. Default = lignes.
 * @param {boolean} [feminine] Feminine name. Optional. Default = true.
 * @returns {string} Text.
 */
export const selectedLabel = (count: number, [one, many]: [string, string] = ['ligne', 'lignes'], feminine = true) => `${countOf(count, one, many)} ${agreed('sélectionné', feminine, count)}`;
