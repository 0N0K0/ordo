import { Stack } from '@mantine/core';
import { routineCategorySchema } from '@ordo/shared';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useRoutineMutations, useRoutinesData } from '../api';

/**
 * Settings of the routines page: the categories, as a tree.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function RoutineSettings() {
  const { data } = useRoutinesData();
  const { createCategory, updateCategory, moveCategory, deleteCategory } = useRoutineMutations();
  const categories = data?.routineCategories ?? [];
  const usage = new Map<string, number>();
  for (const routine of data?.routines ?? []) for (const id of routine.categoryIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color || null, parentId: values.parentId });
  return (
    <PageSettings title="Paramètres des routines">
      <Stack gap="md">
        <SettingsList
          kind="ROUTINE_CATEGORY"
          nested
          title="Catégories"
          description="Classent les routines, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
          noun="la catégorie"
          items={categories}
          usage={usage}
          usageNoun="routines"
          schema={routineCategorySchema}
          create={async (values) => createdId(await createCategory.mutateAsync(input(values)))}
          update={(id, values) => updateCategory.mutateAsync({ id, input: input(values) })}
          remove={(id) => deleteCategory.mutateAsync(id)}
          move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
        />
      </Stack>
    </PageSettings>
  );
}
