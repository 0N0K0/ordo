import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from '@ordo/shared';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../../components/feedback-icons';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { useSetUpAccount } from '../api';
import { AuthHeader } from '../AuthLayout';
import { PasswordStrength } from '../PasswordStrength';

/**
 * Chooses the password of a new account, from the link received by email when the admin created it.
 * @returns {JSX.Element} Account setup page.
 */
export function SetupAccountPage() {
  const token = useSearchParams()[0].get('token');
  const navigate = useNavigate();
  const setUpAccount = useSetUpAccount();
  const form = useAppForm<ResetPasswordFormValues>({
    initialValues: { password: '', confirmation: '' },
    schema: resetPasswordFormSchema,
  });

  const handleSubmit = form.onSubmit(({ password }) => {
    if (!token) return;
    setUpAccount.mutate(
      { token, password },
      {
        onSuccess: () => {
          notifySuccess('Compte activé. Vous pouvez vous connecter.');
          navigate('/login', { replace: true });
        },
        onError: (error) => showFormError(form, error),
      },
    );
  });

  return (
    <>
      <AuthHeader title="Choisir votre mot de passe" />
      {token ? (
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Stack gap="xs">
              <PasswordInput label="Mot de passe" autoComplete="new-password" autoFocus required {...form.getInputProps('password')} />
              <PasswordStrength value={form.values.password} />
            </Stack>
            <PasswordInput label="Confirmation" autoComplete="new-password" required {...form.getInputProps('confirmation')} />
            <Button type="submit" loading={setUpAccount.isPending} fullWidth>
              Activer mon compte
            </Button>
          </Stack>
        </form>
      ) : (
        <Alert color="red" title="Lien invalide" icon={<ErrorIcon />}>
          Ce lien d’activation est incomplet. Demandez-en un nouveau à l’administratrice.
        </Alert>
      )}
      <Anchor component={Link} to="/login" size="sm">
        Se connecter
      </Anchor>
    </>
  );
}
