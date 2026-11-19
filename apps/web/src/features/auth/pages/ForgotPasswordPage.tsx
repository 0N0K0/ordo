import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { Anchor, Stack, TextInput } from '@mantine/core';
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from '@ordo/shared';
import { Link } from 'react-router';

import { formCallbacks, useAppForm } from '../../../lib/form';
import { useRequestPasswordReset } from '../api';
import { AuthHeader } from './AuthLayout';
import { AUTH_PATHS } from '../../../app/pages';
import { ActionButton } from '../../../components/actions/ActionButton';

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
    requestReset.mutate(values, formCallbacks(form, null));
  });

  return (
    <>
      <AuthHeader title="Mot de passe oublié" description="Saisissez votre identifiant ou votre adresse email : vous recevrez un lien pour choisir un nouveau mot de passe." />
      {requestReset.isSuccess ? (
        <NoticeAlert kind="success" title="Demande envoyée">
          Si un compte correspond, un email contenant un lien valable 30 minutes vient d’être envoyé.
        </NoticeAlert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <TextInput label="Identifiant ou adresse email" autoComplete="username" autoFocus required {...form.getInputProps('identifier')} />
            <ActionButton type="submit" icon={<PaperPlaneTiltIcon aria-hidden />} loading={requestReset.isPending} fullWidth>
              Envoyer le lien
            </ActionButton>
          </Stack>
        </form>
      )}
      <Anchor component={Link} to={AUTH_PATHS.login} size="sm">
        Retour à la connexion
      </Anchor>
    </>
  );
}
