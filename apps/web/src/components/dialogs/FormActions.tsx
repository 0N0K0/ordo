import { Button, Group, type MantineSize } from '@mantine/core';
import type { ReactNode } from 'react';

interface FormActionsProps {
  /** Label of the submit button. Optional. Default = « Enregistrer ». */
  submitLabel?: ReactNode;
  /** Icon before the submit label. Optional. */
  submitIcon?: ReactNode;
  /** Gives up the form (none: no « Annuler »). Optional. */
  onCancel?: () => void;
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
}

/**
 * Buttons of every form and dialog, bottom-right: « Annuler », then the action (submitting the form). The destructive
 * dialogs have theirs, the other way round (DestructiveActions).
 * @param {FormActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function FormActions({ submitLabel = 'Enregistrer', submitIcon, onCancel, loading = false, disabled = false, onSubmit, autoFocus = false, size }: FormActionsProps) {
  return (
    <Group justify="flex-end" gap={size === 'xs' ? 'xs' : 'sm'}>
      {onCancel && (
        <Button variant="default" size={size} onClick={onCancel}>
          Annuler
        </Button>
      )}
      <Button type={onSubmit ? 'button' : 'submit'} size={size} onClick={onSubmit} loading={loading} disabled={disabled} leftSection={submitIcon} data-autofocus={autoFocus || undefined}>
        {submitLabel}
      </Button>
    </Group>
  );
}
