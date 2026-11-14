import { Button, Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { treasuryAccountSchema } from '@ordo/shared';
import { AmountInput } from '../../components/AmountInput';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useTreasuryMutations, type AccountValues, type TreasuryAccount } from './api';

/**
 * Account: name, opening balance and date, archived.
 * @param {{ account?: TreasuryAccount, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function AccountForm({ account, onDone }: { account?: TreasuryAccount; onDone: () => void }) {
  const { createAccount, updateAccount } = useTreasuryMutations();
  const form = useAppForm<AccountValues & Record<string, unknown>>({
    initialValues: {
      name: account?.name ?? '',
      openingBalance: account?.openingBalance ?? 0,
      openingDate: account ? String(account.openingDate) : localToday(),
      archived: account?.archived ?? false,
    },
    schema: treasuryAccountSchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(account ? 'Compte modifié.' : 'Compte créé.');
            onDone();
          },
          onError: (error: Error) => showFormError(form, error),
        };
        if (account) updateAccount.mutate({ id: account.id, input }, callbacks);
        else createAccount.mutate(input, callbacks);
      })}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required placeholder="Compte courant, livret…" data-autofocus {...form.getInputProps('name')} />
        <SimpleGrid cols={2} spacing="sm">
          <AmountInput label="Solde d’ouverture" suffix=" €" {...form.getInputProps('openingBalance')} />
          <DatePickerInput label="Au" required {...form.getInputProps('openingDate')} />
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Le solde du relevé à cette date : seuls les mouvements suivants sont comptés.
        </Text>
        {account && <Checkbox label="Archivé (n’est plus compté dans le solde)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createAccount.isPending || updateAccount.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
