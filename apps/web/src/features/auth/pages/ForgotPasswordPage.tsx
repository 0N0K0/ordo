import { Alert, Anchor, Button, Stack, TextInput } from '@mantine/core';
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from '@ordo/shared';
import { Link } from 'react-router';
import { SuccessIcon } from '../../../components/feedback-icons';
import { showFormError, useAppForm } from '../../../lib/form';
import { useRequestPasswordReset } from '../api';
import { AuthHeader } from '../AuthLayout';

/**
 * Asks for a password reset link by email.
 * @returns {JSX.Element} Forgot password page.
 */
export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const form = useAppForm<ForgotPasswordFormValues>({
    initialValues: { identifier: '' },
    schema: forgotPasswordFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    requestReset.mutate(values, { onError: (error) => showFormError(form, error) });
  });

  return (
    <>
      <AuthHeader
        title="Mot de passe oublié"
        description="Saisissez votre identifiant ou votre adresse email : vous recevrez un lien pour choisir un nouveau mot de passe."
      />
      {requestReset.isSuccess ? (
        <Alert color="green" title="Demande envoyée" icon={<SuccessIcon />}>
          Si un compte correspond, un email contenant un lien valable 30 minutes vient d’être envoyé.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <TextInput
              label="Identifiant ou adresse email"
              autoComplete="username"
              autoFocus
              required
              {...form.getInputProps('identifier')}
            />
            <Button type="submit" loading={requestReset.isPending} fullWidth>
              Envoyer le lien
            </Button>
          </Stack>
        </form>
      )}
      <Anchor component={Link} to="/login" size="sm">
        Retour à la connexion
      </Anchor>
    </>
  );
}
