import { Anchor, Button, Group, Paper, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { ArrowLeftIcon, ClipboardTextIcon, CookingPotIcon, CopyIcon, ListPlusIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ActionButton } from '../../components/actions/ActionButton';
import { PageHeader } from '../../components/actions/PageHeader';
import { DataTable } from '../../components/data-table/DataTable';
import { applyDiff, bulkSaver } from '../../components/data-table/bulk-edit';
import type { DataColumn } from '../../components/data-table/data-table';
import { EditableCheck, EditableNumber, EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { RowActions } from '../../components/data-table/RowActions';
import { useDataView } from '../../components/data-table/use-data-view';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../components/feedback/EmptyState';
import { DetailSkeleton } from '../../components/feedback/Skeletons';
import { openFormPanel } from '../../components/panels/panels';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { categoryTree } from '../../components/category-tree/category-tree';
import * as fmt from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useCommentCounts } from '../comments/api';
import { commentColumn } from '../comments/comment-column';
import { Comments } from '../comments/Comments';
import { useShoppingData } from '../shopping/api';
import { shoppingCategoryOptions } from '../shopping/shopping-format';
import { ProjectSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useSheet, useSheetCategories, useSheetMutations, type SheetDetail, type SheetDetailItem } from './api';
import { sheetInput, sheetItemInput } from './sheet-format';
import { SheetsSettings } from './SheetsSettings';
import { deleteRowsAction } from '../../components/data-table/selection-actions';
import { selectedLabel } from '../../components/data-table/selection-label';
import { optionalColumn, sheetShoppingColumns } from '../shopping/shopping-columns';
import { ConservationCell, PeopleCell, StoreCell } from '../shopping/shopping-cells';
import { usePeople } from '../shopping/shopping-format';
import { shoppingItemSchema, type SheetItemInput } from '@ordo/shared';
import { SheetUseForm } from './SheetUseForm';

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
  const groups = [...new Set((data?.shoppingProducts ?? []).map((product) => product.baseListId))].map((baseListId) => ({
    group: baseNames.get(baseListId) ?? '',
    items: (data?.shoppingProducts ?? []).filter((product) => product.baseListId === baseListId).map((product) => ({ value: product.id, label: product.name })),
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
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          disabled={!ids.length}
          loading={addProducts.isPending}
          onClick={() =>
            addProducts.mutate(
              { sheetId, productIds: ids },
              { onSuccess: (count) => (notifySuccess(`${count} élément${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''}.`), onDone()), onError: (error) => notifyError(error.message) },
            )
          }
        >
          Ajouter
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Name, project, categories and note of a sheet, saved as they change (the text when leaving its field).
 * @param {{ sheet: SheetDetail }} props Sheet.
 * @returns {JSX.Element} Fields.
 */
function SheetFields({ sheet }: { sheet: SheetDetail }) {
  const { update } = useSheetMutations();
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  const [name, setName] = useState(sheet.name);
  const [note, setNote] = useState(sheet.note ?? '');
  const save = (change: Parameters<typeof sheetInput>[1]) => update.mutate({ id: sheet.id, input: sheetInput(sheet, change) }, { onError: (error) => notifyError(error.message) });
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="Nom"
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => (name.trim() && name.trim() !== sheet.name ? save({ name: name.trim() }) : setName(sheet.name))}
          />
          {context && (
            <ProjectSelect
              context={context}
              label="Projet"
              placeholder="Aucun : fiche de l’espace"
              clearable
              value={sheet.projectId ?? null}
              onChange={(projectId) => projectId !== (sheet.projectId ?? null) && save({ projectId: projectId || null })}
            />
          )}
          <BatchMultiSelect
            label="Catégories"
            placeholder={sheet.categoryIds.length ? undefined : 'Aucune'}
            searchable
            data={(categories ?? []).map((category) => ({ value: category.id, label: category.name }))}
            value={sheet.categoryIds}
            onChange={(categoryIds) => save({ categoryIds })}
          />
        </SimpleGrid>
        <Textarea
          label="Note"
          autosize
          minRows={1}
          maxRows={8}
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
 * their comments); items added by their label, or from the references.
 * @returns {JSX.Element} Page.
 */
export function SheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sheet, isPending } = useSheet(id);
  const { data: shopping } = useShoppingData();
  const mutations = useSheetMutations();
  const [label, setLabel] = useState('');
  const products = shopping?.shoppingProducts ?? [];
  const productName = new Map(products.map((product) => [product.id, product.name]));
  const shoppingCategories = shopping?.shoppingCategories ?? [];
  const people = usePeople();
  const paths = new Map(categoryTree(shoppingCategories).map((item) => [item.category.id, item.path]));
  const comments = useCommentCounts(
    'SHEET_ITEM',
    (sheet?.items ?? []).map((item) => item.id),
  );
  const categoryName = (item: SheetDetailItem) => (item.categoryId ? (paths.get(item.categoryId) ?? '') : '');
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
    {
      id: 'category',
      label: 'Catégorie',
      size: 170,
      bulk: true,
      sortValue: (item) => categoryName(item) || null,
      text: categoryName,
      filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: [...paths].map(([value, name]) => ({ value, label: name })) },
      groupable: true,
    },
    {
      id: 'quantity',
      label: 'Quantité',
      size: 100,
      numeric: true,
      bulk: true,
      sortValue: (item) => item.quantity ?? null,
      text: (item) => (item.quantity === null || item.quantity === undefined ? '' : fmt.number(item.quantity, 3)),
      filter: { kind: 'number', value: (item) => item.quantity ?? null },
    },
    { id: 'unit', label: 'Unité', size: 90, bulk: true, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '', groupable: true },
    {
      id: 'consumable',
      label: 'Consommable',
      size: 120,
      bulk: true,
      sortValue: (item) => (item.consumable ? 1 : 0),
      text: (item) => (item.consumable ? 'Consommable' : ''),
      filter: { kind: 'boolean', value: (item) => item.consumable },
      groupable: true,
    },
    // As the items of the shopping lists.
    ...sheetShoppingColumns<SheetDetailItem>({
      categories: shoppingCategories,
      stores: shopping?.shoppingStores ?? [],
      storages: shopping?.shoppingStorages ?? [],
      members: people.members,
      relations: people.relations,
    }),
    optionalColumn<SheetDetailItem>(),
    { id: 'note', label: 'Description', size: 240, bulk: true, sortValue: (item) => item.note ?? null, text: (item) => item.note ?? '' },
    commentColumn<SheetDetailItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
  const view = useDataView({ tableKey: 'sheet-items', getKey: (item) => item.id, columns, rows: sheet?.items ?? [], title: sheet?.name ?? 'Fiche' });
  const onError = { onError: (error: Error) => notifyError(error.message) };
  const bulk = bulkSaver<SheetDetailItem, ItemChange>(
    view,
    (item, change) => Object.keys(change).length > 0 && mutations.updateItem.mutate({ id: item.id, input: sheetItemInput(item, change) }, onError),
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

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/sheets" size="sm">
        <ArrowLeftIcon aria-hidden style={{ verticalAlign: 'middle' }} /> Fiches
      </Anchor>
      <PageHeader
        title={sheet.name}
        description={`${sheet.items.length} élément${sheet.items.length > 1 ? 's' : ''}${sheet.usedBy ? ` · rattachée à ${sheet.usedBy} routine(s), évènement(s) ou tâche(s)` : ''}`}
        actions={
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
                label: 'Supprimer',
                icon: <TrashIcon aria-hidden />,
                danger: true,
                onClick: () =>
                  confirmDestructive({
                    title: 'Supprimer la fiche',
                    risks: `« ${sheet.name} » et ses ${sheet.items.length} élément(s) seront supprimés définitivement. Les listes d’achats et les listes à cocher déjà faites la gardent.`,
                    onConfirm: () => mutations.remove.mutate(sheet.id, { onSuccess: () => (notifySuccess('Fiche supprimée.'), navigate('/sheets')), ...onError }),
                  }),
              },
            ]}
          >
            Utiliser cette fiche
          </ActionButton>
        }
      />
      {/* Made again once saved (its texts are those of the sheet). */}
      <SheetFields key={`${sheet.id}:${String(sheet.updatedAt)}`} sheet={sheet} />
      <DataTable
        framed
        view={view}
        selectionLabel={(count) => selectedLabel(count, ['élément', 'éléments'], false)}
        selectionActions={(rows, clear) => [
          deleteRowsAction([rows], {
            label: 'Retirer',
            title: 'Retirer les éléments',
            risks: `${rows.length} élément(s) seront retirés de la fiche.`,
            remove: (items) => mutations.removeItems.mutateAsync(items.map((item) => item.id)),
            done: `${rows.length} élément(s) retiré(s).`,
            clear,
          }),
        ]}
        verticalSpacing="xs"
        bar={{
          searchLabel: 'Rechercher (élément, description)',
          actions: (
            <ActionButton
              icon={<ListPlusIcon aria-hidden />}
              priority="secondary"
              onClick={() => openFormPanel('Ajouter des produits des références', (close) => <SheetProductsForm sheetId={sheet.id} onDone={close} />)}
            >
              Depuis les références
            </ActionButton>
          ),
        }}
        empty={<EmptyState icon={<ClipboardTextIcon aria-hidden />} message="Aucun élément : tapez-en un ci-dessous, ou ajoutez des produits des références." />}
        getKey={(item) => item.id}
        cells={(item) => ({
          label: <EditableText value={item.label} label={`Libellé de ${item.label}`} strong onSave={(next) => next && bulk('label')(item, { label: next })} />,
          product: (
            <EditableSelect
              value={item.productId ?? null}
              label={`Référence de ${item.label}`}
              nullable
              data={products.map((product) => ({ value: product.id, label: product.name }))}
              onSave={(productId) => bulk('product')(item, { productId })}
            />
          ),
          category: (
            <EditableSelect
              value={item.categoryId ?? null}
              label={`Catégorie de ${item.label}`}
              nullable
              {...treeSelectProps(shoppingCategoryOptions(shoppingCategories))}
              onSave={(categoryId) => bulk('category')(item, { categoryId })}
            />
          ),
          quantity: <EditableNumber value={item.quantity ?? null} label={`Quantité de ${item.label}`} decimals={3} nullable onSave={(quantity) => bulk('quantity')(item, { quantity })} />,
          unit: <EditableText value={item.unit ?? null} label={`Unité de ${item.label}`} nullable onSave={(unit) => bulk('unit')(item, { unit })} />,
          consumable: <EditableCheck value={item.consumable} label={`${item.label} consommable`} onSave={(consumable) => bulk('consumable')(item, { consumable })} />,
          store: <StoreCell value={item.storeId ?? null} stores={shopping?.shoppingStores ?? []} label={`Magasin de ${item.label}`} onSave={(storeId) => bulk('store')(item, { storeId })} />,
          conservation: (
            <ConservationCell
              perishable={item.perishable}
              storageId={item.storageId ?? null}
              storages={shopping?.shoppingStorages ?? []}
              label={`Conservation de ${item.label}`}
              onSave={(conservation) => bulk('conservation')(item, conservation)}
            />
          ),
          people: (
            <PeopleCell
              memberIds={item.memberIds}
              relationIds={item.relationIds}
              label={`Bénéficiaires de ${item.label}`}
              projectIds={sheet.projectId ? [sheet.projectId] : undefined}
              onSave={(chosen) =>
                bulk('people')(item, (target) => ({
                  memberIds: applyDiff(target.memberIds, item.memberIds, chosen.memberIds),
                  relationIds: applyDiff(target.relationIds, item.relationIds, chosen.relationIds),
                }))
              }
            />
          ),
          url: (
            <EditableText link value={item.url ?? null} label={`Lien vers ${item.label}`} placeholder="https://…" schema={shoppingItemSchema.shape.url} onSave={(url) => bulk('url')(item, { url })} />
          ),
          optional: <EditableCheck value={item.optional} label={`${item.label} facultatif`} onSave={(optional) => bulk('optional')(item, { optional })} />,
          note: <EditableText value={item.note ?? null} label={`Description de ${item.label}`} nullable onSave={(note) => bulk('note')(item, { note })} />,
        })}
        actions={(item) => (
          <RowActions
            name={item.label}
            primary={{ label: 'Commentaires', icon: <PlusIcon aria-hidden />, onClick: () => openFormPanel(`Commentaires · ${item.label}`, () => <Comments target="SHEET_ITEM" id={item.id} />) }}
            items={[
              {
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = label.trim();
          if (!text) return;
          // A label that is a reference becomes it (its category and unit with it).
          const product = products.find((other) => other.name.toLocaleLowerCase('fr') === text.toLocaleLowerCase('fr'));
          mutations.addItem.mutate(
            {
              sheetId: sheet.id,
              input: {
                productId: product?.id ?? null,
                label: product?.name ?? text,
                categoryId: product?.categoryId ?? null,
                quantity: null,
                unit: product?.unit ?? null,
                note: null,
                consumable: product?.consumable ?? true,
              },
            },
            { onSuccess: () => setLabel(''), ...onError },
          );
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <TextInput style={{ flex: 1 }} aria-label="Ajouter un élément" placeholder="Ajouter un élément (Entrée)" value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
          <Button type="submit" variant="default" leftSection={<PlusIcon aria-hidden />} disabled={!label.trim()} loading={mutations.addItem.isPending}>
            Ajouter
          </Button>
        </Group>
      </form>
      <SheetsSettings />
    </Stack>
  );
}
