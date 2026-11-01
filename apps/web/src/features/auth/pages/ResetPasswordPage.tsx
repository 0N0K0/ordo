import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from '@ordo/shared';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../../components/feedback-icons';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { useResetPassword } from '../api';
import { AuthHeader } from '../AuthLayout';
import { PasswordStrength } from '../PasswordStrength';

/**
 * Sets a new password from the link received by email.
 * @returns {JSX.Element} Reset password page.
 */
export function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token');
  const navigate = useNavigate();
  const resetPassword = useResetPassword();
  const form = useAppForm<ResetPasswordFormValues>({
    initialValues: { password: '', confirmation: '' },
    schema: resetPasswordFormSchema,
  });

  const handleSubmit = form.onSubmit(({ password }) => {
    if (!token) return;
    resetPassword.mutate(
      { token, password },
      {
        onSuccess: () => {
          notifySuccess('Mot de passe modifié. Vous pouvez vous connecter.');
          navigate('/login', { replace: true });
        },
        onError: (error) => showFormError(form, error),
      },
    );
  });

  return (
    <>
      <AuthHeader title="Nouveau mot de passe" />
      {token ? (
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Stack gap="xs">
              <PasswordInput
                label="Nouveau mot de passe"
                autoComplete="new-password"
                autoFocus
                required
                {...form.getInputProps('password')}
              />
              <PasswordStrength value={form.values.password} />
            </Stack>
            <PasswordInput
              label="Confirmation"
              autoComplete="new-password"
              required
              {...form.getInputProps('confirmation')}
            />
            <Button type="submit" loading={resetPassword.isPending} fullWidth>
              Enregistrer
            </Button>
          </Stack>
        </form>
      ) : (
        <Alert color="red" title="Lien invalide" icon={<ErrorIcon />}>
          Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.
        </Alert>
      )}
      <Anchor component={Link} to="/forgot-password" size="sm">
        Demander un nouveau lien
      </Anchor>
    </>
  );
}
