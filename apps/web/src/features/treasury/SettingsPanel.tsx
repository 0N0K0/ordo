import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { treasuryCategorySchema, treasuryCounterpartySchema, treasuryPaymentMethodSchema, type TreasuryDirection } from '@ordo/shared';
import { AddressBookIcon, CreditCardIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryMutations, useTreasurySettings, type TreasuryCategory, type TreasuryCounterparty, type TreasuryPaymentMethod } from './api';
import { categoryOptions, categoryTree } from './categories';
import { confirmDeletion } from './confirm-deletion';

const DIRECTION_LABELS: Record<TreasuryDirection, string> = { IN: 'Entrées', OUT: 'Sorties' };

/**
 * Number of entries using an item.
 * @param {number} count Count.
 * @returns {string} "3 mouvements".
 */
const entries = (count: number) => `${count} mouvement${count > 1 ? 's' : ''}`;

/**
 * Edit and delete buttons of a settings row.
 * @param {{ label: string, onEdit: () => void, onDelete: () => void }} props Component props.
 * @returns {JSX.Element} Buttons.
 */
function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <Group gap={2} justify="flex-end" wrap="nowrap">
      <Tooltip label="Modifier">
        <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${label}`} onClick={onEdit}>
          <PencilSimpleIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Supprimer">
        <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${label}`} onClick={onDelete}>
          <TrashIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * Empty state of a settings list.
 * @param {{ icon: ReactNode, children: ReactNode }} props Component props.
 * @returns {JSX.Element} Empty state.
 */
function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Stack align="center" gap="xs" py="md">
      <ThemeIcon size="lg" radius="xl" variant="light" color="gray">
        {icon}
      </ThemeIcon>
      <Text size="sm" c="dimmed" ta="center">
        {children}
      </Text>
    </Stack>
  );
}

/**
 * Form actions: cancel, then save.
 * @param {{ loading: boolean, onCancel: () => void }} props Component props.
 * @returns {JSX.Element} Buttons.
 */
