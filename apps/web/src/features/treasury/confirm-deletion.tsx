import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { DestructiveActions } from '../workspace/DeleteDialogs';

/**
 * Asks for confirmation, then runs a deletion.
 * @param {string} title Dialog title.
 * @param {string} message Risks.
 * @param {() => void} confirm Deletion.
 * @returns {void}
 */
export function confirmDeletion(title: string, message: string, confirm: () => void): void {
  const modalId = `treasury-delete-${Date.now()}`;
  modals.open({
    modalId,
    title,
    children: (
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        <DestructiveActions
          loading={false}
          onCancel={() => modals.close(modalId)}
          onConfirm={() => {
            modals.close(modalId);
            confirm();
          }}
        />
      </Stack>
    ),
  });
}
