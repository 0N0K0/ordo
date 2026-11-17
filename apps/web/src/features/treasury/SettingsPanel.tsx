import { createdId } from '../../components/settings/settings-api';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsList } from '../../components/settings/SettingsList';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import { Badge, Checkbox, ColorInput, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { treasuryCategorySchema, treasuryCounterpartySchema, treasuryPaymentMethodSchema, type TreasuryDirection } from '@ordo/shared';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { useInvoiceTreasuryCategories, useTreasuryMutations, useTreasurySettings, type TreasuryCategory, type TreasuryCounterparty, type TreasuryPaymentMethod } from './api';
import { categoryOptions } from './categories';
import { TeamPanel } from './TeamPanel';
import { useActiveWorkspace } from '../workspaces/api';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { AccountsSettings } from './AccountsSettings';
import { countOf } from '../../lib/text';
import { FormActions } from '../../components/dialogs/FormActions';

/**
 * Number of entries using an item.
 * @param {number} count Count.
 * @returns {string} "3 mouvements".
 */
const entries = (count: number) => countOf(count, 'mouvement');

interface CategoryFormProps {
  category?: TreasuryCategory;
  /** New category: its direction and parent. */
  direction?: TreasuryDirection;
  parentId?: string | null;
  categories: TreasuryCategory[];
  /** Closes the form; given the id of the category created. */
  onDone: (createdId?: string) => void;
}

/**
 * Category: name, direction and parent category of the same direction.
 * @param {CategoryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function CategoryForm({ category, direction = 'OUT', parentId = null, categories, onDone }: CategoryFormProps) {
  const { createCategory, updateCategory } = useTreasuryMutations();
  const swatches = useColorSwatches();
  // A new category takes the color of its parent (or the first of the palette).
  const parentColor = parentId ? categories.find((item) => item.id === parentId)?.color : null;
  const form = useAppForm<{ name: string; color: string; direction: TreasuryDirection; parentId: string | null }>({
    initialValues: { name: category?.name ?? '', color: category ? (category.color ?? '') : (parentColor ?? swatches[0]), direction: category?.direction ?? direction, parentId: category?.parentId ?? parentId },
    schema: treasuryCategorySchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(category ? 'Catégorie modifiée.' : 'Catégorie créée.');
          },
          onError: (error: Error) => showFormError(form, error),
        };
        if (category)
          updateCategory.mutate(
            { id: category.id, input },
            {
              ...callbacks,
              onSuccess: () => {
                callbacks.onSuccess();
                onDone();
              },
            },
          );
        else
          createCategory.mutate(input, {
            ...callbacks,
            onSuccess: (id) => {
              callbacks.onSuccess();
              onDone(id);
            },
          });
      })}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Couleur" format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Sens
          </Text>
          <SegmentedControl
            aria-label="Sens"
            data={[
              { value: 'IN', label: 'Entrée' },
              { value: 'OUT', label: 'Sortie' },
            ]}
            value={form.values.direction}
            // A parent has the same direction.
            onChange={(value) => form.setValues({ direction: value as TreasuryDirection, parentId: null })}
          />
          {form.errors.direction && (
            <Text size="xs" c="red">
              {form.errors.direction}
            </Text>
          )}
        </Stack>
        <Select
          label="Catégorie parente"
          clearable
          searchable
          placeholder="Aucune (catégorie principale)"
          {...treeSelectProps(categoryOptions(categories, form.values.direction, category?.id))}
          {...form.getInputProps('parentId')}
        />
        <FormActions loading={createCategory.isPending || updateCategory.isPending} onCancel={() => onDone()} />
      </Stack>
    </form>
  );
}

interface MethodFormProps {
  method?: TreasuryPaymentMethod;
  /** New method: for this direction only (both when omitted). */
  direction?: TreasuryDirection;
  /** Closes the form; given the id of the method created. */
  onDone: (createdId?: string) => void;
}

