import { Stack } from '@mantine/core';
import { countBy } from '@ordo/shared';
import { useMemo } from 'react';
import { useRoutineCategoryItems } from '../hooks/use-category-items';
import { SettingsList } from '../../../components/settings/SettingsList';
import { PriorityTypeSettings } from '../../tasks/components/PriorityTypeSettings';
import { useRoutineMutations, useRoutinesData } from '../api';
import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { parisToday } from '../../../lib/dates';
import { useRoutineColumns } from '../hooks/use-routine-columns';

/**
 * Settings of the routines: their categories, as a tree, then the priorities and the types (shared with the tasks),
 * then the columns of new views of their table.
 * In the settings of the routines page and in the routines tab of a project.
 * @returns {JSX.Element} Settings.
 */
export function RoutineSettings() {
  const { data } = useRoutinesData();
  const { moveCategory, deleteCategory } = useRoutineMutations();
  const kind = useRoutineCategoryItems();
  const routines = useMemo(() => data?.routines ?? [], [data]);
  const categories = useMemo(() => data?.routineCategories ?? [], [data]);
  const usage = countBy(routines, (routine) => routine.categoryIds);
  const { columns } = useRoutineColumns(routines, categories, parisToday());
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
      {/* Last: the columns of new views (a long list). */}
      <ColumnDefaults tableKey="routines" columns={columns} />
    </Stack>
  );
}
