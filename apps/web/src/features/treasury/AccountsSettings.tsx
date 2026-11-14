import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { ArchiveIcon, ArrowCounterClockwiseIcon, BankIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../components/actions/ActionButton';
import { SectionHeader } from '../../components/actions/SectionHeader';
import { RowActions } from '../../components/data-table/RowActions';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import * as fmt from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryAccounts, useTreasuryMutations, type TreasuryAccount } from './api';
import { openAccountForm } from './open-account-form';

/**
 * Bank accounts, in the treasury settings: their balance today and opening balance, created, changed, archived (no
 * longer counted) or deleted (without entries).
 * @returns {JSX.Element} Section.
 */
export function AccountsSettings() {
  const { data: accounts, isPending } = useTreasuryAccounts();
  const { deleteAccount, updateAccount } = useTreasuryMutations();
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Archives or reopens an account.
   * @param {TreasuryAccount} account Account.
   * @param {boolean} archived Archived.
   * @returns {void}
   */
  const setArchived = (account: TreasuryAccount, archived: boolean) =>
    updateAccount.mutate(
      { id: account.id, input: { name: account.name, openingBalance: account.openingBalance, openingDate: String(account.openingDate).slice(0, 10), archived } },
      { onSuccess: () => notifySuccess(archived ? 'Compte archivé.' : 'Compte rouvert.'), onError },
    );

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <SectionHeader
          title="Comptes"
          description="Vos comptes en banque, avec le solde du relevé à une date : les mouvements et le prévisionnel partent de là."
          actions={
            <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} onClick={() => openAccountForm()}>
              Nouveau compte
            </ActionButton>
          }
        />
        {isPending ? (
          <ListSkeleton items={2} lines={2} />
        ) : !accounts?.length ? (
          <EmptyState compact icon={<BankIcon aria-hidden />} message="Aucun compte." />
        ) : (
          <Stack gap="xs">
            {accounts.map((account) => (
              <Group key={account.id} gap="xs" wrap="nowrap" justify="space-between" opacity={account.archived ? 0.6 : 1}>
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} truncate>
                      {account.name}
                    </Text>
                    {account.archived && (
                      <Badge size="xs" color="gray">
                        Archivé
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    <Text span inherit fw={600} c={account.balance < 0 ? 'red' : undefined}>
                      {fmt.money(account.balance)}
                    </Text>{' '}
                    aujourd’hui · {fmt.money(account.openingBalance)} au {fmt.day(String(account.openingDate).slice(0, 10))}
                  </Text>
                </Stack>
                <RowActions
                  name={account.name}
                  primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openAccountForm(account) }}
                  items={[
                    account.archived
                      ? { label: 'Rouvrir', icon: <ArrowCounterClockwiseIcon aria-hidden />, onClick: () => setArchived(account, false) }
                      : { label: 'Archiver (n’est plus compté)', icon: <ArchiveIcon aria-hidden />, onClick: () => setArchived(account, true) },
                    {
                      label: 'Supprimer',
                      icon: <TrashIcon aria-hidden />,
                      danger: true,
                      disabled: account.entryCount > 0,
                      hint: account.entryCount ? 'A des mouvements : archivez-le' : undefined,
                      onClick: () =>
                        confirmDestructive({
                          title: 'Supprimer le compte',
                          risks: `« ${account.name} » sera supprimé définitivement.`,
                          onConfirm: () => deleteAccount.mutate(account.id, { onSuccess: () => notifySuccess('Compte supprimé.'), onError }),
                        }),
                    },
                  ]}
                />
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