/**
 * Payment method: name and the directions it serves.
 * @param {MethodFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MethodForm({ method, direction, onDone }: MethodFormProps) {
  const { createMethod, updateMethod } = useTreasuryMutations();
  const form = useAppForm<{ name: string; incoming: boolean; outgoing: boolean }>({
    initialValues: { name: method?.name ?? '', incoming: method?.incoming ?? direction !== 'OUT', outgoing: method?.outgoing ?? direction !== 'IN' },
    schema: treasuryPaymentMethodSchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(method ? 'Moyen de paiement modifié.' : 'Moyen de paiement créé.');
          },
          onError: (error: Error) => showFormError(form, error),
        };
        if (method)
          updateMethod.mutate(
            { id: method.id, input },
            {
              ...callbacks,
              onSuccess: () => {
                callbacks.onSuccess();
                onDone();
              },
            },
          );
        else
          createMethod.mutate(input, {
            ...callbacks,
            onSuccess: (id) => {
              callbacks.onSuccess();
              onDone(id);
            },
          });
      })}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required placeholder="Virement, carte, chèque…" data-autofocus {...form.getInputProps('name')} />
        <Group gap="lg">
          <Checkbox label="Pour les entrées" {...form.getInputProps('incoming', { type: 'checkbox' })} />
          <Checkbox label="Pour les sorties" {...form.getInputProps('outgoing', { type: 'checkbox' })} />
        </Group>
        <FormActions loading={createMethod.isPending || updateMethod.isPending} onCancel={() => onDone()} />
      </Stack>
    </form>
  );
}

/**
 * Counterparty: name, note, archived.
 * @param {{ counterparty?: TreasuryCounterparty, onDone: (createdId?: string) => void }} props Component props (`onDone` is given the id of the counterparty created).
 * @returns {JSX.Element} Form.
 */
export function CounterpartyForm({ counterparty, onDone }: { counterparty?: TreasuryCounterparty; onDone: (createdId?: string) => void }) {
  const { createCounterparty, updateCounterparty } = useTreasuryMutations();
  const form = useAppForm<{ name: string; note: string; archived: boolean }>({
    initialValues: { name: counterparty?.name ?? '', note: counterparty?.note ?? '', archived: counterparty?.archived ?? false },
    schema: treasuryCounterpartySchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(counterparty ? 'Tiers modifié.' : 'Tiers créé.');
          },
          onError: (error: Error) => showFormError(form, error),
        };
        const payload = { ...input, note: input.note || null };
        if (counterparty)
          updateCounterparty.mutate(
            { id: counterparty.id, input: payload },
            {
              ...callbacks,
              onSuccess: () => {
                callbacks.onSuccess();
                onDone();
              },
            },
          );
        else
          createCounterparty.mutate(payload, {
            ...callbacks,
            onSuccess: (id) => {
              callbacks.onSuccess();
              onDone(id);
            },
          });
      })}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required placeholder="Fournisseur, administration, banque…" data-autofocus {...form.getInputProps('name')} />
        <Textarea label="Note" autosize minRows={2} {...form.getInputProps('note')} />
        {counterparty && <Checkbox label="Archivé (n’est plus proposé)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        <FormActions loading={createCounterparty.isPending || updateCounterparty.isPending} onCancel={() => onDone()} />
      </Stack>
    </form>
  );
}

/**
 * Categories of one direction, as every settings list, in a tree: added (also as a sub-category), edited (name,
 * color, image, parent), put under another or reordered by drag and drop, deleted.
 * @param {{ direction: TreasuryDirection, categories: TreasuryCategory[] }} props Direction, and all categories.
 * @returns {JSX.Element} List.
 */
