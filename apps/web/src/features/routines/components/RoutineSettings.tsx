import { Stack } from '@mantine/core';
import { countBy } from '@ordo/shared';
import { useRoutineCategoryItems } from '../hooks/use-category-items';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PriorityTypeSettings } from '../../tasks/components/PriorityTypeSettings';
import { useRoutineMutations, useRoutinesData } from '../api';

/**
 * Settings of the routines: their categories, as a tree, then the priorities and the types (shared with the tasks).
 * In the settings of the routines page and in the routines tab of a project.
 * @returns {JSX.Element} Settings.
 */
export function RoutineSettings() {
  const { data } = useRoutinesData();
  const { moveCategory, deleteCategory } = useRoutineMutations();
  const kind = useRoutineCategoryItems();
  const categories = data?.routineCategories ?? [];
  const usage = countBy(data?.routines ?? [], (routine) => routine.categoryIds);
  return (
    <Stack gap="md">
      <SettingsList
        {...kind}
        nested
        title="Catégories"
        description="Classent les routines, en arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
        noun="la catégorie"
        feminine
        items={categories}
        usage={usage}
        usageNoun={{ one: 'de la routine', many: 'routines' }}
        remove={(id) => deleteCategory.mutateAsync(id)}
        move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
      />
      <PriorityTypeSettings />
    </Stack>
  );
}
