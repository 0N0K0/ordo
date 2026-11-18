import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { Anchor, Center, Loader } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useConfirmEmailChange } from '../api';
import { AuthHeader } from './AuthLayout';

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
        <ErrorAlert title="Lien invalide">
          {confirm.error?.message ?? 'Ce lien de confirmation est incomplet.'} Relancez le changement d’adresse depuis
          votre compte.
        </ErrorAlert>
      ) : confirm.isSuccess ? (
        <NoticeAlert kind="success" title="Adresse confirmée">
          Votre nouvelle adresse email est enregistrée.
        </NoticeAlert>
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
