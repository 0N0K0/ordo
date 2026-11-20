import { Group, Loader, Text } from '@mantine/core';
import { CheckIcon } from '@phosphor-icons/react';

/**
 * State of a detail panel saved field by field (decision D22, `useFieldSave`), at its top: « Enregistrement… » while a
 * save runs, « Enregistré » otherwise. Its place stays the same (no jump), and it is read out when it changes.
 * @param {{ saving: boolean }} props Whether a save is running.
 * @returns {JSX.Element} State.
 */
export function SaveStatus({ saving }: { saving: boolean }) {
  return (
    <Group gap={6} wrap="nowrap" justify="flex-end" h={24} role="status" aria-live="polite">
      {saving ? <Loader size={12} /> : <CheckIcon size={12} aria-hidden />}
      <Text size="xs" c="dimmed">
        {saving ? 'Enregistrement…' : 'Enregistré'}
      </Text>
    </Group>
  );
}
