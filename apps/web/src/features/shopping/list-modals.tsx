import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ReactElement } from 'react';
import { DestructiveActions } from '../workspace/DeleteDialogs';

let modalCount = 0;

/**
 * Opens a modal with some content.
 * @param {string} title Title.
 * @param {(close: () => void) => JSX.Element} render Content.
 * @param {string} [size] Size of the modal. Optional.
 * @returns {void}
 */
function openDialog(title: string, render: (close: () => void) => ReactElement, size?: string): void {
  const modalId = `shopping-list-${++modalCount}`;
  modals.open({ modalId, title, size, children: render(() => modals.close(modalId)) });
}

/**
 * Asks for confirmation before a destructive action.
 * @param {string} title Title.
 * @param {string} message Risks.
 * @param {() => void} onConfirm Action.
 * @returns {void}
 */
export function confirmDestructive(title: string, message: string, onConfirm: () => void): void {
  openDialog(title, (close) => (
    <Stack gap="md">
      <Text size="sm">{message}</Text>
      <DestructiveActions
        loading={false}
        onCancel={close}
        onConfirm={() => {
          close();
          onConfirm();
        }}
      />
    </Stack>
  ));
}
