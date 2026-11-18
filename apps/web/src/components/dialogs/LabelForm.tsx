import { Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { useAppForm } from '../../lib/form';
import { FormActions } from './FormActions';

export interface LabelFormProps {
  /** Label to start from (empty for a new element). */
  initial: string;
  /** Rule of the label (`requiredText(60)`…), its message shown under the field. */
  schema: z.ZodType<string>;
  /** Label of the submit button (« Créer », « Renommer »). */
  submitLabel: string;
  /** Saves the label, trimmed: a promise keeps the form open (spinning) until it resolves, its failure under the field. */
  onSubmit: (label: string) => void | Promise<unknown>;
  /** Closes the form. */
  onDone: () => void;
  /** Label of the field. Optional. Default = « Libellé » (decision AD). */
  fieldLabel?: string;
  /** Example in the empty field. Optional. */
  placeholder?: string;
}

/**
 * Form of a single label (create or rename a view, a dashboard, a folder), the same everywhere: validated as the
 * other forms (on blur, then on every change), its error under the field.
 * @param {LabelFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function LabelForm({ initial, schema, submitLabel, onSubmit, onDone, fieldLabel = 'Libellé', placeholder }: LabelFormProps) {
  const form = useAppForm<{ label: string }>({ initialValues: { label: initial }, schema: z.object({ label: schema }) });
  const [loading, setLoading] = useState(false);
  return (
    <form
      noValidate
      onSubmit={form.onSubmit(({ label }) => {
        const result = onSubmit(schema.parse(label));
        if (!(result instanceof Promise)) return onDone();
        setLoading(true);
        result
          .then(onDone)
          .catch((failure: unknown) => form.setFieldError('label', failure instanceof Error ? failure.message : String(failure)))
          .finally(() => setLoading(false));
      })}
    >
      <Stack gap="md">
        <TextInput label={fieldLabel} required data-autofocus placeholder={placeholder} {...form.getInputProps('label')} />
        <FormActions onCancel={onDone} submitLabel={submitLabel} loading={loading} />
      </Stack>
    </form>
  );
}
