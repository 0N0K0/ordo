import { listSelectProps } from '../../../components/items/item-look';
import { BackLink } from '../../../components/page/BackLink';
import { Group, Paper, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowLeftIcon, ClipboardTextIcon, CookingPotIcon, CopyIcon, ListPlusIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PageHeader } from '../../../components/page/PageHeader';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { EditableCheck, EditableNumber, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { openFormPanel } from '../../../components/panels/panels';

import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { Comments } from '../../comments/components/Comments';
import { useShoppingData } from '../../shopping/api';
import { ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { sheetsKey, useSheet, useSheetCategories, useSheetMutations, type SheetDetail, type SheetDetailItem } from '../api';
import { archiveWithUndo, unarchived, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { itemGroupFields, sheetInput, sheetItemInput } from '../lib/sheet-format';
import { AddRowField } from '../../../components/data-table/cells/AddRowField';
import type { RowGroup } from '../../../components/data-table/table/table-engine';
import { SheetsSettings } from '../components/SheetsSettings';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { optionalColumn, sheetShoppingColumns } from '../../shopping/lib/shopping-columns';
import { CategoryCell, ConservationCell, PeopleCell, StoreCell, UnitCell } from '../../shopping/components/shopping-cells';
import { usePeople } from '../../shopping/lib/shopping-format';
import { sheetItemSchema, shoppingItemSchema, type SheetItemInput } from '@ordo/shared';
import { SheetUseForm } from '../components/SheetUseForm';
import { countOf, plural } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';

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
  const baseNames = new Map((data?.shoppingBaseLists ?? []).map((baseList) => [baseList.id, baseList.name]));
  // The archived references are not offered.
  const products = unarchived(data?.shoppingProducts ?? []);
  const groups = [...new Set(products.map((product) => product.baseListId))].map((baseListId) => ({
    group: baseNames.get(baseListId) ?? '',
    items: products.filter((product) => product.baseListId === baseListId).map((product) => ({ value: product.id, label: product.name })),
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
          addProducts.mutate({ sheetId, productIds: ids }, { onSuccess: (count) => (notifySuccess(`${countOf(count, 'élément')} ${plural(count, 'ajouté')}.`), onDone()), onError: onMutationError })
        }
      />
    </Stack>
  );
}

/**
 * Name, project, categories and note of a sheet, saved as they change (the text when leaving its field); read only
 * when it is archived.
 * @param {{ sheet: SheetDetail }} props Sheet.
 * @returns {JSX.Element} Fields.
 */
function SheetFields({ sheet }: { sheet: SheetDetail }) {
  const { update } = useSheetMutations();
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  const [name, setName] = useState(sheet.name);
  const [note, setNote] = useState(sheet.note ?? '');
  const save = (change: Parameters<typeof sheetInput>[1]) => update.mutate({ id: sheet.id, input: sheetInput(sheet, change) }, { onError: onMutationError });
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="Nom"
            required
            readOnly={sheet.archived}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => (name.trim() && name.trim() !== sheet.name ? save({ name: name.trim() }) : setName(sheet.name))}
          />
          {context && (
            <ProjectSelect
              context={context}
              label="Projet"
              placeholder="Aucun : fiche de l’espace"
              clearable={!sheet.archived}
              readOnly={sheet.archived}
              value={sheet.projectId ?? null}
              onChange={(projectId) => projectId !== (sheet.projectId ?? null) && save({ projectId: projectId || null })}
            />
          )}
          <BatchMultiSelect
            label="Catégories"
            placeholder={sheet.categoryIds.length ? undefined : 'Aucune'}
            searchable
            readOnly={sheet.archived}
            {...listSelectProps(categories ?? [], undefined, sheet.categoryIds)}
            value={sheet.categoryIds}
            onChange={(categoryIds) => save({ categoryIds })}
          />
        </SimpleGrid>
        <Textarea
          label="Note"
          autosize
          minRows={1}
          maxRows={8}
          readOnly={sheet.archived}
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          onBlur={() => note !== (sheet.note ?? '') && save({ note: note || null })}
        />
      </Stack>
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
  const products = shopping?.shoppingProducts ?? [];
  // The archived references are not offered (but the current one).
  const offeredProducts = unarchived(products);
  const productName = new Map(products.map((product) => [product.id, product.name]));
  const shoppingCategories = shopping?.shoppingCategories ?? [];
  const people = usePeople();
  const comments = useCommentCounts(
    'SHEET_ITEM',
    (sheet?.items ?? []).map((item) => item.id),
  );
  const columns: DataColumn<SheetDetailItem>[] = [
    { id: 'label', label: 'Élément', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
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
  const view = useDataView({ tableKey: 'sheet-items', getKey: (item) => item.id, columns, rows: sheet?.items ?? [], title: sheet?.name ?? 'Fiche' });
  const onError = { onError: onMutationError };
  const bulk = bulkSaver<SheetDetailItem, ItemChange>(
    view,
    (item, change) => !sheet?.archived && Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: sheetItemInput(item, change) }, onError),
  );

  if (isPending) return <DetailSkeleton />;
  if (!sheet)
    return (
      <EmptyState
        icon={<ClipboardTextIcon aria-hidden />}
        message="Cette fiche n’existe pas ou a été supprimée."
        action={
          <ActionButton priority="secondary" to="/sheets" icon={<ArrowLeftIcon aria-hidden />}>
            Retour aux fiches
          </ActionButton>
        }
      />
    );

  const locked = sheet.archived;
  const remove = {
    label: 'Supprimer',
    icon: <TrashIcon aria-hidden />,
    danger: true,
    onClick: () =>
      confirmDestructive({
        title: 'Supprimer la fiche',
        risks: `« ${sheet.name} » et ses ${countOf(sheet.items.length, 'élément')} seront supprimés définitivement. Les listes d’achats et les listes à cocher déjà faites la gardent.`,
        onConfirm: () => mutations.remove.mutate(sheet.id, { onSuccess: () => (notifySuccess('Fiche supprimée.'), navigate('/sheets')), ...onError }),
      }),
  };

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
          const product = offeredProducts.find((other) => other.name.toLocaleLowerCase('fr') === text.toLocaleLowerCase('fr'));
          return mutations.addItem.mutateAsync({
            sheetId: sheet.id,
            input: {
              productId: product?.id ?? null,
              label: product?.name ?? text,
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
      <BackLink to="/sheets">Fiches</BackLink>
      <PageHeader
        title={
          sheet.archived ? (
            <Group gap="xs" component="span">
              {sheet.name}
              <ArchivedBadge feminine />
            </Group>
          ) : (
            sheet.name
          )
        }
        description={`${countOf(sheet.items.length, 'élément')}${sheet.usedBy ? ` · rattachée à ${countOf(sheet.usedBy, 'routine')}, ${plural(sheet.usedBy, 'évènement')} ou ${plural(sheet.usedBy, 'tâche')}` : ''}`}
        actions={
          sheet.archived ? (
            <ActionButton
              priority="secondary"
              icon={<ArrowCounterClockwiseIcon aria-hidden />}
              onClick={() => void archiveWithUndo(setArchived, { ids: [sheet.id], archived: false, label: `Fiche « ${sheet.name} »`, feminine: true })}
              menu={[remove]}
            >
              Restaurer
            </ActionButton>
          ) : (
            <ActionButton
              priority="secondary"
              icon={<CookingPotIcon aria-hidden />}
              onClick={() => openFormPanel(`Utiliser « ${sheet.name} »`, (close) => <SheetUseForm sheetId={sheet.id} name={sheet.name} onDone={close} />)}
              menu={[
                {
                  label: 'Dupliquer',
                  icon: <CopyIcon aria-hidden />,
                  onClick: () => mutations.duplicate.mutate(sheet.id, { onSuccess: (copy) => (notifySuccess('Fiche dupliquée.'), navigate(`/sheets/${copy}`)), ...onError }),
                },
                {
                  label: 'Archiver',
                  icon: <ArchiveIcon aria-hidden />,
                  onClick: () => void archiveWithUndo(setArchived, { ids: [sheet.id], archived: true, label: `Fiche « ${sheet.name} »`, feminine: true }),
                },
                remove,
              ]}
            >
              Utiliser cette fiche
            </ActionButton>
          )
        }
      />
      {/* Made again once saved (its texts are those of the sheet). */}
      <SheetFields key={`${sheet.id}:${sheet.updatedAt}`} sheet={sheet} />
      <DataTable
        framed
        view={view}
        selectionLabel={(count) => selectedLabel(count, ['élément', 'éléments'], false)}
        readOnly={locked ? () => true : undefined}
        selectionActions={
          locked
            ? undefined
            : (rows, clear) => [
                deleteRowsAction([rows], {
                  label: 'Retirer',
                  title: 'Retirer les éléments',
                  risks: `${countOf(rows.length, 'élément')} seront retirés de la fiche.`,
                  remove: (items) => mutations.removeItems.mutateAsync(items.map((item) => item.id)),
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
          label: <EditableText value={item.label} readOnly={locked} label={`Libellé de ${item.label}`} strong onSave={(next) => next && bulk('label')(item, { label: next })} />,
          product: (
            <EditableSelect
              value={item.productId ?? null}
              readOnly={locked}
              label={`Référence de ${item.label}`}
              nullable
              data={unarchived(products, item.productId).map((product) => ({ value: product.id, label: product.name }))}
              onSave={(productId) => bulk('product')(item, { productId })}
            />
          ),
          category: (
            <CategoryCell
              value={item.categoryId ?? null}
              categories={shoppingCategories}
              readOnly={locked}
              label={`Catégorie de ${item.label}`}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: (
            <EditableNumber value={item.quantity ?? null} readOnly={locked} label={`Quantité de ${item.label}`} decimals={3} nullable onSave={(quantity) => bulk('quantity')(item, { quantity })} />
          ),
          unit: <UnitCell value={item.unit ?? null} readOnly={locked} label={`Unité de ${item.label}`} onSave={(unit) => bulk('unit')(item, { unit })} />,
          consumable: <EditableCheck value={item.consumable} readOnly={locked} label={`${item.label} consommable`} onSave={(consumable) => bulk('consumable')(item, { consumable })} />,
          store: (
            <StoreCell
              value={item.storeId ?? null}
              stores={shopping?.shoppingStores ?? []}
              readOnly={locked}
              label={`Magasin de ${item.label}`}
              onSave={(storeId) => bulk('store')(item, { storeId })}
            />
          ),
          conservation: (
            <ConservationCell
              perishable={item.perishable}
              storageId={item.storageId ?? null}
              storages={shopping?.shoppingStorages ?? []}
              readOnly={locked}
              label={`Conservation de ${item.label}`}
              onSave={(conservation) => bulk('conservation')(item, conservation)}
            />
          ),
          people: (
            <PeopleCell
              memberIds={item.memberIds}
              relationIds={item.relationIds}
              readOnly={locked}
              label={`Bénéficiaires de ${item.label}`}
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
              label={`Lien vers ${item.label}`}
              placeholder="https://…"
              schema={shoppingItemSchema.shape.url}
              onSave={(url) => bulk('url')(item, { url })}
            />
          ),
          optional: <EditableCheck value={item.optional} readOnly={locked} label={`${item.label} facultatif`} onSave={(optional) => bulk('optional')(item, { optional })} />,
          note: <EditableText value={item.note ?? null} readOnly={locked} label={`Description de ${item.label}`} nullable onSave={(note) => bulk('note')(item, { note })} />,
        })}
        actions={(item) => (
          <RowActions
            name={item.label}
            primary={{ label: 'Commentaires', icon: <PlusIcon aria-hidden />, onClick: () => openFormPanel(`Commentaires · ${item.label}`, () => <Comments target="SHEET_ITEM" id={item.id} />) }}
            items={[
              !locked && {
                label: 'Retirer',
                icon: <TrashIcon aria-hidden />,
                danger: true,
                onClick: () =>
                  confirmDestructive({
                    title: 'Retirer l’élément',
                    risks: `« ${item.label} » sera retiré de la fiche, avec ses commentaires. Les listes déjà faites le gardent.`,
                    onConfirm: () => mutations.removeItems.mutate([item.id], onError),
                  }),
              },
            ]}
          />
        )}
      />
      <SheetsSettings />
    </Stack>
  );
}
