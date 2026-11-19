import { Checkbox, Group, SimpleGrid, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { treasuryAccountSchema, treasuryCategorySchema, treasuryCounterpartySchema, treasuryPaymentMethodSchema, type TreasuryDirection } from '@ordo/shared';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { itemMutations, treeItemInput, type TreeItemValues } from '../../../components/settings/settings-api';
import type { SettingsItemKind } from '../../../components/settings/SettingsItemForm';
import { localToday } from '../../../lib/dates';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { unarchived } from '../../../lib/archive';
import { useTreasuryMutations, type TreasuryAccount, type TreasuryCategory, type TreasuryCounterpartyItem, type TreasuryPaymentMethod } from '../api';
import { z } from 'zod';

/** Fields of an account of its own: its opening balance and date. */
type AccountExtra = { openingBalance: number; openingDate: string };
/** Fields of a category of its own: its direction (the one of its list). */
type CategoryExtra = { direction: TreasuryDirection };
/** Fields of a payment method of its own: the directions it serves. */
type MethodExtra = { incoming: boolean; outgoing: boolean };
/** Form of a counterparty: its name in the label field of the settings form. */
const COUNTERPARTY_FORM_SCHEMA = z.object({ label: treasuryCounterpartySchema.shape.name, note: treasuryCounterpartySchema.shape.note });
/** Fields of a counterparty of its own: its note. */
type CounterpartyExtra = { note: string };

/**
 * Bank accounts, for their settings list and their form (a first account from the treasury page): label, color,
 * image, opening balance and date (archived by its row action).
 * @returns {SettingsItemKind<TreasuryAccount, AccountExtra>} List and form.
 */
export function useAccountItems(): SettingsItemKind<TreasuryAccount, AccountExtra> {
  const { createAccount, updateAccount } = useTreasuryMutations();
  /**
   * Input of an account from the form values.
   * @param {AccountExtra & { label: string }} values Values.
   * @returns {object} Input.
   */
  const input = (values: AccountExtra & { label: string }) => ({ label: values.label, openingBalance: values.openingBalance, openingDate: values.openingDate });
  return {
    kind: 'TREASURY_ACCOUNT',
    colorRequired: false,
    labelPlaceholder: 'Compte courant, livret…',
    schema: treasuryAccountSchema,
    extra: {
      initial: (account) => ({
        openingBalance: account?.openingBalance ?? 0,
        openingDate: account ? account.openingDate : localToday(),
      }),
      render: (form) => (
        <>
          <SimpleGrid cols={2} spacing="sm">
            <AmountInput label="Solde d’ouverture" {...form.getInputProps('openingBalance')} />
            <DatePickerInput label="Au" required {...form.getInputProps('openingDate')} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Le solde du relevé à cette date : seuls les mouvements suivants sont comptés.
          </Text>
        </>
      ),
    },
    ...itemMutations({ create: createAccount, update: updateAccount }, input),
  };
}

/**
 * Categories of one direction, for their settings list and their form (a quick creation from an entry): label,
 * color, image and parent of the same direction.
 * @param {TreasuryDirection} direction Direction of the categories.
 * @returns {SettingsItemKind<TreasuryCategory, CategoryExtra>} List and form.
 */
export function useCategoryItems(direction: TreasuryDirection): SettingsItemKind<TreasuryCategory, CategoryExtra> {
  const { createCategory, updateCategory } = useTreasuryMutations();
  /**
   * Input of a category from the form values.
   * @param {TreeItemValues} values Values.
   * @returns {object} Input.
   */
  const input = (values: TreeItemValues) => ({ ...treeItemInput(values), direction });
  return {
    kind: 'TREASURY_CATEGORY',
    schema: treasuryCategorySchema,
    extra: { initial: () => ({ direction }), render: () => null },
    ...itemMutations({ create: createCategory, update: updateCategory }, input),
  };
}

/**
 * Payment methods, for their settings list and their form (a quick creation from an entry): label, color, image and
 * the directions each one serves.
 * @returns {SettingsItemKind<TreasuryPaymentMethod, MethodExtra>} List and form.
 */
export function useMethodItems(): SettingsItemKind<TreasuryPaymentMethod, MethodExtra> {
  const { createMethod, updateMethod } = useTreasuryMutations();
  /**
   * Input of a method from the form values.
   * @param {MethodExtra & { label: string }} values Values.
   * @returns {object} Input.
   */
  const input = (values: MethodExtra & { label: string }) => ({ label: values.label, incoming: values.incoming, outgoing: values.outgoing });
  return {
    kind: 'TREASURY_PAYMENT_METHOD',
    colorRequired: false,
    labelPlaceholder: 'Virement, carte, chèque…',
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
    ...itemMutations({ create: createMethod, update: updateMethod }, input),
  };
}

/**
 * Counterparties that are not clients, for their settings list and their form (a quick creation from an entry):
 * name, color, image and note (archived by its row action).
 * @returns {SettingsItemKind<TreasuryCounterpartyItem, CounterpartyExtra>} List and form.
 */
export function useCounterpartyItems(): SettingsItemKind<TreasuryCounterpartyItem, CounterpartyExtra> {
  const { createCounterparty, updateCounterparty } = useTreasuryMutations();
  /**
   * Input of a counterparty from the form values.
   * @param {CounterpartyExtra & { label: string }} values Values (the label typed is its name).
   * @returns {object} Input.
   */
  const input = (values: CounterpartyExtra & { label: string }) => ({ name: values.label, note: values.note || null });
  return {
    kind: 'TREASURY_COUNTERPARTY',
    colorRequired: false,
    labelPlaceholder: 'Fournisseur, administration, banque…',
    labelField: 'Nom',
    schema: COUNTERPARTY_FORM_SCHEMA,
    extra: {
      initial: (counterparty) => ({ note: counterparty?.note ?? '' }),
      render: (form) => <Textarea label="Description" autosize minRows={2} {...form.getInputProps('note')} />,
    },
    ...itemMutations({ create: createCounterparty, update: updateCounterparty }, input),
  };
}

/** Creator of an item from a select (`onCreate` of `CreatableSelect`): its settings form, then the id created. */
type Creator = (label: string) => Promise<string | null>;

/**
 * Creators of a category from a select, for each direction: its settings form, its parent among the categories of
 * the direction not archived.
 * @param {readonly TreasuryCategory[]} categories Every category.
 * @returns {Record<TreasuryDirection, Creator>} Creators, by direction.
 */
export function useCategoryCreators(categories: readonly TreasuryCategory[]): Record<TreasuryDirection, Creator> {
  const incoming = useCategoryItems('IN');
  const outgoing = useCategoryItems('OUT');
  /**
   * Creator of a category of a direction.
   * @param {TreasuryDirection} direction Direction.
   * @param {SettingsItemKind<TreasuryCategory, CategoryExtra>} kind Its list and form.
   * @returns {Creator} Creator.
   */
  const creator = (direction: TreasuryDirection, kind: SettingsItemKind<TreasuryCategory, CategoryExtra>) =>
    itemCreator('Nouvelle catégorie', kind, { tree: unarchived(categories.filter((category) => category.direction === direction)) });
  return { IN: creator('IN', incoming), OUT: creator('OUT', outgoing) };
}

/**
 * Creators of a payment method (serving the direction of the entry) and of a counterparty, from a select.
 * @param {TreasuryDirection} direction Direction of the entry.
 * @returns {{ method: Creator, counterparty: Creator }} Creators.
 */
export function useEntryCreators(direction: TreasuryDirection): { method: Creator; counterparty: Creator } {
  const methods = useMethodItems();
  const counterparties = useCounterpartyItems();
  return {
    method: itemCreator('Nouveau moyen de paiement', methods, { initial: { incoming: direction !== 'OUT', outgoing: direction !== 'IN' } }),
    counterparty: itemCreator('Nouveau tiers', counterparties),
  };
}
