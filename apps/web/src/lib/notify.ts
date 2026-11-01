import { notifications } from '@mantine/notifications';
import { createElement } from 'react';
import { SuccessIcon, ErrorIcon } from '../components/feedback-icons';

/**
 * Shows a success toast that closes on its own.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifySuccess(message: string): void {
  notifications.show({ color: 'green', icon: createElement(SuccessIcon), message, autoClose: 4000 });
}

/**
 * Shows an error toast that stays until closed.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyError(message: string): void {
  notifications.show({ color: 'red', icon: createElement(ErrorIcon), title: 'Erreur', message, autoClose: false });
}
