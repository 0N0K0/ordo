import { Badge, Checkbox, SimpleGrid, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { treasuryAccountSchema } from '@ordo/shared';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { localToday } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useTreasuryAccounts, useTreasuryMutations, type TreasuryAccount } from '../api';

/**
 * Bank accounts, in the treasury settings, as every settings list: name, color, image, opening balance and date,
 * archived (no longer counted); their balance today; reordered by drag and drop, deleted when without entries.
 * @returns {JSX.Element} Section.
 */
export function AccountsSettings() {
  const { data: accounts, isPending } = useTreasuryAccounts();
  const { createAccount, updateAccount, deleteAccount } = useTreasuryMutations();
  /**
   * Input of an account from the form values.
   * @param {{ name: string, openingBalance: number, openingDate: string, archived: boolean }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; openingBalance: number; openingDate: string; archived: boolean }) => ({
    name: values.name,
    openingBalance: values.openingBalance,
    openingDate: values.openingDate,
    archived: values.archived,
  });
  return (
    <SettingsList<TreasuryAccount, { openingBalance: number; openingDate: string; archived: boolean }>
      kind="TREASURY_ACCOUNT"
      title="Comptes"
      description="Vos comptes en banque, avec le solde du relevé à une date : les mouvements et le prévisionnel partent de là."
      noun="le compte"
      items={accounts ?? []}
      loading={isPending}
      colorRequired={false}
      schema={treasuryAccountSchema}
      extra={{
        initial: (account) => ({
          openingBalance: account?.openingBalance ?? 0,
          openingDate: account ? String(account.openingDate).slice(0, 10) : localToday(),
          archived: account?.archived ?? false,
        }),
        render: (form) => (
          <>
            <SimpleGrid cols={2} spacing="sm">
              <AmountInput label="Solde d’ouverture" suffix=" €" {...form.getInputProps('openingBalance')} />
              <DatePickerInput label="Au" required {...form.getInputProps('openingDate')} />
            </SimpleGrid>
            <Checkbox label="Archivé (n’est plus compté dans le solde)" {...form.getInputProps('archived', { type: 'checkbox' })} />
          </>
        ),
      }}
      create={async (values) => createdId(await createAccount.mutateAsync(input(values)))}
      update={(id, values) => updateAccount.mutateAsync({ id, input: input(values) })}
      remove={(id) => deleteAccount.mutateAsync(id)}
      undeletable={(account) => (account.entryCount > 0 ? 'A des mouvements : archivez-le' : null)}
      renderBadges={(account) => (
        <>
          {account.archived && (
            <Badge size="xs" color="gray">
              Archivé
            </Badge>
          )}
          <Text size="xs" c="dimmed">
            <Text span inherit fw={600} c={account.balance < 0 ? 'red' : undefined}>
              {fmt.money(account.balance)}
            </Text>{' '}
            aujourd’hui · {fmt.money(account.openingBalance)} au {fmt.day(String(account.openingDate).slice(0, 10))}
          </Text>
        </>
      )}
    />
  );
}
