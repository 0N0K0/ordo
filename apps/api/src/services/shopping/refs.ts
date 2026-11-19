import { prisma } from '../../db';
import { archivedError, assertNotArchived } from '../core/archive';

/** Settings items and reference a product, an item of a list or of a sheet, or a stock item points to. */
export interface ShoppingRefs {
  categoryId?: string | null;
  storeId?: string | null;
  storageId?: string | null;
  locationId?: string | null;
  productId?: string | null;
  /** Unit, by its label. */
  unit?: string | null;
}

/**
 * Refuses the archived settings items (and reference) newly given to an element: those it has already stay valid.
 * @param {ShoppingRefs} next Values given.
 * @param {ShoppingRefs | null} [current] Values it has now. Optional. Default = none (a new element).
 * @returns {Promise<void>}
 */
export async function assertActiveRefs(next: ShoppingRefs, current?: ShoppingRefs | null): Promise<void> {
  for (const [kind, key] of [
    ['SHOPPING_CATEGORY', 'categoryId'],
    ['SHOPPING_STORE', 'storeId'],
    ['SHOPPING_STORAGE', 'storageId'],
    ['STOCK_LOCATION', 'locationId'],
    ['SHOPPING_PRODUCT', 'productId'],
  ] as const)
    await assertNotArchived(kind, next[key], { keep: current?.[key], field: key });
  const unit = next.unit && next.unit !== current?.unit ? next.unit : null;
  if (unit && (await prisma.shoppingUnit.count({ where: { label: unit, archivedAt: { not: null } } }))) throw archivedError('unit');
}
