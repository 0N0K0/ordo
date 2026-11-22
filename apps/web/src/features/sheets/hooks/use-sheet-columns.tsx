import { useShoppingData } from '../../shopping/api';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import type { DataColumn, YesNoStates } from '../../../components/data-table/table/data-table';
import { itemChoices } from '../../../components/items/item-look';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { optionalColumn, sheetShoppingColumns } from '../../shopping/lib/shopping-columns';
import { usePeople } from '../../shopping/lib/shopping-format';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { useSheetCategories, type ChecklistItem, type Sheet, type SheetCategory, type SheetDetail, type SheetDetailItem } from '../api';


/** States of « Fait » of an item of a checklist, on its state buttons. */
export const CHECKLIST_DONE_STATES: YesNoStates = {
  labels: { yes: 'Collecté', no: 'À collecter' },
  toggleLabels: { yes: 'Marquer comme collecté', no: 'Marquer comme à collecter' },
};
/**
 * Columns of the sheets.
 * @param {TaskContext | null} context Names of the projects.
 * @param {SheetCategory[]} categories Categories of the sheets.
 * @param {boolean} inProject Shown in the tab of a project (its column hidden by default).
 * @returns {DataColumn<Sheet>[]} Columns.
 */
function sheetColumns(context: TaskContext | null, categories: SheetCategory[], inProject: boolean): DataColumn<Sheet>[] {
  const projectLabelOf = (sheet: Sheet) => (sheet.projectId ? (context?.projectLabel(sheet.projectId) ?? '') : '');
  const categoryLabel = new Map(categories.map((category) => [category.id, category.label]));
  const categoryText = (sheet: Sheet) =>
    sheet.categoryIds
      .map((id) => categoryLabel.get(id) ?? '')
      .filter(Boolean)
      .join(', ');
  const itemText = (item: Sheet['items'][number]) => `${item.label}${fmt.quantity(item) ? ` · ${fmt.quantity(item)}` : ''}`;
  return [
    { id: 'label', required: true, label: 'Libellé', size: 240, locked: true, sortValue: (sheet) => sheet.label, text: (sheet) => sheet.label },
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      bulk: true,
      sortValue: (sheet) => categoryText(sheet) || null,
      text: categoryText,
      filter: {
        kind: 'choices',
        value: (sheet) => sheet.categoryIds,
        options: itemChoices(categories),
      },
      groupable: true,
    },
    {
      id: 'project',
      label: 'Projet',
      size: 200,
      bulk: true,
      hiddenByDefault: inProject,
      sortValue: (sheet) => projectLabelOf(sheet) || null,
      text: projectLabelOf,
      filter: {
        kind: 'choice',
        value: (sheet) => sheet.projectId ?? null,
        options: context?.projectOptions(context.projects) ?? [],
      },
      groupable: true,
    },
    { id: 'items', label: 'Éléments', size: 320, text: (sheet) => sheet.items.map(itemText).join(', ') },
    {
      id: 'usedBy',
      required: true,
      label: 'Rattachée à',
      size: 130,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (sheet) => sheet.usedBy,
      text: (sheet) => fmt.count(sheet.usedBy),
      filter: { kind: 'number', value: (sheet) => sheet.usedBy },
    },
    {
      id: 'updatedAt',
      required: true,
      label: 'Modifiée le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (sheet) => sheet.updatedAt,
      text: (sheet) => fmt.day(sheet.updatedAt),
      filter: { kind: 'date', value: (sheet) => localDay(sheet.updatedAt) },
    },
  ];
}

/**
 * Columns of the table of the sheets: on the sheets pages and tabs, and in the settings.
 * @param {boolean} inProject Shown in the tab of a project (its column hidden by default).
 * @returns {DataColumn<Sheet>[]} Columns.
 */
export function useSheetColumns(inProject: boolean): DataColumn<Sheet>[] {
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  return sheetColumns(context, categories ?? [], inProject);
}

/**
 * Columns of the table of the items of a sheet: on its page, and in the settings (no sheet: no comment counted).
 * @param {SheetDetail | null | undefined} sheet Sheet.
 * @returns {DataColumn<SheetDetailItem>[]} Columns.
 */
export function useSheetItemColumns(sheet: SheetDetail | null | undefined): DataColumn<SheetDetailItem>[] {
  const { data: shopping } = useShoppingData();
  const products = shopping?.shoppingProducts ?? [];
  const productName = new Map(products.map((product) => [product.id, product.label]));
  const shoppingCategories = shopping?.shoppingCategories ?? [];
  const people = usePeople();
  const comments = useCommentCounts(
    'SHEET_ITEM',
    (sheet?.items ?? []).map((item) => item.id),
  );
  return [
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
}

/**
 * Columns of the table of a checklist (of a task, a routine or an event occurrence): in its panel, and in the settings
 * of the sheets (no checklist).
 * @param {{ items: readonly ChecklistItem[] } | null | undefined} list Checklist.
 * @returns {DataColumn<ChecklistItem>[]} Columns.
 */
export function useChecklistColumns(list: { items: readonly ChecklistItem[] } | null | undefined): DataColumn<ChecklistItem>[] {
  const { data: shopping } = useShoppingData();
  const categories = shopping?.shoppingCategories ?? [];
  return [
    booleanColumn<ChecklistItem>({ id: 'done', label: 'Fait', size: 70, bulk: true, groupLabels: { yes: 'Collectés', no: 'À collecter' }, value: (item) => Boolean(item.checkedAt) }),
    { id: 'label', required: true, label: 'Élément', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    quantityColumn<ChecklistItem>(),
    unitColumn<ChecklistItem>(),
    categoryColumn<ChecklistItem>(categories, { size: 160 }),
    consumableColumn<ChecklistItem>({ hiddenByDefault: true }),
    noteColumn<ChecklistItem>({ hiddenByDefault: true }),
    {
      id: 'sources',
      label: 'Fiches',
      size: 170,
      text: (item) => item.sources.map((source) => source.label).join(', '),
      filter: {
        kind: 'choices',
        value: (item) => item.sources.map((source) => source.sheetId),
        options: [...new Map((list?.items ?? []).flatMap((item) => item.sources.map((source) => [source.sheetId, source.label] as const)))].map(([value, label]) => ({ value, label })),
      },
      groupable: true,
    },
  ];
}
