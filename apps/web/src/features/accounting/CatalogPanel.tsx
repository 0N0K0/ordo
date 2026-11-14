import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { closePanel, openPanel } from '../../components/panels/panels';
import { Badge, Button, Checkbox, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { ACCOUNTING_UNITS, catalogItemSchema, formatMoney, UNIT_LABELS, VAT_RATES, type CatalogItemInput } from '@ordo/shared';
import { PackageIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { DataTable } from '../../components/data-table/DataTable';
import { EditableCheck, EditableNumber, EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { useDataView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useCompanyProfile } from './api';
import { useCatalogItems, useCatalogMutations, type CatalogItem } from './catalog-api';

let modalCount = 0;

/** Columns of the catalog. */
const CATALOG_COLUMNS: DataColumn<CatalogItem>[] = [
  { id: 'title', label: 'Article', size: 320, locked: true, sortValue: (item) => item.title, text: (item) => item.title },
  {
    id: 'kind',
    label: 'Nature',
    size: 120,
    hiddenByDefault: true,
    sortValue: (item) => item.kind,
    text: (item) => (item.kind === 'DISBURSEMENT' ? 'Débours' : 'Prestation'),
    filter: {
      kind: 'choice',
      value: (item) => (item.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'ITEM'),
      options: [
        { value: 'ITEM', label: 'Prestation' },
        { value: 'DISBURSEMENT', label: 'Débours' },
      ],
    },
    groupable: true,
  },
  { id: 'unit', label: 'Unité', size: 120, sortValue: (item) => UNIT_LABELS[item.unit].label, text: (item) => UNIT_LABELS[item.unit].label, groupable: true },
  { id: 'price', label: 'Prix HT', size: 120, numeric: true, sortValue: (item) => item.unitPrice, text: (item) => formatMoney(Math.round(item.unitPrice * 100)) },
  {
    id: 'vat',
    label: 'TVA',
    size: 90,
    numeric: true,
    sortValue: (item) => (item.kind === 'DISBURSEMENT' ? null : item.vatRate),
    text: (item) => (item.kind === 'DISBURSEMENT' ? '' : `${item.vatRate.toLocaleString('fr-FR')} %`),
    groupable: true,
  },
  {
    id: 'archived',
    label: 'Archivé',
    size: 100,
    hiddenByDefault: true,
    sortValue: (item) => (item.archived ? 1 : 0),
    text: (item) => (item.archived ? 'Archivé' : 'Actif'),
    filter: { kind: 'boolean', value: (item) => item.archived },
    groupable: true,
  },
];

/** Views made the first time the catalogue is shown: the items offered, the archived ones. */
const CATALOG_VIEWS = [
  {
    name: 'Actifs',
    config: {
      filter: { type: 'group' as const, id: 'root', combinator: 'and' as const, children: [{ type: 'condition' as const, id: 'archived', field: 'archived', operator: 'isFalse', value: null }] },
    },
  },
  {
    name: 'Archivés',
    config: {
      filter: { type: 'group' as const, id: 'root', combinator: 'and' as const, children: [{ type: 'condition' as const, id: 'archived', field: 'archived', operator: 'isTrue', value: null }] },
    },
  },
  { name: 'Tous' },
];

/**
 * Catalogue item form: kind, title, description, unit, price, VAT.
 * @param {{ item?: CatalogItem, onDone: () => void }} props Item to edit (none: new item) and close callback.
 * @returns {JSX.Element} Form.
 */
function CatalogItemForm({ item, onDone }: { item?: CatalogItem; onDone: () => void }) {
  const { data: company } = useCompanyProfile();
  const { create, update } = useCatalogMutations();
  const form = useAppForm<CatalogItemInput & Record<string, unknown>>({
    initialValues: {
      kind: (item?.kind as CatalogItemInput['kind']) ?? 'ITEM',
      title: item?.title ?? '',
      description: item?.description ?? '',
      unit: item?.unit ?? 'HOUR',
      unitPrice: item?.unitPrice ?? 0,
      vatRate: item?.vatRate ?? (company?.vatApplicable === false ? 0 : 20),
      archived: item?.archived ?? false,
    },
    schema: catalogItemSchema,
  });
  const disbursement = form.values.kind === 'DISBURSEMENT';
  return (
    <form
      noValidate
      onSubmit={form.onSubmit(() => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(item ? 'Article modifié.' : 'Article ajouté au catalogue.');
            onDone();
          },
          onError: (error: Error) => showFormError(form, error),
        };
        // The raw values: the API validates (and trims) them.
        if (item) update.mutate({ id: item.id, input: form.values }, callbacks);
        else create.mutate(form.values, callbacks);
      })}
    >
      <Stack gap="sm">
        <SegmentedControl
          data={[
            { value: 'ITEM', label: 'Produit ou service' },
            { value: 'DISBURSEMENT', label: 'Débours' },
          ]}
          {...form.getInputProps('kind')}
          onChange={(kind) => form.setValues({ kind: kind as CatalogItemInput['kind'], ...(kind === 'DISBURSEMENT' && { vatRate: 0, unit: 'FLAT' }) })}
        />
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('title')} />
        <Textarea label="Description" description="Reprise dans la ligne (markdown)." autosize minRows={2} {...form.getInputProps('description')} />
        <SimpleGrid cols={{ base: 1, sm: disbursement ? 2 : 3 }} spacing="sm">
          <Select label="Unité" allowDeselect={false} data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))} {...form.getInputProps('unit')} />
          <NumberInput label="Prix unitaire HT" decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" {...form.getInputProps('unitPrice')} />
          {!disbursement && (
            <Select
              label="TVA"
              allowDeselect={false}
              data={[...new Set([...VAT_RATES, form.values.vatRate])].map((rate) => ({ value: String(rate), label: `${rate.toLocaleString('fr-FR')} %` }))}
              value={String(form.values.vatRate)}
              onChange={(rate) => rate !== null && form.setFieldValue('vatRate', Number(rate))}
              error={form.errors.vatRate}
            />
          )}
        </SimpleGrid>
        {item && <Checkbox label="Archivé (n’est plus proposé dans les documents)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Catalogue of products and services: default title, unit, price and VAT of the lines, added, edited,
 * archived or deleted.
 * @returns {JSX.Element} Panel.
 */
export function CatalogPanel() {
  const { data: items, isPending } = useCatalogItems();
  const { remove, update } = useCatalogMutations();

  /**
   * Saves a field of an item changed in its cell.
   * @param {CatalogItem} item Item.
   * @param {Partial<CatalogItemInput>} change Change.
   * @returns {void}
   */
  const saveItem = (item: CatalogItem, change: Partial<CatalogItemInput>) =>
    update.mutate(
      {
        id: item.id,
        input: {
          kind: item.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'ITEM',
          title: item.title,
          description: item.description ?? null,
          unit: item.unit,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          archived: item.archived,
          ...change,
        },
      },
      { onError: (error) => notifyError(error.message) },
    );
  const view = useDataView({ tableKey: 'catalog', columns: CATALOG_COLUMNS, rows: items ?? [], title: 'Catalogue', first: CATALOG_VIEWS });

  /**
   * Opens the item form.
   * @param {CatalogItem} [item] Item to edit. Optional.
   * @returns {void}
   */
  const openForm = (item?: CatalogItem) => {
    const modalId = `catalog-item-${++modalCount}`;
    openPanel({ panelId: modalId, title: item ? 'Modifier l’article' : 'Nouvel article', children: <CatalogItemForm item={item} onDone={() => closePanel(modalId)} /> });
  };

  /**
   * Asks for confirmation before deleting an item.
   * @param {CatalogItem} item Item.
   * @returns {void}
   */
  const confirmDelete = (item: CatalogItem) => {
    confirmDestructive({
      title: 'Supprimer l’article',
      risks: (
        <>
          <Text size="sm">« {item.title} » sera supprimé du catalogue. Les documents qui l’utilisent gardent leurs lignes. Pour seulement ne plus le proposer, archivez-le.</Text>
        </>
      ),
      onConfirm: () => {
        remove.mutate(item.id, { onSuccess: () => notifySuccess('Article supprimé.'), onError: (error) => notifyError(error.message) });
      },
    });
  };

  if (isPending) return <TableSkeleton rows={4} />;

  return (
    <DataTable
      framed
      view={view}
      bar={{
        searchLabel: 'Rechercher un article',
        actions: (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouvel article
          </ActionButton>
        ),
      }}
      empty={
        <EmptyState
          icon={<PackageIcon aria-hidden />}
          message="Catalogue vide. Ajoutez vos prestations (journée, heure, forfait…) avec leur prix et leur TVA : vous les ajouterez aux documents en un clic."
        />
      }
      verticalSpacing="xs"
      getKey={(item) => item.id}
      rowProps={(item) => ({ opacity: item.archived ? 0.6 : 1 })}
      cells={(item) => ({
        title: (
          <>
            <Group gap={6} wrap="nowrap">
              <EditableText value={item.title} label={`Libellé de ${item.title}`} strong onSave={(title) => title && saveItem(item, { title })} />
              {item.kind === 'DISBURSEMENT' && (
                <Badge size="xs" variant="light" color="grape" style={{ flex: 'none' }}>
                  Débours
                </Badge>
              )}
            </Group>
            {item.description && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {item.description}
              </Text>
            )}
          </>
        ),
        kind: (
          <EditableSelect
            value={item.kind}
            label={`Nature de ${item.title}`}
            data={[
              { value: 'ITEM', label: 'Prestation' },
              { value: 'DISBURSEMENT', label: 'Débours' },
            ]}
            onSave={(kind) => kind && saveItem(item, { kind: kind as CatalogItemInput['kind'] })}
          />
        ),
        unit: (
          <EditableSelect
            value={item.unit}
            label={`Unité de ${item.title}`}
            data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))}
            onSave={(unit) => unit && saveItem(item, { unit: unit as CatalogItemInput['unit'] })}
          />
        ),
        price: (
          <EditableNumber
            value={item.unitPrice}
            label={`Prix HT de ${item.title}`}
            suffix="€"
            signed={item.kind === 'DISBURSEMENT'}
            onSave={(unitPrice) => unitPrice !== null && saveItem(item, { unitPrice })}
          />
        ),
        vat:
          item.kind === 'DISBURSEMENT' ? (
            '—'
          ) : (
            <EditableSelect
              value={String(item.vatRate)}
              label={`TVA de ${item.title}`}
              data={[...new Set([...VAT_RATES, item.vatRate])].map((rate) => ({ value: String(rate), label: `${rate.toLocaleString('fr-FR')} %` }))}
              onSave={(rate) => rate && saveItem(item, { vatRate: Number(rate) })}
            />
          ),
        archived: <EditableCheck value={item.archived} label={`${item.title} archivé`} onSave={(archived) => saveItem(item, { archived })} />,
      })}
      actions={(item) => (
        <RowActions
          name={item.title}
          primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(item) }}
          items={[{ label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(item) }]}
        />
      )}
    />
  );
}
