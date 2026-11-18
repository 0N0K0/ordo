import { PasswordInput, Stack } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { PasswordStrength } from './PasswordStrength';

interface NewPasswordFieldsProps<Values extends { password: string; confirmation: string }> {
  /** Form holding the new password and its confirmation. */
  form: UseFormReturnType<Values>;
  /** Words of the user (username, email) a strong password must not rely on. Optional. */
  userInputs?: string[];
  /** The new password takes the focus. Optional. Default = false. */
  autoFocus?: boolean;
}

/**
 * New password with its strength, then its confirmation.
 * @param {NewPasswordFieldsProps<Values>} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function NewPasswordFields<Values extends { password: string; confirmation: string }>({ form, userInputs, autoFocus = false }: NewPasswordFieldsProps<Values>) {
  return (
    <>
      <Stack gap="xs">
        <PasswordInput label="Nouveau mot de passe" autoComplete="new-password" autoFocus={autoFocus} required {...form.getInputProps('password')} />
        <PasswordStrength value={form.values.password} userInputs={userInputs} />
      </Stack>
      <PasswordInput label="Confirmation" autoComplete="new-password" required {...form.getInputProps('confirmation')} />
    </>
  );
}
