/**
 * Rows selected, told: "3 lignes sélectionnées", "1 fiche sélectionnée".
 * @param {number} count Count.
 * @param {[string, string]} [names] Singular and plural name. Optional. Default = lignes.
 * @param {boolean} [feminine] Feminine name. Optional. Default = true.
 * @returns {string} Text.
 */
export const selectedLabel = (count: number, [one, many]: [string, string] = ['ligne', 'lignes'], feminine = true) =>
  `${count} ${count > 1 ? many : one} sélectionné${feminine ? 'e' : ''}${count > 1 ? 's' : ''}`;
