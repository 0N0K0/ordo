import { Alert, Anchor, Center, Loader } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorIcon, SuccessIcon } from '../../../components/feedback-icons';
import { useConfirmEmailChange } from '../api';
import { AuthHeader } from '../AuthLayout';

/**
 * Confirms a new email address from the link it received.
 * @returns {JSX.Element} Confirmation page.
 */
export function ConfirmEmailPage() {
  const token = useSearchParams()[0].get('token');
  const confirm = useConfirmEmailChange();
  const { mutate } = confirm;
  // Tokens are single-use: never send it twice (StrictMode runs effects twice in dev).
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutate({ token });
  }, [token, mutate]);

  return (
    <>
      <AuthHeader title="Confirmation de l’adresse email" />
      {!token || confirm.isError ? (
        <Alert color="red" title="Lien invalide" icon={<ErrorIcon />}>
          {confirm.error?.message ?? 'Ce lien de confirmation est incomplet.'} Relancez le changement d’adresse depuis
          votre compte.
        </Alert>
      ) : confirm.isSuccess ? (
        <Alert color="green" title="Adresse confirmée" icon={<SuccessIcon />}>
          Votre nouvelle adresse email est enregistrée.
        </Alert>
      ) : (
        <Center>
          <Loader aria-label="Confirmation en cours" />
        </Center>
      )}
      <Anchor component={Link} to="/account" size="sm">
        Aller à mon compte
      </Anchor>
    </>
  );
}
