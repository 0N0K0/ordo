import { Stack } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ReactNode } from 'react';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { DestructiveActions, DestructiveRisks } from './DestructiveActions';

let count = 0;

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
}

/**
 * Asks for the confirmation of a destructive action, the dialog of every one: its risks (and « Cette action est
 * irréversible. »), then the confirmation (first, in red) and Cancel, bottom-right.
 * @param {ConfirmDestructiveOptions} options Dialog.
 * @returns {void}
 */
export function confirmDestructive({ title, risks, confirmLabel, confirmIcon, onConfirm, run, done }: ConfirmDestructiveOptions): void {
  const modalId = `confirm-destructive-${++count}`;
  modals.open({
    modalId,
    title,
    children: (
      <Stack gap="md">
        <DestructiveRisks>{risks}</DestructiveRisks>
        <DestructiveActions
          confirmLabel={confirmLabel}
          confirmIcon={confirmIcon}
          onCancel={() => modals.close(modalId)}
          onConfirm={() => {
            modals.close(modalId);
            onConfirm?.();
            run?.().then(() => done && notifySuccess(done), onMutationError);
          }}
        />
      </Stack>
    ),
  });
}
