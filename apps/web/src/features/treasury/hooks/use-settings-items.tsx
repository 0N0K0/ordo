import { Checkbox, Group, SimpleGrid, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { treasuryAccountSchema, treasuryCategorySchema, treasuryCounterpartySchema, treasuryPaymentMethodSchema, type TreasuryDirection } from '@ordo/shared';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { createdId } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { localToday } from '../../../lib/dates';
import { useTreasuryMutations, type TreasuryAccount, type TreasuryCategory, type TreasuryCounterparty, type TreasuryPaymentMethod } from '../api';

/** Fields of an account of its own: its opening balance and date, archived. */
type AccountExtra = { openingBalance: number; openingDate: string; archived: boolean };
/** Fields of a category of its own: its direction (the one of its list). */
type CategoryExtra = { direction: TreasuryDirection };
/** Fields of a payment method of its own: the directions it serves. */
type MethodExtra = { incoming: boolean; outgoing: boolean };
/** Fields of a counterparty of its own: its note, archived. */
type CounterpartyExtra = { note: string; archived: boolean };

/**
 * Bank accounts, for their settings list and their form (a first account from the treasury page): name, color,
 * image, opening balance and date, archived.
 * @returns {SettingsItemKind<TreasuryAccount, AccountExtra>} List and form.
 */
export function useAccountItems(): SettingsItemKind<TreasuryAccount, AccountExtra> {
  const { createAccount, updateAccount } = useTreasuryMutations();
  /**
   * Input of an account from the form values.
   * @param {AccountExtra & { name: string }} values Values.
   * @returns {object} Input.
   */
  const input = (values: AccountExtra & { name: string }) => ({ name: values.name, openingBalance: values.openingBalance, openingDate: values.openingDate, archived: values.archived });
  return {
    kind: 'TREASURY_ACCOUNT',
    colorRequired: false,
    namePlaceholder: 'Compte courant, livret…',
    schema: treasuryAccountSchema,
    extra: {
      initial: (account) => ({
        openingBalance: account?.openingBalance ?? 0,
        openingDate: account ? account.openingDate : localToday(),
        archived: account?.archived ?? false,
      }),
      render: (form, account) => (
        <>
          <SimpleGrid cols={2} spacing="sm">
            <AmountInput label="Solde d’ouverture" {...form.getInputProps('openingBalance')} />
            <DatePickerInput label="Au" required {...form.getInputProps('openingDate')} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Le solde du relevé à cette date : seuls les mouvements suivants sont comptés.
          </Text>
          {account && <Checkbox label="Archivé (n’est plus compté dans le solde)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        </>
      ),
    },
    create: async (values) => createdId(await createAccount.mutateAsync(input(values))),
    update: (id, values) => updateAccount.mutateAsync({ id, input: input(values) }),
  };
}

/**
 * Categories of one direction, for their settings list and their form (a quick creation from an entry): name,
 * color, image and parent of the same direction.
 * @param {TreasuryDirection} direction Direction of the categories.
 * @returns {SettingsItemKind<TreasuryCategory, CategoryExtra>} List and form.
 */
export function useCategoryItems(direction: TreasuryDirection): SettingsItemKind<TreasuryCategory, CategoryExtra> {
  const { createCategory, updateCategory } = useTreasuryMutations();
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color || null, direction, parentId: values.parentId });
  return {
    kind: 'TREASURY_CATEGORY',
    schema: treasuryCategorySchema,
    extra: { initial: () => ({ direction }), render: () => null },
    create: async (values) => createdId(await createCategory.mutateAsync(input(values))),
    update: (id, values) => updateCategory.mutateAsync({ id, input: input(values) }),
  };
}

/**
 * Payment methods, for their settings list and their form (a quick creation from an entry): name, color, image and
 * the directions each one serves.
 * @returns {SettingsItemKind<TreasuryPaymentMethod, MethodExtra>} List and form.
 */
export function useMethodItems(): SettingsItemKind<TreasuryPaymentMethod, MethodExtra> {
  const { createMethod, updateMethod } = useTreasuryMutations();
  /**
   * Input of a method from the form values.
   * @param {MethodExtra & { name: string }} values Values.
   * @returns {object} Input.
   */
  const input = (values: MethodExtra & { name: string }) => ({ name: values.name, incoming: values.incoming, outgoing: values.outgoing });
  return {
    kind: 'TREASURY_PAYMENT_METHOD',
    colorRequired: false,
    namePlaceholder: 'Virement, carte, chèque…',
    schema: treasuryPaymentMethodSchema,
    extra: {
      initial: (method) => ({ incoming: method?.incoming ?? true, outgoing: method?.outgoing ?? true }),
      render: (form) => (
        <Group gap="lg">
          <Checkbox label="Pour les entrées" {...form.getInputProps('incoming', { type: 'checkbox' })} />
          <Checkbox label="Pour les sorties" {...form.getInputProps('outgoing', { type: 'checkbox' })} />
        </Group>
      ),
    },
    create: async (values) => createdId(await createMethod.mutateAsync(input(values))),
    update: (id, values) => updateMethod.mutateAsync({ id, input: input(values) }),
  };
}

/**
 * Counterparties that are not clients, for their settings list and their form (a quick creation from an entry):
 * name, color, image, note and archived.
 * @returns {SettingsItemKind<TreasuryCounterparty, CounterpartyExtra>} List and form.
 */
export function useCounterpartyItems(): SettingsItemKind<TreasuryCounterparty, CounterpartyExtra> {
  const { createCounterparty, updateCounterparty } = useTreasuryMutations();
  /**
   * Input of a counterparty from the form values.
   * @param {CounterpartyExtra & { name: string }} values Values.
   * @returns {object} Input.
   */
  const input = (values: CounterpartyExtra & { name: string }) => ({ name: values.name, note: values.note || null, archived: values.archived });
  return {
    kind: 'TREASURY_COUNTERPARTY',
    colorRequired: false,
    namePlaceholder: 'Fournisseur, administration, banque…',
    schema: treasuryCounterpartySchema,
    extra: {
      initial: (counterparty) => ({ note: counterparty?.note ?? '', archived: counterparty?.archived ?? false }),
      render: (form, counterparty) => (
        <>
          <Textarea label="Note" autosize minRows={2} {...form.getInputProps('note')} />
          {counterparty && <Checkbox label="Archivé (n’est plus proposé)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        </>
      ),
    },
    create: async (values) => createdId(await createCounterparty.mutateAsync(input(values))),
    update: (id, values) => updateCounterparty.mutateAsync({ id, input: input(values) }),
  };
}
