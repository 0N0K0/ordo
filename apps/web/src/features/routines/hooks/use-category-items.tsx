import { routineCategorySchema } from '@ordo/shared';
import { createdId } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { useRoutineMutations, type RoutineCategory } from '../api';

/**
 * Input of a category from the form values.
 * @param {{ name: string, color: string, parentId: string | null }} values Values.
 * @returns {{ name: string, color: string | null, parentId: string | null }} Input.
 */
const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color || null, parentId: values.parentId });

/**
 * Categories of the routines, for their settings list and their form (a creation from a select too): name, color (the
 * one of its parent by default), image and parent.
 * @returns {SettingsItemKind<RoutineCategory>} List and form.
 */
export function useRoutineCategoryItems(): SettingsItemKind<RoutineCategory> {
  const { createCategory, updateCategory } = useRoutineMutations();
  return {
    kind: 'ROUTINE_CATEGORY',
    schema: routineCategorySchema,
    create: async (values) => createdId(await createCategory.mutateAsync(input(values))),
    update: (id, values) => updateCategory.mutateAsync({ id, input: input(values) }),
  };
}
