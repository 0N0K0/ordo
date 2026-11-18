import { prisma } from '../../db';
import { clientError } from '../../graphql/errors';
import { ARCHIVED_MESSAGE, assertNotArchived } from '../core/archive';

/** Settings items and reference a product, an item of a list or of a sheet, or a stock item points to. */
export interface ShoppingRefs {
  categoryId?: string | null;
  storeId?: string | null;
  storageId?: string | null;
  locationId?: string | null;
  productId?: string | null;
  /** Unit, by its name. */
  unit?: string | null;
}

/**
 * Refuses the archived settings items (and reference) newly given to an element: those it has already stay valid.
 * @param {ShoppingRefs} next Values given.
 * @param {ShoppingRefs | null} [current] Values it has now. Optional. Default = none (a new element).
 * @returns {Promise<void>}
 */
export async function assertActiveRefs(next: ShoppingRefs, current?: ShoppingRefs | null): Promise<void> {
  /**
   * Value given that the element does not have yet.
   * @param {keyof ShoppingRefs} key Field.
   * @returns {string | null} New value, or null.
   */
  const added = (key: keyof ShoppingRefs): string | null => {
    const value = next[key];
    return value && value !== current?.[key] ? value : null;
  };
  await assertNotArchived('SHOPPING_CATEGORY', added('categoryId'));
  await assertNotArchived('SHOPPING_STORE', added('storeId'));
  await assertNotArchived('SHOPPING_STORAGE', added('storageId'));
  await assertNotArchived('STOCK_LOCATION', added('locationId'));
  await assertNotArchived('SHOPPING_PRODUCT', added('productId'));
  const unit = added('unit');
  if (unit && (await prisma.shoppingUnit.count({ where: { name: unit, archivedAt: { not: null } } }))) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
}