function CategoryList({ direction, categories }: { direction: TreasuryDirection; categories: TreasuryCategory[] }) {
  const { createCategory, updateCategory, deleteCategory, moveCategory } = useTreasuryMutations();
  /**
   * Input of a category from the form values.
   * @param {{ name: string, color: string, parentId: string | null }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; color: string; parentId: string | null }) => ({ name: values.name, color: values.color || null, direction, parentId: values.parentId });
  return (
    <SettingsList<TreasuryCategory, { direction: TreasuryDirection }>
      kind="TREASURY_CATEGORY"
      nested
      title={`Catégories de ${direction === 'IN' ? 'recettes' : 'dépenses'}`}
      description="En arborescence : glissez une catégorie sur une autre pour l’y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente."
      noun="la catégorie"
      items={categories.filter((category) => category.direction === direction)}
      usage={new Map(categories.map((category) => [category.id, category.entryCount]))}
      usageNoun="mouvements"
      storageKey={`treasury-categories-${direction}`}
      schema={treasuryCategorySchema}
      extra={{ initial: () => ({ direction }), render: () => null }}
      create={async (values) => createdId(await createCategory.mutateAsync(input(values)))}
      update={(id, values) => updateCategory.mutateAsync({ id, input: input(values) })}
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
  const { createMethod, updateMethod, deleteMethod } = useTreasuryMutations();
  /**
   * Input of a method from the form values.
   * @param {{ name: string, incoming: boolean, outgoing: boolean }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; incoming: boolean; outgoing: boolean }) => ({ name: values.name, incoming: values.incoming, outgoing: values.outgoing });
  return (
    <SettingsList<TreasuryPaymentMethod, { incoming: boolean; outgoing: boolean }>
      kind="TREASURY_PAYMENT_METHOD"
      title="Moyens de paiement"
      description="Virement, carte, chèque… pour les entrées, les sorties ou les deux."
      noun="le moyen de paiement"
      items={methods}
      usage={new Map(methods.map((method) => [method.id, method.entryCount]))}
      usageNoun="mouvements"
      colorRequired={false}
      schema={treasuryPaymentMethodSchema}
      extra={{
        initial: (method) => ({ incoming: method?.incoming ?? true, outgoing: method?.outgoing ?? true }),
        render: (form) => (
          <Group gap="lg">
            <Checkbox label="Pour les entrées" {...form.getInputProps('incoming', { type: 'checkbox' })} />
            <Checkbox label="Pour les sorties" {...form.getInputProps('outgoing', { type: 'checkbox' })} />
          </Group>
        ),
      }}
      create={async (values) => createdId(await createMethod.mutateAsync(input(values)))}
      update={(id, values) => updateMethod.mutateAsync({ id, input: input(values) })}
      remove={(id) => deleteMethod.mutateAsync(id)}
      renderBadges={(method) => (
        <>
          {method.incoming && (
            <Badge size="xs" variant="light" color="green">
              Entrées
            </Badge>
          )}
          {method.outgoing && (
            <Badge size="xs" variant="light" color="red">
              Sorties
            </Badge>
          )}
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
  const { createCounterparty, updateCounterparty, deleteCounterparty } = useTreasuryMutations();
  /**
   * Input of a counterparty from the form values.
   * @param {{ name: string, note: string, archived: boolean }} values Values.
   * @returns {object} Input.
   */
  const input = (values: { name: string; note: string; archived: boolean }) => ({ name: values.name, note: values.note || null, archived: values.archived });
  return (
    <SettingsList<TreasuryCounterparty, { note: string; archived: boolean }>
      kind="TREASURY_COUNTERPARTY"
      title="Tiers"
      description="Émetteurs et destinataires qui ne sont pas des clients : fournisseurs, administrations, banques… Les clients sont proposés d’office."
      noun="le tiers"
      items={counterparties}
      usage={new Map(counterparties.map((counterparty) => [counterparty.id, counterparty.entryCount]))}
      usageNoun="mouvements"
      colorRequired={false}
      schema={treasuryCounterpartySchema}
      extra={{
        initial: (counterparty) => ({ note: counterparty?.note ?? '', archived: counterparty?.archived ?? false }),
        render: (form) => (
          <>
            <Textarea label="Note" autosize minRows={2} {...form.getInputProps('note')} />
            <Checkbox label="Archivé (n’est plus proposé)" {...form.getInputProps('archived', { type: 'checkbox' })} />
          </>
        ),
      }}
      create={async (values) => createdId(await createCounterparty.mutateAsync(input(values)))}
      update={(id, values) => updateCounterparty.mutateAsync({ id, input: input(values) })}
      remove={(id) => deleteCounterparty.mutateAsync(id)}
      renderBadges={(counterparty) =>
        counterparty.archived && (
          <Badge size="xs" color="gray">
            Archivé
          </Badge>
        )
      }
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
    setInvoiceCategories.mutate({ ...current, ...changes }, { onSuccess: () => notifySuccess('Catégorie enregistrée.'), onError: onMutationError });
  return (
    <SettingsSection title="Factures et avoirs" description="Ce qui est attendu des factures validées (prévisionnel) et leurs règlements comptent dans les budgets de ces catégories.">
      {/* Side by side when the sidebar is wide enough (its width, not the window's). */}
      <SimpleGrid type="container" cols={{ base: 1, '520px': 2 }} spacing="sm">
        <Select
          label="Règlements des factures"
          placeholder="Aucune (hors budget)"
          clearable
          searchable
          {...treeSelectProps(categoryOptions(categories, 'IN'))}
          value={current.invoiceCategoryId}
          onChange={(value) => save({ invoiceCategoryId: value })}
        />
        <Select
          label="Remboursements des avoirs"
          placeholder="Aucune (hors budget)"
          clearable
          searchable
          {...treeSelectProps(categoryOptions(categories, 'OUT'))}
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
