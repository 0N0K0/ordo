import { Button, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { DataColumnsPanel } from '../../../components/data-table/toolbar/ColumnsPanel';
import { localToday } from '../../../lib/dates';
import { ON_ERROR } from '../../../lib/notify';
import { useSetTaskColumnDefaults, useTaskColumnDefaults } from '../api';
import { useTaskColumns } from '../hooks/use-task-columns';
import { useTaskContext } from '../hooks/use-task-context';
import { SettingsSection } from '../../../components/settings/SettingsSection';

/**
 * Columns new task views of the workspace start with: those shown and their order, by drag and drop, in the panel of
 * the columns of every table; the views already made keep theirs.
 * @returns {JSX.Element} Section.
 */
export function ColumnDefaults() {
  const { data: defaults } = useTaskColumnDefaults();
  const save = useSetTaskColumnDefaults();
  const { context } = useTaskContext();
  const columns = useTaskColumns(context, localToday(), { doable: false });
  return (
    <SettingsSection
      title="Colonnes des nouvelles vues"
      actions={
        <>
          <Button size="xs" variant="subtle" color="gray" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => save.mutate(null, ON_ERROR)}>
            Colonnes de l’app
          </Button>
        </>
      }
    >
      <Text size="xs" c="dimmed">
        Colonnes affichées et leur ordre (glissez-déposez) quand une vue de tâches est créée. Les vues existantes gardent les leurs.
      </Text>
      {defaults && (
        <DataColumnsPanel
          columns={columns}
          layout={{ columnOrder: defaults.columnOrder, hiddenColumns: defaults.hiddenColumns, columnSizing: {} }}
          onLayoutChange={(layout) => save.mutate(layout.columnOrder.length ? { columnOrder: layout.columnOrder, hiddenColumns: layout.hiddenColumns } : null, ON_ERROR)}
        />
      )}
    </SettingsSection>
  );
}
