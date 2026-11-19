import { Text, TextInput, UnstyledButton, type UnstyledButtonProps } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { useState, type ComponentPropsWithRef } from 'react';
import { notifyError, notifyFailure } from '../../../lib/notify';
import classes from './AddRowField.module.css';
import type { CellSchema } from './cell-field';

interface AddRowFieldProps {
  /** What it adds (« Ajouter une tâche »), its placeholder. */
  label: string;
  /** Where (« dans Courses »), for its accessible name. Optional. */
  where?: string;
  /** Said before the keys in the placeholder (« tous les jours »). Optional. */
  hint?: string;
  /** Rule of the label typed (checks and normalizes it). */
  schema: CellSchema<string>;
  /** Creates the row from its label; rejected, the label comes back in the field. */
  onCreate: (label: string) => Promise<unknown>;
  /** Escape, or leaving the field empty (back to what was shown before it). Optional. */
  onCancel?: () => void;
  autoFocus?: boolean;
}

/**
 * Field of the add row at the end of a table or of a group: a label typed then Enter adds a row. The field empties at
 * once so the next one can be typed while it is saved; a refused label comes back. Escape empties it.
 * @param {AddRowFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function AddRowField({ label, where, hint, schema, onCreate, onCancel, autoFocus = false }: AddRowFieldProps) {
  const [typed, setTyped] = useState('');

  /**
   * Creates the typed row, then stays ready for the next one.
   * @returns {void}
   */
  const submit = () => {
    const result = schema.safeParse(typed);
    if (!result.success) {
      if (typed.trim()) notifyError(result.error.issues[0]?.message ?? 'Libellé invalide.');
      return;
    }
    setTyped('');
    onCreate(result.data).catch((error: unknown) => {
      // Back in the field, unless another label is being typed.
      setTyped((current) => current || result.data);
      notifyFailure(error);
    });
  };

  return (
    <TextInput
      variant="unstyled"
      size="xs"
      classNames={{ input: classes.input }}
      leftSection={<PlusIcon aria-hidden />}
      placeholder={`${label} (${hint ? `${hint} ; ` : ''}Entrée pour valider)`}
      aria-label={where ? `${label} ${where}` : label}
      autoFocus={autoFocus}
      value={typed}
      onChange={(event) => setTyped(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') submit();
        if (event.key === 'Escape') {
          setTyped('');
          onCancel?.();
        }
      }}
      onBlur={() => onCancel && !typed.trim() && onCancel()}
      w={420}
      maw="100%"
    />
  );
}

/**
 * Button of an add row (« + Ajouter… »), when adding opens something (a form, a menu) instead of a field.
 * @param {UnstyledButtonProps & ComponentPropsWithRef<'button'> & { label: string }} props Its text, and button props.
 * @returns {JSX.Element} Button.
 */
export function AddRowButton({ label, ...props }: UnstyledButtonProps & ComponentPropsWithRef<'button'> & { label: string }) {
  return (
    <UnstyledButton className={classes.button} {...props}>
      <PlusIcon aria-hidden />
      <Text span size="sm">
        {label}
      </Text>
    </UnstyledButton>
  );
}
