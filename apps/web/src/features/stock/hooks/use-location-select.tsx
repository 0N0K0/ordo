import { stockLocationSchema } from '@ordo/shared';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { itemMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { categoryOptions } from '../../../components/tree/category-tree';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { useStockLocations, useStockMutations, type StockLocation } from '../api';

/**
 * Places of the stock, for their settings list and their form (a quick creation from a select): name, color, image
 * and parent.
 * @returns {SettingsItemKind<StockLocation>} List and form.
 */
export function useLocationItems(): SettingsItemKind<StockLocation> {
  const { createLocation, updateLocation } = useStockMutations();
  /**
   * Input of a place from the form values.
   * @param {{ label: string, color: string, parentId: string | null }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { label: string; color: string; parentId: string | null }) => ({ label: values.label, color: values.color || null, parentId: values.parentId });
  return {
    kind: 'STOCK_LOCATION',
    schema: stockLocationSchema,
    ...itemMutations({ create: createLocation, update: updateLocation }, input),
  };
}

/**
 * Options of a select of a place of the stock: the tree of the places not archived (the current one kept).
 * @param {readonly StockLocation[]} locations Places.
 * @param {string | null} keep Current place, kept when archived.
 * @returns {object} Select props (data, tree look).
 */
export const locationSelectProps = (locations: readonly StockLocation[], keep: string | null) => treeSelectProps(categoryOptions(locations, undefined, unarchivedOffered(locations, keep)));

/**
 * Props of a `CreatableSelect` of a place of the stock: its options (the current place kept), and the creation of a
 * place named as typed (its settings form, its parent among the places).
 * @returns {(keep: string | null) => object} Select props, given the current place.
 */
export function useLocationSelect() {
  const { data: locations } = useStockLocations();
  const items = useLocationItems();
  const onCreate = itemCreator('Nouvel emplacement', items, { tree: unarchived(locations ?? []) });
  return (keep: string | null) => ({ ...locationSelectProps(locations ?? [], keep), onCreate });
}