function FormActions({ loading, onCancel }: { loading: boolean; onCancel: () => void }) {
  return (
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" loading={loading}>
        Enregistrer
      </Button>
    </Group>
  );
}

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
  const form = useAppForm<{ name: string; direction: TreasuryDirection; parentId: string | null }>({
    initialValues: { name: category?.name ?? '', direction: category?.direction ?? direction, parentId: category?.parentId ?? parentId },
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
          data={categoryOptions(categories, form.values.direction, category?.id)}
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

type Dialog =
  | { kind: 'category'; category?: TreasuryCategory; direction?: TreasuryDirection; parentId?: string | null }
  | { kind: 'method'; method?: TreasuryPaymentMethod }
  | { kind: 'counterparty'; counterparty?: TreasuryCounterparty }
  | null;

/**
 * Categories of one direction, as a tree: add a sub-category, edit, delete.
 * @param {object} props Component props.
 * @param {TreasuryDirection} props.direction Direction.
 * @param {TreasuryCategory[]} props.categories All categories.
 * @param {(dialog: Dialog) => void} props.open Opens a form.
 * @returns {JSX.Element} List.
 */
function CategoryList({ direction, categories, open }: { direction: TreasuryDirection; categories: TreasuryCategory[]; open: (dialog: Dialog) => void }) {
  const { deleteCategory } = useTreasuryMutations();
  const tree = categoryTree(categories, direction);
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Title order={3} size="h5">
          Catégories de {direction === 'IN' ? 'recettes' : 'dépenses'}
        </Title>
        <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => open({ kind: 'category', direction })}>
          Catégorie
        </Button>
      </Group>
      {tree.length === 0 ? (
        <Empty icon={<TagIcon aria-hidden />}>Aucune catégorie de {DIRECTION_LABELS[direction].toLowerCase()}.</Empty>
      ) : (
        <Table verticalSpacing={4}>
          <Table.Tbody>
            {tree.map(({ category, depth, path }) => (
              <Table.Tr key={category.id}>
                <Table.Td style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}>
                  <Text size="sm" fw={depth === 0 ? 600 : undefined}>
                    {category.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {category.entryCount ? entries(category.entryCount) : ''}
                  </Text>
                </Table.Td>
                <Table.Td w={1}>
                  <Group gap={2} wrap="nowrap" justify="flex-end">
                    <Tooltip label="Ajouter une sous-catégorie">
                      <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter une sous-catégorie à ${path}`} onClick={() => open({ kind: 'category', direction, parentId: category.id })}>
                        <PlusIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <RowActions
                      label={path}
                      onEdit={() => open({ kind: 'category', category })}
                      onDelete={() =>
                        confirmDeletion(
                          'Supprimer la catégorie',
                          `« ${path} » sera supprimée définitivement.${category.entryCount ? ` Ses ${entries(category.entryCount)} n’auront plus de catégorie.` : ''} Ses sous-catégories remonteront d’un niveau.`,
                          () => deleteCategory.mutate(category.id, { onSuccess: () => notifySuccess('Catégorie supprimée.'), onError: (error) => notifyError(error.message) }),
                        )
                      }
                    />
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}

/**
 * Treasury settings: categories of money in and out (with sub-categories), payment methods and the
 * counterparties that are not clients.
 * @returns {JSX.Element} Panel.
 */
export function SettingsPanel() {
  const { data: settings, isPending } = useTreasurySettings();
  const { deleteMethod, deleteCounterparty } = useTreasuryMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const onError = (error: Error) => notifyError(error.message);
  if (isPending || !settings) return <Skeleton height={320} />;
  const { treasuryCategories: categories, treasuryPaymentMethods: methods, treasuryCounterparties: counterparties } = settings;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <CategoryList direction="IN" categories={categories} open={setDialog} />
        <CategoryList direction="OUT" categories={categories} open={setDialog} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Title order={3} size="h5">
              Moyens de paiement
            </Title>
            <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'method' })}>
              Moyen de paiement
            </Button>
          </Group>
          {methods.length === 0 ? (
            <Empty icon={<CreditCardIcon aria-hidden />}>Aucun moyen de paiement.</Empty>
          ) : (
            <Table verticalSpacing={4}>
              <Table.Tbody>
                {methods.map((method) => (
                  <Table.Tr key={method.id}>
                    <Table.Td>
                      <Text size="sm">{method.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
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
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {method.entryCount ? entries(method.entryCount) : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td w={1}>
                      <RowActions
                        label={method.name}
                        onEdit={() => setDialog({ kind: 'method', method })}
                        onDelete={() =>
                          confirmDeletion(
                            'Supprimer le moyen de paiement',
                            `« ${method.name} » sera supprimé définitivement.${method.entryCount ? ` Ses ${entries(method.entryCount)} n’auront plus de moyen de paiement.` : ''}`,
                            () => deleteMethod.mutate(method.id, { onSuccess: () => notifySuccess('Moyen de paiement supprimé.'), onError }),
                          )
                        }
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Title order={3} size="h5">
              Tiers
            </Title>
            <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'counterparty' })}>
              Tiers
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            Émetteurs et destinataires qui ne sont pas des clients : fournisseurs, administrations, banques… Les clients sont proposés d’office.
          </Text>
          {counterparties.length === 0 ? (
            <Empty icon={<AddressBookIcon aria-hidden />}>Aucun tiers.</Empty>
          ) : (
            <Table verticalSpacing={4}>
              <Table.Tbody>
                {counterparties.map((counterparty) => (
                  <Table.Tr key={counterparty.id} opacity={counterparty.archived ? 0.6 : 1}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm">{counterparty.name}</Text>
                        {counterparty.archived && (
                          <Badge size="xs" color="gray">
                            Archivé
                          </Badge>
                        )}
                      </Group>
                      {counterparty.note && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {counterparty.note}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {counterparty.entryCount ? entries(counterparty.entryCount) : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td w={1}>
                      <RowActions
                        label={counterparty.name}
                        onEdit={() => setDialog({ kind: 'counterparty', counterparty })}
                        onDelete={() =>
                          confirmDeletion(
                            'Supprimer le tiers',
                            `« ${counterparty.name} » sera supprimé définitivement.${counterparty.entryCount ? ` Ses ${entries(counterparty.entryCount)} n’auront plus d’émetteur ou de destinataire : archivez-le plutôt pour les garder.` : ''}`,
                            () => deleteCounterparty.mutate(counterparty.id, { onSuccess: () => notifySuccess('Tiers supprimé.'), onError }),
                          )
                        }
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </SimpleGrid>

      <Modal
        opened={dialog !== null}
        onClose={close}
        title={
          dialog?.kind === 'category'
            ? dialog.category
              ? 'Modifier la catégorie'
              : 'Nouvelle catégorie'
            : dialog?.kind === 'method'
              ? dialog.method
                ? 'Modifier le moyen de paiement'
                : 'Nouveau moyen de paiement'
              : dialog?.counterparty
                ? 'Modifier le tiers'
                : 'Nouveau tiers'
        }
      >
        {dialog?.kind === 'category' && <CategoryForm category={dialog.category} direction={dialog.direction} parentId={dialog.parentId} categories={categories} onDone={close} />}
        {dialog?.kind === 'method' && <MethodForm method={dialog.method} onDone={close} />}
        {dialog?.kind === 'counterparty' && <CounterpartyForm counterparty={dialog.counterparty} onDone={close} />}
      </Modal>
    </Stack>
  );
}
