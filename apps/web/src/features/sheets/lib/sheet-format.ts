import type { SheetInput, SheetItemInput } from '@ordo/shared';
import { idsOfKind } from '../../../components/people/people-keys';

/**
 * Input of a sheet as it is, with some fields changed.
 * @param {{ label: string, note?: string | null, projectId?: string | null, categoryIds: string[] }} sheet Sheet.
 * @param {Partial<SheetInput>} change Changed fields.
 * @returns {SheetInput} Input.
 */
export const sheetInput = (sheet: { label: string; note?: string | null; projectId?: string | null; categoryIds: string[] }, change: Partial<SheetInput>): SheetInput => ({
  label: sheet.label,
  note: sheet.note ?? null,
  projectId: sheet.projectId ?? null,
  categoryIds: sheet.categoryIds,
  ...change,
});

/**
 * Input of an item of a sheet as it is, with some fields changed.
 * @param {SheetItemValues} item Item.
 * @param {Partial<SheetItemInput>} change Changed fields.
 * @returns {SheetItemInput} Input.
 */
export const sheetItemInput = (
  item: {
    productId?: string | null;
    label: string;
    categoryId?: string | null;
    quantity?: number | null;
    unit?: string | null;
    note?: string | null;
    consumable: boolean;
    storeId?: string | null;
    url?: string | null;
    perishable?: boolean;
    storageId?: string | null;
    memberIds?: string[];
    relationIds?: string[];
    optional?: boolean;
  },
  change: Partial<SheetItemInput>,
): SheetItemInput => ({
  productId: item.productId ?? null,
  label: item.label,
  categoryId: item.categoryId ?? null,
  quantity: item.quantity ?? null,
  unit: item.unit ?? null,
  note: item.note ?? null,
  consumable: item.consumable,
  storeId: item.storeId ?? null,
  url: item.url ?? null,
  perishable: item.perishable ?? false,
  storageId: item.storageId ?? null,
  memberIds: item.memberIds ?? [],
  relationIds: item.relationIds ?? [],
  optional: item.optional ?? false,
  ...change,
});

/**
 * Fields of an item added in a group of a sheet or checklist table: the value of the group (its category, unit, store…),
 * none for the group without value; null when an item cannot be given it (a reference, done, a quantity…), so no add
 * row in it.
 * @param {string} columnId Column the table is grouped by.
 * @param {string} key Key of the group ('' for the one without value).
 * @returns {Partial<SheetItemInput> | null} Fields, null when nothing can be added in it.
 */
export function itemGroupFields(columnId: string, key: string): Partial<SheetItemInput> | null {
  const yes = key === 'yes';
  switch (columnId) {
    case 'category':
      return { categoryId: key || null };
    case 'unit':
      return { unit: key || null };
    case 'store':
      return { storeId: key || null };
    case 'consumable':
      return { consumable: yes };
    case 'optional':
      return { optional: yes };
    case 'conservation':
      if (key === 'no') return { perishable: false, storageId: null };
      return key === 'yes' ? { perishable: true, storageId: null } : { perishable: true, storageId: key };
    case 'people':
      return { memberIds: idsOfKind(key ? [key] : [], 'member'), relationIds: idsOfKind(key ? [key] : [], 'relation') };
    // A new item has no reference, is not done, has no source sheet.
    case 'product':
    case 'done':
      return yes ? null : {};
    default:
      return key ? null : {};
  }
}
