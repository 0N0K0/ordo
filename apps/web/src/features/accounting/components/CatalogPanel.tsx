import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';

import { openFormPanel } from '../../../components/panels/panels';
import { Badge, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { ACCOUNTING_UNITS, catalogItemSchema, UNIT_LABELS, type CatalogItemInput } from '@ordo/shared';
import { PackageIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useArchivedToggle, useSetArchived } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { accountingQueryKey } from '../api';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableNumber, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { ON_ERROR } from '../../../lib/notify';
import { useCompanyProfile } from '../api';
import { useCatalogItems, useCatalogMutations, type CatalogItem } from '../api/catalog';
import * as fmt from '../../../lib/format';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { Comments } from '../../comments/components/Comments';
import { useCommentCounts } from '../../comments/api';
import { archiveItemsAction, deleteItemsAction, rowLabel, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { commentColumn } from '../../comments/lib/comment-column';
import { FormActions } from '../../../components/dialogs/FormActions';
import { vatRateOptions } from '../lib/labels';

/** Columns of the catalog. */
const CATALOG_COLUMNS: DataColumn<CatalogItem>[] = [
  { id: 'label', label: 'Article', size: 320, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
  {
    id: 'kind',
    bulk: true,
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
  { id: 'unit', label: 'Unité', size: 120, bulk: true, sortValue: (item) => UNIT_LABELS[item.unit].label, text: (item) => UNIT_LABELS[item.unit].label, groupable: true },
  { id: 'price', label: 'Prix HT', size: 120, bulk: true, numeric: true, sortValue: (item) => item.unitPrice, text: (item) => fmt.money(item.unitPrice) },
  {
    id: 'vat',
    bulk: true,
    label: 'TVA',
    size: 90,
    numeric: true,
    sortValue: (item) => (item.kind === 'DISBURSEMENT' ? null : item.vatRate),
    text: (item) => (item.kind === 'DISBURSEMENT' ? '' : `${fmt.percent(item.vatRate)}`),
    groupable: true,
  },
];

/**
 * Catalogue item form: kind, label, description, unit, price, VAT.
 * @param {{ item?: CatalogItem, onDone: () => void }} props Item to edit (none: new item) and close callback.
 * @returns {JSX.Element} Form.
 */
function CatalogItemForm({ item, onDone }: { item?: CatalogItem; onDone: () => void }) {
  const { data: company } = useCompanyProfile();
  const { create, update } = useCatalogMutations();
  const form = useAppForm<CatalogItemInput & Record<string, unknown>>({
    initialValues: {
      kind: (item?.kind as CatalogItemInput['kind']) ?? 'ITEM',
      label: item?.label ?? '',
      description: item?.description ?? '',
      unit: item?.unit ?? 'HOUR',
      unitPrice: item?.unitPrice ?? 0,
      vatRate: item?.vatRate ?? (company?.vatApplicable === false ? 0 : 20),
    },
    schema: catalogItemSchema,
  });
  const disbursement = form.values.kind === 'DISBURSEMENT';
  return (
    <Stack gap="lg">
      <form
        noValidate
        onSubmit={form.onSubmit(() => {
          const callbacks = formCallbacks(form, item ? 'Article modifié.' : 'Article ajouté au catalogue.', onDone);
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
          <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
          <Textarea label="Description" description="Reprise dans la ligne (markdown)." autosize minRows={2} {...form.getInputProps('description')} />
          <SimpleGrid cols={{ base: 1, sm: disbursement ? 2 : 3 }} spacing="sm">
            <Select label="Unité" allowDeselect={false} data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))} {...form.getInputProps('unit')} />
            <AmountInput label="Prix unitaire HT" {...form.getInputProps('unitPrice')} />
            {!disbursement && (
              <Select
                label="TVA"
                allowDeselect={false}
                data={vatRateOptions(form.values.vatRate)}
                value={String(form.values.vatRate)}
                onChange={(rate) => rate !== null && form.setFieldValue('vatRate', Number(rate))}
                error={form.errors.vatRate}
              />
            )}
          </SimpleGrid>
          <FormActions onCancel={onDone} loading={create.isPending || update.isPending} />
        </Stack>
      </form>
      {item && <Comments target="CATALOG_ITEM" id={item.id} readOnly={item.archived} />}
    </Stack>
  );
}

/**
 * Catalogue of products and services: default label, unit, price and VAT of the lines, added, edited,
 * archived (not offered any more, read only; hidden until « Afficher les archivés ») or restored, or deleted.
 * @returns {JSX.Element} Panel.
 */
export function CatalogPanel() {
  const { data: items, isPending } = useCatalogItems();
  const { remove, update } = useCatalogMutations();
  const setArchived = useSetArchived('CATALOG_ITEM', [accountingQueryKey]);

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
          label: item.label,
          description: item.description ?? null,
          unit: item.unit,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          ...change,
        },
      },
      ON_ERROR,
    );
  const itemComments = useCommentCounts(
    'CATALOG_ITEM',
    (items ?? []).map((item) => item.id),
  );
  const { shown, toggle: archivedToggle } = useArchivedToggle(items ?? []);
  const view = useDataView({
    tableKey: 'catalog',
    getKey: (item) => item.id,
    columns: [...CATALOG_COLUMNS, commentColumn<CatalogItem>(itemComments, (item) => item.id)],
    rows: shown,
    title: 'Catalogue',
  });
  // An archived item is read only (restored by « Restaurer » in its menu).
  const cellLabelOf = bulkCellLabels(view, (item: CatalogItem) => item.label);
  const bulk = bulkSaver(view, (item: CatalogItem, change: Partial<CatalogItemInput>) => !item.archived && saveItem(item, change));

  /**
   * Opens the item form.
   * @param {CatalogItem} [item] Item to edit. Optional.
   * @returns {void}
   */
  const openForm = (item?: CatalogItem) => {
    openFormPanel(item ? 'Modifier l’article' : 'Nouvel article', (close) => <CatalogItemForm item={item} onDone={close} />);
  };

  /**
   * « Supprimer » of items of the catalogue, on a row as on a selection.
   * @param {CatalogItem[]} rows Items.
   * @param {() => void} [clear] Clears the selection once done. Optional.
   * @returns {SelectionAction} Action.
   */
  const deleteItems = (rows: CatalogItem[], clear?: () => void) =>
    deleteItemsAction(rows, {
      noun: 'article',
      the: 'l’article',
      name: rowLabel,
      risks: (subject, one) =>
        `${subject} ${one ? 'sera supprimé' : 'seront supprimés'} du catalogue. Les documents qui ${one ? 'l’utilisent' : 'les utilisent'} gardent leurs lignes. Pour seulement ne plus ${one ? 'le' : 'les'} proposer, ${one ? 'archivez-le' : 'archivez-les'}.`,
      remove: (item) => remove.mutateAsync(item.id),
      clear,
    });

  if (isPending) return <TableSkeleton rows={4} />;

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['article', 'articles'], false)}
      selectionActions={(rows, clear) => [archiveItemsAction(rows, setArchived, { noun: 'article', clear }), deleteItems(rows, clear)]}
      bar={{
        searchLabel: 'Rechercher un article',
        actions: (
          <Group gap="md">
            <ShowArchivedSwitch {...archivedToggle} />
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
              Nouvel article
            </ActionButton>
          </Group>
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
      isArchived={(item) => item.archived}
      cells={(item) => ({
        label: (
          <>
            <Group gap={6} wrap="nowrap">
              <EditableText value={item.label} label={cellLabelOf('label', item, 'Libellé')} strong readOnly={item.archived} onSave={(label) => label && bulk('label')(item, { label })} />
              {item.archived && <ArchivedBadge size="xs" />}
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
            label={cellLabelOf('kind', item, 'Nature')}
            readOnly={item.archived}
            data={[
              { value: 'ITEM', label: 'Prestation' },
              { value: 'DISBURSEMENT', label: 'Débours' },
            ]}
            onSave={(kind) => kind && bulk('kind')(item, { kind: kind as CatalogItemInput['kind'] })}
          />
        ),
        unit: (
          <EditableSelect
            value={item.unit}
            label={cellLabelOf('unit', item, 'Unité')}
            readOnly={item.archived}
            data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))}
            onSave={(unit) => unit && bulk('unit')(item, { unit: unit as CatalogItemInput['unit'] })}
          />
        ),
        price: (
          <EditableNumber
            amount
            value={item.unitPrice}
            label={cellLabelOf('price', item, 'Prix HT')}
            readOnly={item.archived}
            signed={item.kind === 'DISBURSEMENT'}
            onSave={(unitPrice) => unitPrice !== null && bulk('price')(item, { unitPrice })}
          />
        ),
        vat:
          item.kind === 'DISBURSEMENT' ? (
            '—'
          ) : (
            <EditableSelect
              value={String(item.vatRate)}
              label={cellLabelOf('vat', item, 'TVA')}
              readOnly={item.archived}
              data={vatRateOptions(item.vatRate)}
              onSave={(rate) => rate && bulk('vat')(item, (target) => (target.kind === 'DISBURSEMENT' ? {} : { vatRate: Number(rate) }))}
            />
          ),
      })}
      actions={(item) => (
        <RowActions
          name={item.label}
          primary={!item.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(item) }}
          items={[archiveEntry({ archived: item.archived, type: 'Article', label: item.label }, setArchived, item.id), rowMenuEntry(deleteItems([item]))]}
        />
      )}
    />
  );
}
