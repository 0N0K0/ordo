import { Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { WarningIcon } from '@phosphor-icons/react';
import { ErrorIcon, SuccessIcon } from '../components/feedback-icons';

/**
 * Shows a success toast that closes on its own.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifySuccess(message: string): void {
  notifications.show({ color: 'green', icon: <SuccessIcon />, message, autoClose: 4000 });
}

/**
 * Shows a warning toast that closes on its own, a little later than a success one.
 * @param {string} title Title.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyWarning(title: string, message: string): void {
  notifications.show({ color: 'yellow', icon: <WarningIcon />, title, message, autoClose: 8000 });
}

/**
 * Shows an error toast that stays until closed.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyError(message: string): void {
  notifications.show({ color: 'red', icon: <ErrorIcon />, title: 'Erreur', message, autoClose: false });
}

/**
 * Shows a success toast with an "Annuler" button, for a few seconds.
 * @param {string} message Message to display.
 * @param {() => void} onUndo Reverts the action.
 * @returns {void}
 */
export function notifyWithUndo(message: string, onUndo: () => void): void {
  const id = notifications.show({
    color: 'green',
    icon: <SuccessIcon />,
    autoClose: 6000,
    message: (
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm">{message}</Text>
        <Button
          size="compact-sm"
          variant="subtle"
          onClick={() => {
            notifications.hide(id);
            onUndo();
          }}
        >
          Annuler
        </Button>
      </Group>
    ),
  });
}
