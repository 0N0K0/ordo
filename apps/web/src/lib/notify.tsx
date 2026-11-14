import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { WarningIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ErrorIcon, InfoFeedbackIcon, SuccessIcon } from '../components/feedback-icons';

/**
 * Toasts (top right): an error stays until closed; any other closes on its own (paused while hovered), sooner when
 * there is nothing to act on.
 */
const AUTO_CLOSE_MS = 4000;
/** A toast with a title, text to read or actions: a little longer. */
const AUTO_CLOSE_READ_MS = 8000;

/** Action of a toast: a button closing it then acting (open a page, tick a routine, reload…). */
export interface NotifyAction {
  label: string;
  onClick: () => void;
}

/**
 * Body of a toast: its text lines (empty ones left out), then its action buttons, each closing the toast first.
 * @param {string} id Toast.
 * @param {(string | null | undefined | false)[]} lines Text lines.
 * @param {NotifyAction[]} actions Actions.
 * @returns {ReactNode} Body.
 */
function toastBody(id: string, lines: (string | null | undefined | false)[], actions: NotifyAction[]): ReactNode {
  return (
    <Stack gap={4}>
      {lines.filter(Boolean).map((line, index) => (
        <Text key={index} size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {line}
        </Text>
      ))}
      {actions.length > 0 && (
        <Group gap={4} wrap="wrap">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="compact-sm"
              variant="subtle"
              onClick={() => {
                notifications.hide(id);
                action.onClick();
              }}
            >
              {action.label}
            </Button>
          ))}
        </Group>
      )}
    </Stack>
  );
}

let sequence = 0;

/**
 * Shows an information toast (alarm, reminder, new mail, new version…): a title, text lines and actions, closing on
 * its own after a while. The same id replaces the toast shown with it.
 * @param {object} toast Toast.
 * @param {string} [toast.id] Id. Optional. Default = a new one.
 * @param {string} toast.title Title.
 * @param {(string | null | undefined | false)[]} [toast.lines] Text lines. Optional.
 * @param {NotifyAction[]} [toast.actions] Actions. Optional.
 * @param {ReactNode} [toast.icon] Icon of its source (alarm, calendar, mail…). Optional. Default = information.
 * @returns {void}
 */
export function notifyInfo({
  id,
  title,
  lines = [],
  actions = [],
  icon,
}: {
  id?: string;
  title: string;
  lines?: (string | null | undefined | false)[];
  actions?: NotifyAction[];
  icon?: ReactNode;
}): void {
  const key = id ?? `ordo-info-${(sequence += 1)}`;
  notifications.show({ id: key, color: 'blue', icon: icon ?? <InfoFeedbackIcon />, title, message: toastBody(key, lines, actions), autoClose: AUTO_CLOSE_READ_MS });
}

/**
 * Shows a success toast that closes on its own.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifySuccess(message: string): void {
  notifications.show({ color: 'green', icon: <SuccessIcon />, message, autoClose: AUTO_CLOSE_MS });
}

/**
 * Shows a warning toast that closes on its own, a little later than a success one.
 * @param {string} title Title.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyWarning(title: string, message: string): void {
  notifications.show({ color: 'yellow', icon: <WarningIcon />, title, message, autoClose: AUTO_CLOSE_READ_MS });
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
  const id = `ordo-undo-${(sequence += 1)}`;
  notifications.show({ id, color: 'green', icon: <SuccessIcon />, autoClose: AUTO_CLOSE_READ_MS, message: toastBody(id, [message], [{ label: 'Annuler', onClick: onUndo }]) });
}
