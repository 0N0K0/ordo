/** Conservation of a product, item or sheet item: whether it is perishable, and its way of keeping. */
export interface Conservation {
  perishable: boolean;
  storageId: string | null;
}

/** Key of a row that is not perishable (filters, grouping, conservation cell). */
export const NOT_PERISHABLE = 'no';
/** Key of a perishable row without a way of keeping. */
export const PERISHABLE = 'yes';

/**
 * Key of a conservation: not perishable, perishable without a way of keeping, or the id of its way of keeping.
 * @param {{ perishable: boolean, storageId?: string | null }} item Row.
 * @returns {string} Key.
 */
// eslint-disable-next-line no-restricted-syntax -- conservationKey itself.
export const conservationKey = (item: { perishable: boolean; storageId?: string | null }): string => (item.perishable ? (item.storageId ?? PERISHABLE) : NOT_PERISHABLE);

/**
 * Conservation of a key made by `conservationKey`.
 * @param {string} key Key.
 * @returns {Conservation} Conservation.
 */
export function conservationOf(key: string): Conservation {
  if (key === NOT_PERISHABLE) return { perishable: false, storageId: null };
  return { perishable: true, storageId: key === PERISHABLE ? null : key };
}
