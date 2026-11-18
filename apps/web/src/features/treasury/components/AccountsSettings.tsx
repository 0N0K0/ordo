import { Text } from '@mantine/core';
import { SettingsList } from '../../../components/settings/SettingsList';
import * as fmt from '../../../lib/format';
import { useTreasuryAccounts, useTreasuryMutations } from '../api';
import { useAccountItems } from '../hooks/use-settings-items';

/**
 * Bank accounts, in the treasury settings, as every settings list: name, color, image, opening balance and date,
 * archived (no longer counted); their balance today; reordered by drag and drop, deleted when without entries.
 * @returns {JSX.Element} Section.
 */
export function AccountsSettings() {
  const { data: accounts, isPending } = useTreasuryAccounts();
  const { deleteAccount } = useTreasuryMutations();
  const definition = useAccountItems();
  return (
    <SettingsList
      {...definition}
      title="Comptes"
      description="Vos comptes en banque, avec le solde du relevé à une date : les mouvements et le prévisionnel partent de là."
      noun="le compte"
      items={accounts ?? []}
      loading={isPending}
      remove={(id) => deleteAccount.mutateAsync(id)}
      undeletable={(account) => (account.entryCount > 0 ? 'A des mouvements : archivez-le' : null)}
      renderBadges={(account) => (
        <>
          <Text size="xs" c="dimmed">
            <Text span inherit fw={600} c={account.balance < 0 ? 'red' : undefined}>
              {fmt.money(account.balance)}
            </Text>{' '}
            aujourd’hui · {fmt.money(account.openingBalance)} au {fmt.day(account.openingDate)}
          </Text>
        </>
      )}
    />
  );
}
