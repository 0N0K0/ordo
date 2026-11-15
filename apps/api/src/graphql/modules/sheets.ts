import type { SheetSource } from '@ordo/shared';
import { readSheetSources } from '@ordo/shared';
import { prisma } from '../../db';
import * as sheets from '../../services/sheets';
import * as stock from '../../services/stock';
import { builder } from '../builder';

const float = (value: { toNumber(): number } | null) => (value === null ? null : value.toNumber());

/** Share of a sheet in an item of a list. */
export const SheetSourceRef = builder.objectRef<SheetSource>('SheetSource').implement({
  description: 'Share of a sheet in an item of a shopping list or of a checklist.',
  fields: (t) => ({
    sheetId: t.exposeID('sheetId'),
    name: t.exposeString('name', { description: 'Name of the sheet when it was added.' }),
    quantity: t.exposeFloat('quantity', { nullable: true }),
  }),
});

builder.prismaObject('SheetItem', {
  description: 'Item of a sheet: a product of the references, or a label of its own.',
  fields: (t) => ({
    id: t.exposeID('id'),
    productId: t.exposeID('productId', { nullable: true }),
    label: t.exposeString('label'),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    quantity: t.float({ nullable: true, resolve: (item) => float(item.quantity) }),
    unit: t.exposeString('unit', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    consumable: t.exposeBoolean('consumable', { description: 'Used up when the sheet is used (taken from the stock).' }),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('SheetCategory', {
  description: 'Category of the sheets (flat, set in the settings).',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('Sheet', {
  description: 'Sheet: products and items used together (a recipe, a suitcase…), added to shopping lists or made a checklist of.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    note: t.exposeString('note', { nullable: true }),
    projectId: t.exposeID('projectId', { nullable: true }),
    categoryIds: t.idList({ select: { categories: { select: { id: true } } }, resolve: (sheet) => sheet.categories.map((category) => category.id) }),
    position: t.exposeInt('position'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    items: t.relation('items', { query: { orderBy: { position: 'asc' } } }),
    usedBy: t.int({ description: 'Routines, events and tasks it is attached to.', select: { _count: { select: { links: true } } }, resolve: (sheet) => sheet._count.links }),
  }),
});

builder.prismaObject('SheetLink', {
  description: 'Sheet of a routine, an event or a task, times a multiplier.',
  fields: (t) => ({
    id: t.exposeID('id'),
    sheetId: t.exposeID('sheetId'),
    multiplier: t.float({ resolve: (link) => link.multiplier.toNumber() }),
    routineId: t.exposeID('routineId', { nullable: true }),
    eventId: t.exposeID('eventId', { nullable: true }),
    taskId: t.exposeID('taskId', { nullable: true }),
  }),
});

builder.prismaObject('ChecklistItem', {
  description: 'Item of a checklist, ticked when done.',
  fields: (t) => ({
    id: t.exposeID('id'),
    listId: t.exposeID('listId'),
    productId: t.exposeID('productId', { nullable: true }),
    label: t.exposeString('label'),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    quantity: t.float({ nullable: true, resolve: (item) => float(item.quantity) }),
    unit: t.exposeString('unit', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    sources: t.field({ type: [SheetSourceRef], resolve: (item) => readSheetSources(item.sources) }),
    consumable: t.exposeBoolean('consumable', { description: 'Taken from the stock when ticked.' }),
    checkedAt: t.expose('checkedAt', { type: 'DateTime', nullable: true }),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('Checklist', {
  description: 'Checklist made of the sheets of a routine or an event (one per occurrence) or of a task.',
  fields: (t) => ({
    id: t.exposeID('id'),
    routineId: t.exposeID('routineId', { nullable: true }),
    eventId: t.exposeID('eventId', { nullable: true }),
    taskId: t.exposeID('taskId', { nullable: true }),
    occurrenceDate: t.expose('occurrenceDate', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    items: t.relation('items', { query: { orderBy: [{ position: 'asc' }, { label: 'asc' }] } }),
  }),
});

const SheetItemInputRef = builder.inputType('SheetItemInput', {
  fields: (t) => ({ id: t.id(), productId: t.id(), label: t.string({ required: true }), categoryId: t.id(), quantity: t.float(), unit: t.string(), note: t.string(), consumable: t.boolean() }),
});

const SheetInputRef = builder.inputType('SheetInput', {
  fields: (t) => ({ name: t.string({ required: true }), note: t.string(), projectId: t.id(), categoryIds: t.idList({ required: true }) }),
});

const SheetCategoryInputRef = builder.inputType('SheetCategoryInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

const SheetCategoryPatchRef = builder.inputType('SheetCategoryPatch', {
  fields: (t) => ({ name: t.string(), color: t.string() }),
});

/**
 * Sheet input as the service reads it.
 * @param {typeof SheetInputRef.$inferInput} input Input.
 * @returns {import('@ordo/shared').SheetInput} Sheet.
 */
const sheetInput = (input: typeof SheetInputRef.$inferInput) => ({
  name: input.name,
  note: input.note ?? null,
  projectId: input.projectId ? String(input.projectId) : null,
  categoryIds: input.categoryIds.map(String),
});

const SheetLinkInputRef = builder.inputType('SheetLinkInput', {
  fields: (t) => ({ sheetId: t.id({ required: true }), multiplier: t.float({ required: true }) }),
});

/**
 * Item input as the service reads it.
 * @param {typeof SheetItemInputRef.$inferInput} input Input.
 * @returns {import('@ordo/shared').SheetItemInput} Item.
 */
const itemInput = (input: typeof SheetItemInputRef.$inferInput) => ({
  id: input.id ? String(input.id) : null,
  productId: input.productId ? String(input.productId) : null,
  label: input.label,
  categoryId: input.categoryId ? String(input.categoryId) : null,
  quantity: input.quantity ?? null,
  unit: input.unit ?? null,
  note: input.note ?? null,
  consumable: input.consumable ?? true,
});

/**
 * Owner of a checklist from the arguments: a routine or an event with its occurrence, or a task.
 * @param {{ routineId?: string | number | null, eventId?: string | number | null, taskId?: string | number | null, occurrenceDate?: string | null }} args Arguments.
 * @returns {sheets.SheetOwner} Owner.
 */
function ownerOf(args: { routineId?: string | number | null; eventId?: string | number | null; taskId?: string | number | null; occurrenceDate?: string | null }): sheets.SheetOwner {
  if (args.taskId) return { taskId: String(args.taskId) };
  if (!args.occurrenceDate) throw new Error('Date de l’occurrence requise.');
  if (args.routineId) return { routineId: String(args.routineId), occurrenceDate: args.occurrenceDate };
  if (args.eventId) return { eventId: String(args.eventId), occurrenceDate: args.occurrenceDate };
  throw new Error('Une routine, un évènement ou une tâche.');
}

/** What using a sheet took from the stock. */
const SheetUseRef = builder.objectRef<{ taken: number; short: string[] }>('SheetUse').implement({
  fields: (t) => ({
    taken: t.exposeInt('taken', { description: 'Items taken from the stock.' }),
    short: t.exposeStringList('short', { description: 'Items short of stock (what there was was taken).' }),
  }),
});

builder.queryFields((t) => ({
  sheetCategories: t.prismaField({
    type: ['SheetCategory'],
    description: 'Categories of the sheets, in their order.',
    resolve: (query) => prisma.sheetCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  sheet: t.prismaField({
    type: 'Sheet',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) => prisma.sheet.findUnique({ ...query, where: { id: String(id) } }),
  }),
  sheets: t.prismaField({
    type: ['Sheet'],
    description: 'Sheets, in their order: all, or those of a project.',
    args: { projectId: t.arg.id() },
    resolve: (query, _root, { projectId }) => prisma.sheet.findMany({ ...query, where: projectId ? { projectId: String(projectId) } : {}, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  sheetLinks: t.prismaField({
    type: ['SheetLink'],
    description: 'Sheets of a routine, an event or a task, in their order.',
    args: { routineId: t.arg.id(), eventId: t.arg.id(), taskId: t.arg.id() },
    resolve: (query, _root, args) =>
      prisma.sheetLink.findMany({
        ...query,
        where: args.routineId ? { routineId: String(args.routineId) } : args.eventId ? { eventId: String(args.eventId) } : { taskId: String(args.taskId ?? '') },
        orderBy: { position: 'asc' },
      }),
  }),
  checklist: t.prismaField({
    type: 'Checklist',
    nullable: true,
    description: 'Checklist of a routine or an event occurrence, or of a task: made of its sheets the first time it is asked (none without sheets).',
    args: { routineId: t.arg.id(), eventId: t.arg.id(), taskId: t.arg.id(), occurrenceDate: t.arg({ type: 'Date' }) },
    resolve: async (query, _root, args) => {
      const list = await sheets.checklist(ownerOf({ ...args, occurrenceDate: args.occurrenceDate ? String(args.occurrenceDate).slice(0, 10) : null }));
      return list ? prisma.checklist.findUniqueOrThrow({ ...query, where: { id: list.id } }) : null;
    },
  }),
}));

builder.mutationFields((t) => ({
  createSheet: t.id({
    args: { input: t.arg({ type: SheetInputRef, required: true }) },
    resolve: async (_root, { input }) => (await sheets.createSheet(sheetInput(input))).id,
  }),
  updateSheet: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SheetInputRef, required: true }) },
    resolve: async (_root, { id, input }) => {
      await sheets.updateSheet(String(id), sheetInput(input));
      return true;
    },
  }),
  addSheetItem: t.id({
    args: { sheetId: t.arg.id({ required: true }), input: t.arg({ type: SheetItemInputRef, required: true }) },
    resolve: async (_root, { sheetId, input }) => (await sheets.addSheetItem(String(sheetId), itemInput(input))).id,
  }),
  addSheetProducts: t.int({
    description: 'Adds products of the references to a sheet; returns the number added.',
    args: { sheetId: t.arg.id({ required: true }), productIds: t.arg.idList({ required: true }) },
    resolve: (_root, { sheetId, productIds }) => sheets.addSheetProducts(String(sheetId), productIds.map(String)),
  }),
  updateSheetItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SheetItemInputRef, required: true }) },
    resolve: async (_root, { id, input }) => {
      await sheets.updateSheetItem(String(id), itemInput(input));
      return true;
    },
  }),
  deleteSheetItems: t.boolean({
    args: { ids: t.arg.idList({ required: true }) },
    resolve: async (_root, { ids }) => {
      await sheets.deleteSheetItems(ids.map(String));
      return true;
    },
  }),
  useSheet: t.field({
    type: SheetUseRef,
    description: 'Uses a sheet (times a multiplier): its items used up that are references are taken from the stock.',
    args: { id: t.arg.id({ required: true }), multiplier: t.arg.float({ required: true }) },
    resolve: (_root, { id, multiplier }) => stock.useSheet(String(id), multiplier),
  }),
  createSheetCategory: t.id({
    args: { input: t.arg({ type: SheetCategoryInputRef, required: true }) },
    resolve: async (_root, { input }) => (await sheets.createSheetCategory(input)).id,
  }),
  updateSheetCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SheetCategoryPatchRef, required: true }) },
    resolve: async (_root, { id, input }) => {
      await sheets.updateSheetCategory(String(id), { ...(input.name ? { name: input.name } : {}), ...(input.color ? { color: input.color } : {}) });
      return true;
    },
  }),
  deleteSheetCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await sheets.deleteSheetCategory(String(id));
      return true;
    },
  }),
  moveSheetCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await sheets.moveSheetCategory(String(id), index);
      return true;
    },
  }),
  duplicateSheet: t.id({ args: { id: t.arg.id({ required: true }) }, resolve: async (_root, { id }) => (await sheets.duplicateSheet(String(id))).id }),
  deleteSheet: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await sheets.deleteSheet(String(id));
      return true;
    },
  }),
  addSheetToShoppingList: t.int({
    description: 'Adds a sheet (times a multiplier) to a shopping list, summed with its items; returns the number of items of the sheet.',
    args: { listId: t.arg.id({ required: true }), sheetId: t.arg.id({ required: true }), multiplier: t.arg.float({ required: true }) },
    resolve: (_root, { listId, sheetId, multiplier }) => sheets.addSheetToShoppingList(String(listId), String(sheetId), multiplier),
  }),
  removeSheetFromShoppingList: t.boolean({
    args: { listId: t.arg.id({ required: true }), sheetId: t.arg.id({ required: true }) },
    resolve: async (_root, { listId, sheetId }) => {
      await sheets.removeSheetFromShoppingList(String(listId), String(sheetId));
      return true;
    },
  }),
  setSheetLinks: t.boolean({
    description: 'Sets the sheets of a routine, an event or a task (one of them).',
    args: { routineId: t.arg.id(), eventId: t.arg.id(), taskId: t.arg.id(), links: t.arg({ type: [SheetLinkInputRef], required: true }) },
    resolve: async (_root, { routineId, eventId, taskId, links }) => {
      await sheets.setSheetLinks(
        { routineId: routineId ? String(routineId) : null, eventId: eventId ? String(eventId) : null, taskId: taskId ? String(taskId) : null },
        links.map((link) => ({ sheetId: String(link.sheetId), multiplier: link.multiplier })),
      );
      return true;
    },
  }),
  resetChecklist: t.boolean({
    description: 'Makes a checklist again from the sheets of its owner (ticks and changes lost).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await sheets.resetChecklist(String(id));
      return true;
    },
  }),
  addSheetToChecklist: t.boolean({
    args: { id: t.arg.id({ required: true }), sheetId: t.arg.id({ required: true }), multiplier: t.arg.float({ required: true }) },
    resolve: async (_root, { id, sheetId, multiplier }) => {
      await sheets.addSheetToChecklist(String(id), String(sheetId), multiplier);
      return true;
    },
  }),
  addChecklistItem: t.id({
    args: { listId: t.arg.id({ required: true }), input: t.arg({ type: SheetItemInputRef, required: true }) },
    resolve: async (_root, { listId, input }) => (await sheets.addChecklistItem(String(listId), itemInput(input))).id,
  }),
  updateChecklistItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: SheetItemInputRef, required: true }) },
    resolve: async (_root, { id, input }) => {
      await sheets.updateChecklistItem(String(id), itemInput(input));
      return true;
    },
  }),
  setChecklistItemsChecked: t.boolean({
    args: { ids: t.arg.idList({ required: true }), checked: t.arg.boolean({ required: true }) },
    resolve: async (_root, { ids, checked }) => {
      await sheets.setChecklistItemsChecked(ids.map(String), checked);
      return true;
    },
  }),
  deleteChecklistItem: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await sheets.deleteChecklistItem(String(id));
      return true;
    },
  }),
}));
