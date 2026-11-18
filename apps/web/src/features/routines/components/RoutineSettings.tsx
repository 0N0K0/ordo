import { Stack } from '@mantine/core';
import { countBy } from '@ordo/shared';
import { useRoutineCategoryItems } from '../hooks/use-category-items';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useRoutineMutations, useRoutinesData } from '../api';

/**
 * Settings of the routines page: the categories, as a tree.
 * @returns {JSX.Element} Settings, in the sidebar.
 */
export function RoutineSettings() {
  const { data } = useRoutinesData();
  const { moveCategory, deleteCategory } = useRoutineMutations();
  const kind = useRoutineCategoryItems();
  const categories = data?.routineCategories ?? [];
  const usage = countBy(data?.routines ?? [], (routine) => routine.categoryIds);
  return (
    <PageSettings title="Paramètres des routines">
      <Stack gap="md">
        <SettingsList
          {...kind}
          nested
          title="Catégories"
          description="Classent les routines, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
          noun="la catégorie"
          items={categories}
          usage={usage}
          usageNoun="routines"
          remove={(id) => deleteCategory.mutateAsync(id)}
          move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
        />
      </Stack>
    </PageSettings>
  );
}
