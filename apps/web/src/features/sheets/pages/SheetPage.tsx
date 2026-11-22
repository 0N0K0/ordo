import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { formCallbacks, useAppForm, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { listSelectProps } from '../../../components/items/item-look';

import { PAGES, sheetPath } from '../../../app/pages';
import { Paper, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { ClipboardTextIcon, CookingPotIcon, ListPlusIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PageHeader } from '../../../components/page/PageHeader';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { EditableCheck, EditableNumber, EditableSelect, EditableText, EditableMarkdown } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { openFormPanel } from '../../../components/panels/panels';

import { ON_ERROR } from '../../../lib/notify';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { Comments } from '../../comments/components/Comments';
import { useShoppingData } from '../../shopping/api';
import { ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { sheetsKey, useSheet, useSheetCategories, useSheetMutations, type SheetDetail, type SheetDetailItem } from '../api';
import { archiveEntry, unarchived, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { itemGroupFields, sheetInput, sheetItemInput } from '../lib/sheet-format';
import { AddRowField } from '../../../components/data-table/cells/AddRowField';
import type { RowGroup } from '../../../components/data-table/table/table-engine';
import { SheetsPageSettings } from '../components/SheetsSettings';
import { deleteRowsAction, duplicateRowsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { optionalColumn, sheetShoppingColumns } from '../../shopping/lib/shopping-columns';
import { CategoryCell, ConservationCell, PeopleCell, StoreCell, UnitCell } from '../../shopping/components/shopping-cells';
import { usePeople } from '../../shopping/lib/shopping-format';
import { sheetItemSchema, sheetSchema, shoppingItemSchema, type SheetInput, type SheetItemInput } from '@ordo/shared';
import { SheetUseForm } from '../components/SheetUseForm';
import { countOf, plural, sameName } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { DetailHeader } from '../../../components/page/DetailHeader';
import { SavedCountdownsField } from '../../countdowns/components/SavedCountdownsField';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { sheetCountdownItem } from '../lib/sheet-countdowns';
import { deleteSheetsAction } from '../lib/delete-sheets';

type ItemChange = Partial<Omit<SheetItemInput, 'id'>>;

/**
 * Products of the references added to a sheet at once.
 * @param {{ sheetId: string, onDone: () => void }} props Sheet, and what follows.
 * @returns {JSX.Element} Form.
 */
function SheetProductsForm({ sheetId, onDone }: { sheetId: string; onDone: () => void }) {
  const { data } = useShoppingData();
  const { addProducts } = useSheetMutations();
  const [ids, setIds] = useState<string[]>([]);
  const baseNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.label]));
  // The archived references are not offered.
  const products = unarchived(data?.shoppingProducts ?? []);
  const groups = [...new Set(products.map((product) => product.baseListId))].map((baseListId) => ({
    group: baseNames.get(baseListId) ?? '',
    items: products.filter((product) => product.baseListId === baseListId).map((product) => ({ value: product.id, label: product.label })),
  }));
  return (
    <Stack gap="md">
      <BatchMultiSelect
        label="Produits des références"
        placeholder="Rechercher un produit…"
        searchable
        data={groups}
        value={ids}
        onChange={setIds}
        data-autofocus
        comboboxProps={{ withinPortal: false }}
      />
      <FormActions
        onCancel={onDone}
        submitLabel="Ajouter"
        disabled={!ids.length}
        loading={addProducts.isPending}
        onSubmit={() =>
          addProducts.mutate(
            { sheetId, productIds: ids },
            formCallbacks(null, (count) => `${countOf(count, 'élément')} ${plural(count, 'ajouté')}.`, onDone),
          )
        }
      />
    </Stack>
  );
}

/** Values of the fields of a sheet. */
type SheetValues = SheetInput & Record<string, unknown>;

/**
 * Fields of a sheet as the form holds them.
 * @param {SheetDetail} sheet Sheet.
 * @returns {SheetValues} Values.
 */
const sheetValues = (sheet: SheetDetail): SheetValues => sheetInput(sheet, {});

/**
 * Name, project, categories and note of a sheet, each saved as soon as it changes (the texts on leaving them,
 * `useFieldSave`, `SaveStatus`), the sheet of the cache followed; read only when it is archived. Its saved timers
 * (« Minuteurs », saved on their own).
 * @param {{ sheet: SheetDetail }} props Sheet.
 * @returns {JSX.Element} Fields.
 */
function SheetFields({ sheet }: { sheet: SheetDetail }) {
  const { update } = useSheetMutations();
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  const base = useAppForm<SheetValues>({ initialValues: sheetValues(sheet), schema: sheetSchema });
  const { form, saving } = useFieldSave(base, {
    save: (_changes, values) => update.mutateAsync({ id: sheet.id, input: { ...values, note: values.note || null } }),
    schema: sheetSchema,
    saved: sheetValues(sheet),
    onBlur: ['label', 'note'],
    readOnly: sheet.archived,
  });
  return (
    <Paper withBorder radius="md" p="md">
      <form noValidate onSubmit={form.onSubmit(() => undefined)}>
        <Stack gap="sm">
          {!sheet.archived && <SaveStatus saving={saving} />}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextInput label="Libellé" required readOnly={sheet.archived} {...form.getInputProps('label')} />
            {context && (
              <ProjectSelect
                context={context}
                label="Projet"
                placeholder="Aucun : fiche de l’espace"
                clearable={!sheet.archived}
                readOnly={sheet.archived}
                {...form.getInputProps('projectId')}
                onChange={(projectId) => form.setFieldValue('projectId', projectId || null)}
              />
            )}
            <BatchMultiSelect
              label="Catégories"
              placeholder={form.values.categoryIds.length ? undefined : 'Aucune'}
              searchable
              readOnly={sheet.archived}
              {...listSelectProps(categories ?? [], undefined, sheet.categoryIds)}
              {...form.getInputProps('categoryIds')}
            />
          </SimpleGrid>
          <Textarea label="Note" autosize minRows={1} maxRows={8} readOnly={sheet.archived} {...form.getInputProps('note')} value={form.values.note ?? ''} />
          <SavedCountdownsField target="SHEET" id={sheet.id} value={sheet.savedCountdownIds} invalidate={[sheetsKey]} readOnly={sheet.archived} />
        </Stack>
      </form>
    </Paper>
  );
}

/**
 * Page of a sheet: its fields, and its items in a table like every other (each field changed in place, and in bulk;
 * their comments); items added by their label, or from the references. Archived, it is read only (« Restaurer »,
 * « Supprimer »).
 * @returns {JSX.Element} Page.
 */
export function SheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sheet, isPending } = useSheet(id);
  const { data: shopping } = useShoppingData();
  const mutations = useSheetMutations();
  const setArchived = useSetArchived('SHEET', [sheetsKey]);
  const countdownEntries = useCountdownMenuEntries();
  const products = shopping?.shoppingProducts ?? [];
  // The archived references are not offered (but the current one).
  const offeredProducts = unarchived(products);
  const productName = new Map(products.map((product) => [product.id, product.label]));
  const shoppingCategories = shopping?.shoppingCategories ?? [];
  const people = usePeople();
  const comments = useCommentCounts(
    'SHEET_ITEM',
    (sheet?.items ?? []).map((item) => item.id),
  );
  const columns: DataColumn<SheetDetailItem>[] = [
    { id: 'label', required: true, label: 'Élément', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    {
      id: 'product',
      label: 'Référence',
      size: 180,
      bulk: true,
      sortValue: (item) => (item.productId ? (productName.get(item.productId) ?? '') : null),
      text: (item) => (item.productId ? (productName.get(item.productId) ?? '') : ''),
      filter: { kind: 'boolean', value: (item) => Boolean(item.productId) },
      groupable: true,
    },
    categoryColumn<SheetDetailItem>(shoppingCategories),
    quantityColumn<SheetDetailItem>(),
    unitColumn<SheetDetailItem>({ groupable: true }),
    consumableColumn<SheetDetailItem>(),
    // As the items of the shopping lists.
    ...sheetShoppingColumns<SheetDetailItem>({
      categories: shoppingCategories,
      stores: shopping?.shoppingStores ?? [],
      storages: shopping?.shoppingStorages ?? [],
      members: people.members,
      relations: people.relations,
      archivedPeople: people.archived,
    }),
    optionalColumn<SheetDetailItem>(),
    noteColumn<SheetDetailItem>({ size: 240 }),
    commentColumn<SheetDetailItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
  const view = useDataView({ tableKey: 'sheet-items', getKey: (item) => item.id, columns, rows: sheet?.items ?? [], title: sheet?.label ?? 'Fiche' });
  const cellLabelOf = bulkCellLabels(view, (item) => item.label);
  const bulk = bulkSaver<SheetDetailItem, ItemChange>(
    view,
    (item, change) => !sheet?.archived && Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: sheetItemInput(item, change) }, ON_ERROR),
  );

  if (isPending) return <DetailSkeleton />;
  if (!sheet) return <DetailNotFound what="Cette fiche" feminine backTo={PAGES.sheets.path} backLabel={PAGES.sheets.label} />;

  const locked = sheet.archived;
  const remove = rowMenuEntry(deleteSheetsAction([sheet], (row) => mutations.remove.mutateAsync(row.id).then(() => navigate(PAGES.sheets.path))));

  /**
   * Row adding an item by its label, at the end of the table or of a group (the item takes the value of its group); a
   * label that is a reference becomes it (its category and unit with it). None while archived.
   * @param {RowGroup<SheetDetailItem> | null} group Group it adds to (null: the table).
   * @returns {ReactNode} Add row, or nothing.
   */
  const addRow = (group: RowGroup<SheetDetailItem> | null): ReactNode => {
    const fields = group && view.groupColumn ? itemGroupFields(view.groupColumn.id, group.key) : {};
    if (locked || !fields) return null;
    return (
      <AddRowField
        label="Ajouter un élément"
        where={`dans ${group?.label ?? 'la fiche'}`}
        schema={sheetItemSchema.shape.label}
        onCreate={(text) => {
          const product = offeredProducts.find((other) => sameName(other.label, text));
          return mutations.addItem.mutateAsync({
            sheetId: sheet.id,
            input: {
              productId: product?.id ?? null,
              label: product?.label ?? text,
              categoryId: product?.categoryId ?? null,
              quantity: null,
              unit: product?.unit ?? null,
              note: null,
              consumable: product?.consumable ?? true,
              ...fields,
            },
          });
        }}
      />
    );
  };

  return (
    <Stack gap="lg">
      <DetailHeader
        back={{ to: PAGES.sheets.path, label: PAGES.sheets.label }}
        page={<PageHeader title={PAGES.sheets.label} />}
        title={sheet.label}
        badges={sheet.archived && <ArchivedBadge feminine />}
        subtitle={
          <Text size="sm" c="dimmed">
            {`${countOf(sheet.items.length, 'élément')}${sheet.usedBy ? ` · rattachée à ${countOf(sheet.usedBy, 'routine')}, ${plural(sheet.usedBy, 'évènement')} ou ${plural(sheet.usedBy, 'tâche')}` : ''}`}
          </Text>
        }
        actions={
          !sheet.archived && (
            <ActionButton
              priority="secondary"
              icon={<CookingPotIcon aria-hidden />}
              onClick={() => openFormPanel(`Utiliser « ${sheet.label} »`, (close) => <SheetUseForm sheetId={sheet.id} label={sheet.label} onDone={close} />)}
            >
              Utiliser cette fiche
            </ActionButton>
          )
        }
        menu={{
          name: sheet.label,
          items: [
            // Saved at once, then its page opens.
            !sheet.archived &&
              rowMenuEntry(duplicateRowsAction([sheet], { duplicate: (source) => mutations.duplicate.mutateAsync(source.id), done: 'Fiche dupliquée.', open: (copy) => void navigate(sheetPath(copy)) })),
            archiveEntry({ archived: sheet.archived, type: 'Fiche', label: sheet.label, feminine: true }, setArchived, sheet.id),
            remove,
            // « Lancer » its saved timers.
            ...(sheet.archived ? [] : countdownEntries(sheet, sheetCountdownItem(sheet))),
          ],
        }}
      />
      <SheetFields key={sheet.id} sheet={sheet} />
      <DataTable
        framed
        view={view}
        selectionLabel={(count) => selectedLabel(count, ['élément', 'éléments'], false)}
        readOnly={locked ? () => true : undefined}
        selectionActions={
          locked
            ? undefined
            : (rows, clear) => [
                deleteRowsAction(rows, {
                  label: 'Retirer',
                  title: 'Retirer les éléments',
                  risks: `${countOf(rows.length, 'élément')} ${plural(rows.length, 'sera retiré', 'seront retirés')} de la fiche.`,
                  removeAll: (items) => mutations.removeItems.mutateAsync(items.map((item) => item.id)),
                  done: `${countOf(rows.length, 'élément')} ${plural(rows.length, 'retiré')}.`,
                  clear,
                }),
              ]
        }
        verticalSpacing="xs"
        bar={{
          searchLabel: 'Rechercher (élément, description)',
          actions: (
            <ActionButton
              icon={<ListPlusIcon aria-hidden />}
              priority="secondary"
              disabled={locked}
              onClick={() => openFormPanel('Ajouter des produits des références', (close) => <SheetProductsForm sheetId={sheet.id} onDone={close} />)}
            >
              Depuis les références
            </ActionButton>
          ),
        }}
        empty={
          <EmptyState
            icon={<ClipboardTextIcon aria-hidden />}
            message={locked ? 'Aucun élément.' : 'Aucun élément : tapez-en un ci-dessous, ou ajoutez des produits des références.'}
            action={addRow(null)}
          />
        }
        addRow={locked ? undefined : addRow}
        getKey={(item) => item.id}
        cells={(item) => ({
          label: <EditableText value={item.label} readOnly={locked} label={cellLabelOf('label', item, 'Libellé')} strong onSave={(next) => next && bulk('label')(item, { label: next })} />,
          product: (
            <EditableSelect
              value={item.productId ?? null}
              readOnly={locked}
              label={cellLabelOf('product', item, 'Référence')}
              nullable
              data={unarchived(products, item.productId).map((product) => ({ value: product.id, label: product.label }))}
              onSave={(productId) => bulk('product')(item, { productId })}
            />
          ),
          category: (
            <CategoryCell
              value={item.categoryId ?? null}
              categories={shoppingCategories}
              readOnly={locked}
              label={cellLabelOf('category', item, 'Catégorie')}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: (
            <EditableNumber
              value={item.quantity ?? null}
              readOnly={locked}
              label={cellLabelOf('quantity', item, 'Quantité')}
              decimals={3}
              nullable
              onSave={(quantity) => bulk('quantity')(item, { quantity })}
            />
          ),
          unit: <UnitCell value={item.unit ?? null} readOnly={locked} label={cellLabelOf('unit', item, 'Unité')} onSave={(unit) => bulk('unit')(item, { unit })} />,
          consumable: (
            <EditableCheck value={item.consumable} readOnly={locked} label={cellLabelOf('consumable', item, 'Consommable')} onSave={(consumable) => bulk('consumable')(item, { consumable })} />
          ),
          store: (
            <StoreCell
              value={item.storeId ?? null}
              stores={shopping?.shoppingStores ?? []}
              readOnly={locked}
              label={cellLabelOf('store', item, 'Magasin')}
              onSave={(storeId) => bulk('store')(item, { storeId })}
            />
          ),
          conservation: (
            <ConservationCell
              perishable={item.perishable}
              storageId={item.storageId ?? null}
              storages={shopping?.shoppingStorages ?? []}
              readOnly={locked}
              label={cellLabelOf('conservation', item, 'Conservation')}
              onSave={(conservation) => bulk('conservation')(item, conservation)}
            />
          ),
          people: (
            <PeopleCell
              memberIds={item.memberIds}
              relationIds={item.relationIds}
              readOnly={locked}
              label={cellLabelOf('people', item, 'Bénéficiaires')}
              onSave={(chosen) =>
                bulk('people')(item, (target) => ({
                  memberIds: applyDiff(target.memberIds, item.memberIds, chosen.memberIds),
                  relationIds: applyDiff(target.relationIds, item.relationIds, chosen.relationIds),
                }))
              }
            />
          ),
          url: (
            <EditableText
              link
              value={item.url ?? null}
              readOnly={locked}
              label={cellLabelOf('url', item, 'Lien')}
              placeholder="https://…"
              schema={shoppingItemSchema.shape.url}
              onSave={(url) => bulk('url')(item, { url })}
            />
          ),
          optional: <EditableCheck value={item.optional} readOnly={locked} label={cellLabelOf('optional', item, 'Facultatif')} onSave={(optional) => bulk('optional')(item, { optional })} />,
          note: <EditableMarkdown value={item.note ?? null} readOnly={locked} label={cellLabelOf('note', item, 'Description')} onSave={(note) => bulk('note')(item, { note })} />,
        })}
        actions={(item) => (
          <RowActions
            name={item.label}
            primary={{
              label: 'Commentaires',
              icon: <PlusIcon aria-hidden />,
              onClick: () => openFormPanel(`Commentaires · ${item.label}`, () => <Comments target="SHEET_ITEM" id={item.id} readOnly={sheet.archived} />),
            }}
            items={[
              !locked && {
                label: 'Retirer',
                icon: <TrashIcon aria-hidden />,
                danger: true,
                onClick: () =>
                  confirmDestructive({
                    title: 'Retirer l’élément',
                    risks: `« ${item.label} » sera retiré de la fiche, avec ses commentaires. Les listes déjà faites le gardent.`,
                    run: () => mutations.removeItems.mutateAsync([item.id]),
                  }),
              },
            ]}
          />
        )}
      />
      <SheetsPageSettings />
    </Stack>
  );
}
