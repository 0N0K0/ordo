import { Group, type MantineSize } from '@mantine/core';
import { ArrowsLeftRightIcon, CheckIcon, DownloadSimpleIcon, FloppyDiskIcon, PencilSimpleIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';
import { DialogFooter } from './DialogFooter';

interface FormActionsProps {
  /** Label of the submit button; null: none (a dialog that is only closed). Optional. Default = « Enregistrer ». */
  submitLabel?: ReactNode | null;
  /** Icon before the submit label. Optional. Default = by the label: a floppy disk (« Enregistrer… »), a plus (« Créer… », « Ajouter… »), a pencil (« Renommer »), arrows (« Déplacer », « Transférer »), a download (« Télécharger… »), a check otherwise. */
  submitIcon?: ReactNode;
  /** Gives up the form (none: no « Annuler »). Optional. */
  onCancel?: () => void;
  /** Label of the cancel button. Optional. Default = « Annuler ». */
  cancelLabel?: ReactNode;
  /** Icon before the cancel label. Optional. Default = a cross. */
  cancelIcon?: ReactNode;
  /** The form is being sent (its button waits). Optional. Default = false. */
  loading?: boolean;
  /** The form cannot be sent yet. Optional. Default = false. */
  disabled?: boolean;
  /** Runs the action instead of submitting a form (a dialog without form). Optional. */
  onSubmit?: () => void;
  /** The submit button takes the focus when the dialog opens. Optional. Default = false. */
  autoFocus?: boolean;
  /** Smaller buttons, for an edit in place (a comment, a description). Optional. Default = the size of the forms. */
  size?: MantineSize;
  /** Actions on the left, apart (« Supprimer » first: DeleteButton). Optional. */
  danger?: ReactNode;
}

/**
 * Default icon of a submit button, by its label: the same action, the same icon everywhere.
 * @param {ReactNode} label Label of the submit button.
 * @returns {ReactNode} Icon.
 */
function defaultSubmitIcon(label: ReactNode): ReactNode {
  const text = typeof label === 'string' ? label : '';
  if (text.startsWith('Enregistrer')) return <FloppyDiskIcon aria-hidden />;
  if (/^(Créer|Ajouter)/.test(text)) return <PlusIcon aria-hidden />;
  if (text.startsWith('Renommer')) return <PencilSimpleIcon aria-hidden />;
  if (/^(Déplacer|Transférer)/.test(text)) return <ArrowsLeftRightIcon aria-hidden />;
  if (text.startsWith('Télécharger')) return <DownloadSimpleIcon aria-hidden />;
  return <CheckIcon aria-hidden />;
}

/**
 * Buttons of every form and dialog, bottom-right: « Annuler », then the action (submitting the form); the deletion and
 * the other actions on the item sit on the left (`danger`). In a modal, in its footer, always visible (`DialogFooter`).
 * The destructive dialogs have theirs, the other way round (DestructiveActions).
 * @param {FormActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function FormActions({
  submitLabel = 'Enregistrer',
  submitIcon,
  onCancel,
  cancelLabel = 'Annuler',
  cancelIcon = <XIcon aria-hidden />,
  loading = false,
  disabled = false,
  onSubmit,
  autoFocus = false,
  size,
  danger,
}: FormActionsProps) {
  const buttons = (
    <Group justify="flex-end" gap={size === 'xs' ? 'xs' : 'sm'}>
      {onCancel && (
        <ActionButton priority="secondary" size={size} icon={cancelIcon} onClick={onCancel}>
          {cancelLabel}
        </ActionButton>
      )}
      {submitLabel !== null && (
        <ActionButton
          type={onSubmit ? 'button' : 'submit'}
          size={size}
          onClick={onSubmit}
          loading={loading}
          disabled={disabled}
          icon={submitIcon ?? defaultSubmitIcon(submitLabel)}
          data-autofocus={autoFocus || undefined}
        >
          {submitLabel}
        </ActionButton>
      )}
    </Group>
  );
  const row = danger ? (
    <Group justify="space-between" gap="sm">
      <Group gap={4}>{danger}</Group>
      {buttons}
    </Group>
  ) : (
    buttons
  );
  // An edit in place keeps its buttons by it; the others, in a modal, go to its footer.
  return size === 'xs' ? row : <DialogFooter>{row}</DialogFooter>;
}
