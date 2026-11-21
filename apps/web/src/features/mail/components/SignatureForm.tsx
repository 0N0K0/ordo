import { useAppForm, useFieldSave } from '../../../lib/form';
import { Stack, Text } from '@mantine/core';
import { signatureFormSchema } from '@ordo/shared';
import { LazyRichEditor } from './LazyRichEditor';
import { useMailAccounts, useMailAccountMutations, type MailAccount } from '../api';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

/**
 * HTML signature of an account: rich editor, with the raw HTML editable through the code control; saved on leaving
 * the editor.
 * @param {{ account: MailAccount }} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function SignatureForm({ account }: { account: MailAccount }) {
  const { setSignature } = useMailAccountMutations();
  const { data: accounts } = useMailAccounts();
  const current = accounts?.find((item) => item.id === account.id) ?? account;
  const base = useAppForm({ initialValues: { signature: account.signature ?? '' }, schema: signatureFormSchema });
  const { form, saving, fieldProps } = useFieldSave(base, {
    // An empty editor gives an empty paragraph: no signature.
    save: ({ signature = '' }) => setSignature.mutateAsync({ id: account.id, signature: signature === '<p></p>' ? '' : signature }),
    schema: signatureFormSchema,
    saved: { signature: current.signature ?? '' },
    onBlur: ['signature'],
  });
  return (
    <Stack gap="md">
      <SaveStatus saving={saving} />
      <Text size="sm" c="dimmed">
        Ajoutée aux nouveaux mails de {account.email}. Le bouton « &lt;/&gt; » de la barre d’outils permet de coller ou de modifier le code HTML ; les images envoyées depuis l’éditeur sont intégrées
        aux mails.
      </Text>
      <LazyRichEditor {...fieldProps('signature')} error={form.errors.signature as string | undefined} sourceCode minHeight={160} />
    </Stack>
  );
}
