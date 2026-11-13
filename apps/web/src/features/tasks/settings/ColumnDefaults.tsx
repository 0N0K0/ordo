import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { notifyError } from '../../../lib/notify';
import { useSetTaskColumnDefaults, useTaskColumnDefaults } from '../api';
import { ColumnsPanel } from '../views/ColumnsPanel';

/**
 * Columns new task views of the workspace start with: those shown and their order, by drag and drop; the views
 * already made keep theirs.
 * @returns {JSX.Element} Section.
 */
export function ColumnDefaults() {
  const { data: columns } = useTaskColumnDefaults();
  const save = useSetTaskColumnDefaults();
  const onError = (error: Error) => notifyError(error.message);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h5">
            Colonnes des nouvelles vues
          </Title>
          <Button size="xs" variant="subtle" color="gray" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => save.mutate(null, { onError })}>
            Colonnes de l’app
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Colonnes affichées et leur ordre (glissez-déposez) quand une vue de tâches est créée. Les vues existantes gardent les leurs.
        </Text>
        {columns && <ColumnsPanel columnOrder={columns.columnOrder} hiddenColumns={columns.hiddenColumns} onChange={(next) => save.mutate(next, { onError })} withHint={false} />}
      </Stack>
    </Paper>
  );
}
