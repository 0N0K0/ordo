import { Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { useAppForm } from '../../lib/form';
import { FormActions } from './FormActions';

export interface NameFormProps {
  /** Name to start from (empty for a new element). */
  initial: string;
  /** Rule of the name (`requiredText(60)`…), its message shown under the field. */
  schema: z.ZodType<string>;
  /** Label of the submit button (« Créer », « Renommer »). */
  submitLabel: string;
  /** Saves the name, trimmed: a promise keeps the form open (spinning) until it resolves, its failure under the field. */
  onSubmit: (name: string) => void | Promise<unknown>;
  /** Closes the form. */
  onDone: () => void;
  /** Label of the field. Optional. Default = « Nom ». */
  label?: string;
  /** Example in the empty field. Optional. */
  placeholder?: string;
}

/**
 * Form of a single name (create or rename a view, a dashboard, a folder), the same everywhere: validated as the other
 * forms (on blur, then on every change), its error under the field.
 * @param {NameFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NameForm({ initial, schema, submitLabel, onSubmit, onDone, label = 'Nom', placeholder }: NameFormProps) {
  const form = useAppForm<{ name: string }>({ initialValues: { name: initial }, schema: z.object({ name: schema }) });
  const [loading, setLoading] = useState(false);
  return (
    <form
      noValidate
      onSubmit={form.onSubmit(({ name }) => {
        const result = onSubmit(schema.parse(name));
        if (!(result instanceof Promise)) return onDone();
        setLoading(true);
        result
          .then(onDone)
          .catch((failure: unknown) => form.setFieldError('name', failure instanceof Error ? failure.message : String(failure)))
          .finally(() => setLoading(false));
      })}
    >
      <Stack gap="md">
        <TextInput label={label} required data-autofocus placeholder={placeholder} {...form.getInputProps('name')} />
        <FormActions onCancel={onDone} submitLabel={submitLabel} loading={loading} />
      </Stack>
    </form>
  );
}
