import { Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowCounterClockwiseIcon, ArrowRightIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { GraphQLRequestError } from './graphql-client';
import { FEEDBACK_COLORS } from '../components/feedback/feedback-colors';
import { ErrorFeedbackIcon, InfoFeedbackIcon, SuccessFeedbackIcon, WarningFeedbackIcon } from '../components/feedback/feedback-icons';
import { ActionButton } from '../components/actions/ActionButton';

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
  /** Icon before the label. Optional. Default = an arrow (most of them open a page). */
  icon?: ReactNode;
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
            <ActionButton
              priority="tertiary"
              key={action.label}
              icon={action.icon ?? <ArrowRightIcon aria-hidden />}
              onClick={() => {
                notifications.hide(id);
                action.onClick();
              }}
            >
              {action.label}
            </ActionButton>
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
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show({ id: key, color: FEEDBACK_COLORS.info, icon: icon ?? <InfoFeedbackIcon />, title, message: toastBody(key, lines, actions), autoClose: AUTO_CLOSE_READ_MS });
}

/**
 * Shows the toast of an alarm ringing (or snoozed): like an information toast, but it stays until one of its actions
 * (« Arrêter », « Répéter dans N min ») closes it, and no close button. The same id updates the toast
 * shown with it, in place.
 * @param {object} toast Toast.
 * @param {string} toast.id Id (the key of the ring).
 * @param {string} toast.title Title.
 * @param {(string | null | undefined | false)[]} [toast.lines] Text lines. Optional.
 * @param {NotifyAction[]} [toast.actions] Actions. Optional.
 * @param {ReactNode} [toast.icon] Icon of its source. Optional. Default = information.
 * @param {boolean} [toast.ringing] Ringing now: the warning color (else the information one). Optional. Default = false.
 * @returns {void}
 */
export function notifyAlarm({ id, title, lines = [], actions = [], icon, ringing = false }: { id: string; title: string; lines?: (string | null | undefined | false)[]; actions?: NotifyAction[]; icon?: ReactNode; ringing?: boolean }): void {
  const toast = { id, color: ringing ? FEEDBACK_COLORS.warning : FEEDBACK_COLORS.info, icon: icon ?? <InfoFeedbackIcon />, title, message: toastBody(id, lines, actions), autoClose: false as const, withCloseButton: false };
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show(toast);
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.update(toast);
}

/**
 * Closes a toast shown with an id (an alarm stopped in another tab).
 * @param {string} id Id.
 * @returns {void}
 */
export function closeToast(id: string): void {
  notifications.hide(id);
}

/**
 * Shows a success toast that closes on its own.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifySuccess(message: string): void {
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show({ color: FEEDBACK_COLORS.success, icon: <SuccessFeedbackIcon />, message, autoClose: AUTO_CLOSE_MS });
}

/**
 * Shows a warning toast that closes on its own, a little later than a success one.
 * @param {string} title Title.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyWarning(title: string, message: string): void {
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show({ color: FEEDBACK_COLORS.warning, icon: <WarningFeedbackIcon />, title, message, autoClose: AUTO_CLOSE_READ_MS });
}

/**
 * Shows an error toast that stays until closed.
 * @param {string} message Message to display.
 * @returns {void}
 */
export function notifyError(message: string): void {
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show({ color: FEEDBACK_COLORS.error, icon: <ErrorFeedbackIcon />, title: 'Erreur', message, autoClose: false });
}

/**
 * Error of a mutation (or of any action), told in an error toast: the handler every `onError` takes.
 * @param {Error} error Error.
 * @returns {void}
 */
export const onMutationError = (error: Error): void => notifyFailure(error);

/** Options of a mutation whose success needs no toast (or is told elsewhere): its error in an error toast. */
// eslint-disable-next-line no-restricted-syntax -- ON_ERROR itself.
export const ON_ERROR: { onError: (error: Error) => void } = { onError: onMutationError };

/**
 * Callbacks of a mutation without form: a toast once done, its error in an error toast.
 * @param {string | ((result: T) => string | null)} message Success message (« Alarme supprimée. »), or made from what the mutation returned (null: nothing happened, no toast).
 * @returns {{ onSuccess: (result: T) => void, onError: (error: Error) => void }} Callbacks.
 */
export function toastCallbacks<T = unknown>(message: string | ((result: T) => string | null)): { onSuccess: (result: T) => void; onError: (error: Error) => void } {
  return {
    onSuccess: (result) => {
      const text = typeof message === 'string' ? message : message(result);
      if (text !== null) notifySuccess(text);
    },
    onError: onMutationError,
  };
}

/** An action the user declined at its confirmation (« Annuler »): it stops there, without an error toast. */
export class ActionDeclined extends Error {
  /**
   * @param {string} [message] What was declined. Optional. Default = « Action annulée. ».
   */
  constructor(message = 'Action annulée.') {
    super(message);
    this.name = 'ActionDeclined';
  }
}

/** Message of an error thrown without one (not an `Error`). */
const UNEXPECTED_ERROR = 'Une erreur inattendue est survenue.';

/**
 * Failure of an action caught in a `catch` (whatever was thrown), told in an error toast: its message, or a fallback
 * when it has none (never an empty toast). The one rule of every error toast (onMutationError, useAsyncAction, forms…).
 * An expired session is silent: the app goes back to the sign-in page; an action declined at its confirmation
 * (`ActionDeclined`) too.
 * @param {unknown} error What was thrown.
 * @param {string} [fallback] Message when it has none. Optional. Default = « Une erreur inattendue est survenue. ».
 * @returns {void}
 */
export function notifyFailure(error: unknown, fallback: string = UNEXPECTED_ERROR): void {
  // eslint-disable-next-line no-restricted-syntax -- notifyFailure itself.
  if (error instanceof GraphQLRequestError && error.code === 'UNAUTHENTICATED') return;
  // Declined at its confirmation: nothing failed.
  if (error instanceof ActionDeclined) return;
  notifyError(error instanceof Error && error.message ? error.message : fallback);
}

/**
 * Shows a success toast with an "Annuler" button, for a few seconds.
 * @param {string} message Message to display.
 * @param {() => void} onUndo Reverts the action.
 * @returns {void}
 */
export function notifyWithUndo(message: string, onUndo: () => void): void {
  const id = `ordo-undo-${(sequence += 1)}`;
  // eslint-disable-next-line no-restricted-syntax -- the toasts of the app.
  notifications.show({
    id,
    color: FEEDBACK_COLORS.success,
    icon: <SuccessFeedbackIcon />,
    autoClose: AUTO_CLOSE_READ_MS,
    message: toastBody(id, [message], [{ label: 'Annuler', icon: <ArrowCounterClockwiseIcon aria-hidden />, onClick: onUndo }]),
  });
}
