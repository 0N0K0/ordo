import { Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionDeclined, notifySuccess, onMutationError } from '../../lib/notify';
import { DestructiveActions, DestructiveRisks } from './DestructiveActions';
import { openModal } from '../panels/open-modal';

interface ConfirmDestructiveOptions {
  /** Title of the dialog (« Supprimer le budget »…). */
  title: string;
  /** What the action does and what is lost (a sentence, or more); « Cette action est irréversible. » follows. */
  risks: ReactNode;
  /** Label of the confirmation. Optional. Default = « Supprimer ». */
  confirmLabel?: string;
  /** Icon of the confirmation. Optional. Default = a trash. */
  confirmIcon?: ReactNode;
  /** The action, once confirmed. Optional (`run` instead). */
  onConfirm?: () => void;
  /** The action as a promise (`mutateAsync`…), once confirmed: its success told by `done`, its failure in an error toast. Optional. */
  run?: () => Promise<unknown>;
  /** Success message of `run` (« Alarme supprimée. »). Optional. Default = no toast. */
  done?: string;
  /** What follows a refusal (Cancel, Escape, a click outside). Optional. */
  onCancel?: () => void;
  /** The opposite action undoes it (a conversion): « Cette action est irréversible. » left out. Optional. Default = irreversible. */
  reversible?: boolean;
}

/**
 * Asks for the confirmation of a destructive action, the dialog of every one: its risks (and « Cette action est
 * irréversible. »), then the confirmation (first, in red) and Cancel, bottom-right.
 * @param {ConfirmDestructiveOptions} options Dialog.
 * @returns {void}
 */
export function confirmDestructive({ title, risks, confirmLabel, confirmIcon, onConfirm, run, done, onCancel, reversible }: ConfirmDestructiveOptions): void {
  let confirmed = false;
  openModal(
    title,
    (close) => (
    <Stack gap="md">
      <DestructiveRisks reversible={reversible}>{risks}</DestructiveRisks>
      <DestructiveActions
        confirmLabel={confirmLabel}
        confirmIcon={confirmIcon}
        onCancel={close}
        onConfirm={() => {
          confirmed = true;
          close();
          onConfirm?.();
          run?.().then(() => done && notifySuccess(done), onMutationError);
        }}
      />
    </Stack>
    ),
    { onClose: () => !confirmed && onCancel?.() },
  );
}

/**
 * Asks for the confirmation of a destructive action and waits for the answer; declined (Cancel, Escape, a click
 * outside): `ActionDeclined` (silent in the error toasts), so that the caller's change stops there.
 * @param {Pick<ConfirmDestructiveOptions, 'title' | 'risks' | 'confirmLabel' | 'confirmIcon'>} options Dialog.
 * @returns {Promise<void>} Resolved once confirmed.
 */
export async function confirmedDestructive(options: Pick<ConfirmDestructiveOptions, 'title' | 'risks' | 'confirmLabel' | 'confirmIcon'>): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => confirmDestructive({ ...options, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));
  if (!confirmed) throw new ActionDeclined();
}
