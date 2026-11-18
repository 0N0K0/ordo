import { SettingsSection } from '../../../components/settings/SettingsSection';
import { formCallbacks } from '../../../lib/form';
import { SettingsList } from '../../../components/settings/SettingsList';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Select, SimpleGrid, Stack } from '@mantine/core';
import type { TreasuryDirection } from '@ordo/shared';
import { useInvoiceTreasuryCategories, useTreasuryMutations, useTreasurySettings, type TreasuryCategory, type TreasuryCounterparty, type TreasuryPaymentMethod } from '../api';
import { categoryOptions } from '../lib/categories';
import { TeamPanel } from './TeamPanel';
import { DirectionBadge } from './DirectionBadge';
import { useActiveWorkspace } from '../../workspaces/api';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { AccountsSettings } from './AccountsSettings';
import { countOf } from '../../../lib/text';
import { useCategoryItems, useCounterpartyItems, useMethodItems } from '../hooks/use-settings-items';

/**
 * Number of entries using an item.
 * @param {number} count Count.
 * @returns {string} "3 mouvements".
 */
const entries = (count: number) => countOf(count, 'mouvement');

/**
 * Categories of one direction, as every settings list, in a tree: added (also as a sub-category), edited (name,
 * color, image, parent), put under another or reordered by drag and drop, deleted.
 * @param {{ direction: TreasuryDirection, categories: TreasuryCategory[] }} props Direction, and all categories.
 * @returns {JSX.Element} List.
 */
function CategoryList({ direction, categories }: { direction: TreasuryDirection; categories: TreasuryCategory[] }) {
  const { deleteCategory, moveCategory } = useTreasuryMutations();
  const definition = useCategoryItems(direction);
  return (
    <SettingsList
      {...definition}
      nested
      title={`Catégories de ${direction === 'IN' ? 'recettes' : 'dépenses'}`}
      description="En arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
      noun="la catégorie"
      items={categories.filter((category) => category.direction === direction)}
      usage={new Map(categories.map((category) => [category.id, category.entryCount]))}
      usageNoun="mouvements"
      storageKey={`treasury-categories-${direction}`}
      remove={(id) => deleteCategory.mutateAsync(id)}
      move={(id, parentId, index) => moveCategory.mutateAsync({ id, parentId, index })}
    />
  );
}

/**
 * Payment methods, as every settings list: name, color, image and the directions each one serves, reordered by drag
 * and drop.
 * @param {{ methods: TreasuryPaymentMethod[] }} props Methods.
 * @returns {JSX.Element} List.
 */
function MethodList({ methods }: { methods: TreasuryPaymentMethod[] }) {
  const { deleteMethod } = useTreasuryMutations();
  const definition = useMethodItems();
  return (
    <SettingsList
      {...definition}
      title="Moyens de paiement"
      description="Virement, carte, chèque… pour les entrées, les sorties ou les deux."
      noun="le moyen de paiement"
      items={methods}
      usage={new Map(methods.map((method) => [method.id, method.entryCount]))}
      usageNoun="mouvements"
      remove={(id) => deleteMethod.mutateAsync(id)}
      renderBadges={(method) => (
        <>
          {method.incoming && <DirectionBadge direction="IN" plural />}
          {method.outgoing && <DirectionBadge direction="OUT" plural />}
        </>
      )}
    />
  );
}

/**
 * Counterparties that are not clients, as every settings list: name, color, image, note and archived, reordered by
 * drag and drop.
 * @param {{ counterparties: TreasuryCounterparty[] }} props Counterparties.
 * @returns {JSX.Element} List.
 */
function CounterpartyList({ counterparties }: { counterparties: TreasuryCounterparty[] }) {
  const { deleteCounterparty } = useTreasuryMutations();
  const definition = useCounterpartyItems();
  return (
    <SettingsList
      {...definition}
      title="Tiers"
      description="Émetteurs et destinataires qui ne sont pas des clients : fournisseurs, administrations, banques… Les clients sont proposés d’office."
      noun="le tiers"
      items={counterparties}
      usage={new Map(counterparties.map((counterparty) => [counterparty.id, counterparty.entryCount]))}
      usageNoun="mouvements"
      remove={(id) => deleteCounterparty.mutateAsync(id)}
      deleteMessage={(counterparty) => (
        <>
          « {counterparty.name} » sera supprimé définitivement.{counterparty.entryCount ? ` Ses ${entries(counterparty.entryCount)} n’auront plus d’émetteur ou de destinataire : archivez-le plutôt pour les garder.` : ''} Cette
          action est irréversible.
        </>
      )}
    />
  );
}

/**
 * Treasury categories of the payments of invoices (money in) and of the refunds of credit notes (money out): what
 * is expected of the invoices (forecast) and their payments count in the budgets of these categories.
 * @param {{ categories: TreasuryCategory[] }} props Categories of the treasury.
 * @returns {JSX.Element} Section.
 */
function InvoiceCategories({ categories }: { categories: TreasuryCategory[] }) {
  const { data: chosen } = useInvoiceTreasuryCategories();
  const { setInvoiceCategories } = useTreasuryMutations();
  const current = { invoiceCategoryId: chosen?.invoiceCategoryId ?? null, creditNoteCategoryId: chosen?.creditNoteCategoryId ?? null };
  /**
   * Saves a category.
   * @param {Partial<typeof current>} changes Category changed.
   * @returns {void}
   */
  const save = (changes: Partial<typeof current>) =>
    setInvoiceCategories.mutate({ ...current, ...changes }, formCallbacks(null, 'Catégorie enregistrée.'));
  return (
    <SettingsSection title="Factures et avoirs" description="Ce qui est attendu des factures validées (prévisionnel) et leurs règlements comptent dans les budgets de ces catégories.">
      {/* Side by side when the sidebar is wide enough (its width, not the window's). */}
      <SimpleGrid type="container" cols={{ base: 1, '520px': 2 }} spacing="sm">
        <Select
          label="Règlements des factures"
          placeholder="Aucune (hors budget)"
          clearable
          searchable
          {...treeSelectProps(categoryOptions(categories, 'IN', undefined, current.invoiceCategoryId))}
          value={current.invoiceCategoryId}
          onChange={(value) => save({ invoiceCategoryId: value })}
        />
        <Select
          label="Remboursements des avoirs"
          placeholder="Aucune (hors budget)"
          clearable
          searchable
          {...treeSelectProps(categoryOptions(categories, 'OUT', undefined, current.creditNoteCategoryId))}
          value={current.creditNoteCategoryId}
          onChange={(value) => save({ creditNoteCategoryId: value })}
        />
      </SimpleGrid>
    </SettingsSection>
  );
}

/**
 * Treasury settings: contexts (how entries are split), categories of money in and out
 * (with sub-categories), payment methods and the counterparties that are not clients.
 * @returns {JSX.Element} Panel.
 */
export function SettingsPanel() {
  const { data: settings, isPending } = useTreasurySettings();
  // No invoicing in a personal workspace.
  const { perso } = useActiveWorkspace();
  if (isPending || !settings) return <ListSkeleton items={6} />;
  const { treasuryCategories: categories, treasuryPaymentMethods: methods, treasuryCounterparties: counterparties } = settings;

  return (
    <Stack gap="md">
      <AccountsSettings />
      <TeamPanel />
      {/* One column: these settings are in the settings sidebar. */}
      <CategoryList direction="IN" categories={categories} />
      <CategoryList direction="OUT" categories={categories} />
      {!perso && <InvoiceCategories categories={categories} />}
      <MethodList methods={methods} />
      <CounterpartyList counterparties={counterparties} />
    </Stack>
  );
}
