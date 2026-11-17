import { Button, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { DataColumnsPanel } from '../../../components/data-table/ColumnsPanel';
import { localToday } from '../../../lib/dates';
import { onMutationError } from '../../../lib/notify';
import { useSetTaskColumnDefaults, useTaskColumnDefaults } from '../api';
import { useTaskColumns } from '../use-task-columns';
import { useTaskContext } from '../use-task-context';
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
  const onError = onMutationError;
  return (
    <SettingsSection
      title="Colonnes des nouvelles vues"
      actions={
        <>
          <Button size="xs" variant="subtle" color="gray" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => save.mutate(null, { onError })}>
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
          onLayoutChange={(layout) => save.mutate(layout.columnOrder.length ? { columnOrder: layout.columnOrder, hiddenColumns: layout.hiddenColumns } : null, { onError })}
        />
      )}
    </SettingsSection>
  );
}
