import { labelFormSchema, shoppingCategorySchema } from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { listMutations, itemMutations } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { unarchived } from '../../../lib/archive';
import { useShoppingData, useShoppingMutations, type ShoppingCategory, type ShoppingStorage, type ShoppingStore, type ShoppingUnit } from '../api';
import { UNIT_COLOR } from '../lib/shopping-format';

/** Deletion of an item of a list, besides its form (the settings list deletes it). */
type WithRemove = { remove: (id: string) => Promise<unknown> };

/**
 * Stores, for their settings list and their form (a creation from a select too): name, color and image.
 * @returns {SettingsItemKind<ShoppingStore> & WithRemove} List and form, and the deletion.
 */
export function useStoreItems(): SettingsItemKind<ShoppingStore> & WithRemove {
  const { createStore, updateStore, deleteStore } = useShoppingMutations();
  return { kind: 'SHOPPING_STORE', schema: labelFormSchema, ...listMutations({ create: createStore, update: updateStore, remove: deleteStore }) };
}

/**
 * Storage modes, for their settings list and their form (a creation from a select too): name, color and image.
 * @returns {SettingsItemKind<ShoppingStorage> & WithRemove} List and form, and the deletion.
 */
export function useStorageItems(): SettingsItemKind<ShoppingStorage> & WithRemove {
  const { createStorage, updateStorage, deleteStorage } = useShoppingMutations();
  return { kind: 'SHOPPING_STORAGE', schema: labelFormSchema, ...listMutations({ create: createStorage, update: updateStorage, remove: deleteStorage }) };
}

/**
 * Units, for their settings list and their form (a creation from a select too): a name and an image, no color.
 * @returns {SettingsItemKind<ShoppingUnit> & WithRemove} List and form, and the deletion.
 */
export function useUnitItems(): SettingsItemKind<ShoppingUnit> & WithRemove {
  const { createUnit, updateUnit, deleteUnit } = useShoppingMutations();
  return {
    kind: 'SHOPPING_UNIT',
    withColor: false,
    schema: labelFormSchema.pick({ name: true }),
    ...listMutations({ create: createUnit, update: updateUnit, remove: deleteUnit }, (values) => ({ name: values.name, color: UNIT_COLOR })),
  };
}

/**
 * Categories of the products, for their settings list and their form (a creation from a select too): name, color (the
 * one of its parent by default), image, parent and the base lists it is offered in.
 * @returns {SettingsItemKind<ShoppingCategory, { baseListIds: string[] }>} List and form.
 */
export function useShoppingCategoryItems(): SettingsItemKind<ShoppingCategory, { baseListIds: string[] }> {
  const { createCategory, updateCategory } = useShoppingMutations();
  const { data } = useShoppingData();
  const baseLists = data?.shoppingBaseLists ?? [];
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null, baseListIds: string[] }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null; baseListIds: string[] }) => ({ ...values, color: values.color || null });
  return {
    kind: 'SHOPPING_CATEGORY',
    schema: shoppingCategorySchema,
    extra: {
      initial: (category) => ({ baseListIds: category?.baseListIds ?? [] }),
      render: (form) => (
        <BatchMultiSelect
          label="Références"
          description="Celles où elle est proposée. Aucune : toutes (une sous-catégorie sans liste prend celles de sa catégorie parente)."
          placeholder={form.getValues().baseListIds.length ? undefined : 'Toutes'}
          data={unarchived(baseLists, form.getValues().baseListIds).map((baseList) => ({ value: baseList.id, label: baseList.name }))}
          clearable
          {...form.getInputProps('baseListIds')}
        />
      ),
    },
    ...itemMutations({ create: createCategory, update: updateCategory }, input),
  };
}
