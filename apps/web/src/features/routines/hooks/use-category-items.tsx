import { routineCategorySchema } from '@ordo/shared';
import { itemMutations, treeItemInput } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { useRoutineMutations, type RoutineCategory } from '../api';

/**
 * Categories of the routines, for their settings list and their form (a creation from a select too): label, color (the
 * one of its parent by default), image and parent.
 * @returns {SettingsItemKind<RoutineCategory>} List and form.
 */
export function useRoutineCategoryItems(): SettingsItemKind<RoutineCategory> {
  const { createCategory, updateCategory } = useRoutineMutations();
  return {
    kind: 'ROUTINE_CATEGORY',
    schema: routineCategorySchema,
    ...itemMutations({ create: createCategory, update: updateCategory }, treeItemInput),
  };
}
