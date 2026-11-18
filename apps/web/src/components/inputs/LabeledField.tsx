import { Input, Stack, type MantineSpacing } from '@mantine/core';
import { useId, type ReactNode } from 'react';

interface LabeledFieldProps {
  label: ReactNode;
  /** Help under the label. Optional. */
  description?: ReactNode;
  /** Error under the controls. Optional. */
  error?: ReactNode;
  /** Asterisk after the label. Optional. Default = false. */
  required?: boolean;
  /** Space between the controls. Optional. Default = 4. */
  gap?: MantineSpacing | number;
  /** Controls (a list of fields, buttons…), stacked. */
  children: ReactNode;
}

/**
 * Label above controls that are not one input (a list of fields, a group of buttons), as the labels of the inputs:
 * the controls form a group named by the label, for the screen readers.
 * @param {LabeledFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function LabeledField({ label, description, error, required = false, gap = 4, children }: LabeledFieldProps) {
  const id = useId();
  return (
    <Input.Wrapper labelElement="div" label={label} labelProps={{ id }} description={description} error={error} required={required}>
      <Stack gap={gap} mt={4} role="group" aria-labelledby={id}>
        {children}
      </Stack>
    </Input.Wrapper>
  );
}
