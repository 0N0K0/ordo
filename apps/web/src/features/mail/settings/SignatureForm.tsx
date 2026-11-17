import { Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { RichEditor } from '../../../components/rich-text/RichEditor';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useMailAccountMutations, type MailAccount } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';

/**
 * HTML signature of an account: rich editor, with the raw HTML editable through the code control.
 * @param {{ account: MailAccount, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SignatureForm({ account, onDone }: { account: MailAccount; onDone: () => void }) {
  const { setSignature } = useMailAccountMutations();
  const [html, setHtml] = useState(account.signature ?? '');
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Ajoutée aux nouveaux mails de {account.email}. Le bouton « &lt;/&gt; » de la barre d’outils permet de coller ou de
        modifier le code HTML ; les images envoyées depuis l’éditeur sont intégrées aux mails.
      </Text>
      <RichEditor value={html} onChange={setHtml} sourceCode minHeight={160} />
      <FormActions onCancel={onDone} loading={setSignature.isPending} onSubmit={() =>
            setSignature.mutate(
              { id: account.id, signature: html === '<p></p>' ? '' : html },
              {
                onSuccess: () => {
                  notifySuccess('Signature enregistrée.');
                  onDone();
                },
                onError: onMutationError,
              },
            )
          } />
    </Stack>
  );
}
