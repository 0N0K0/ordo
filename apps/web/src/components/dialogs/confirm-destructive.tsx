import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ReactNode } from 'react';
import { DestructiveActions } from './DestructiveActions';

let count = 0;

interface ConfirmDestructiveOptions {
  /** Title of the dialog (« Supprimer le budget »…). */
  title: string;
  /** What the action does and what is lost (a sentence, or more). */
  risks: ReactNode;
  /** Label of the confirmation. Optional. Default = « Supprimer ». */
  confirmLabel?: string;
  /** The action, once confirmed. */
  onConfirm: () => void;
}

/**
 * Asks for the confirmation of a destructive action, the dialog of every one: its risks, then the confirmation (first,
 * in red) and Cancel, bottom-right.
 * @param {ConfirmDestructiveOptions} options Dialog.
 * @returns {void}
 */
export function confirmDestructive({ title, risks, confirmLabel, onConfirm }: ConfirmDestructiveOptions): void {
  const modalId = `confirm-destructive-${++count}`;
  modals.open({
    modalId,
    title,
    children: (
      <Stack gap="md">
        <Text size="sm" component="div">
          {risks}
        </Text>
        <DestructiveActions
          confirmLabel={confirmLabel}
          onCancel={() => modals.close(modalId)}
          onConfirm={() => {
            modals.close(modalId);
            onConfirm();
          }}
        />
      </Stack>
    ),
  });
}
