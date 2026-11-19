import { z } from 'zod';

/** Layout of the columns of a table: their order, those hidden, their widths (px). Unknown ids are ignored. */
export const columnLayoutSchema = z.object({
  columnOrder: z.array(z.string().max(64)).max(100).default([]),
  hiddenColumns: z.array(z.string().max(64)).max(100).default([]),
  columnSizing: z.record(z.string().max(64), z.number().min(40).max(1200)).default({}),
});
export type ColumnLayout = z.infer<typeof columnLayoutSchema>;

/** Sort of a table on one of its columns. */
export const tableSortSchema = z.object({ id: z.string().max(64), desc: z.boolean() });
export type TableSort = z.infer<typeof tableSortSchema>;

/**
 * Old id of the label column of the tables whose saved views may still hold it (decision BI: `title` / `name` became
 * `label`, the stored views migrated). The one alias map, read when a view or a layout is parsed.
 */
const LEGACY_LABEL_COLUMNS: Readonly<Record<string, 'title' | 'name'>> = {
  tasks: 'title',
  routines: 'title',
  catalog: 'title',
  'project-documents': 'title',
  'recurring-invoices': 'name',
  sheets: 'name',
  'shopping-lists': 'name',
  'shopping-list': 'name',
  'shopping-base-list': 'name',
  'work-schedules': 'name',
};

/**
 * Old id of the label column of a table, if its views may still hold one.
 * @param {string} tableKey Table (« tasks », « documents-invoice »…).
 * @returns {'title' | 'name' | null} Old id, null for none.
 */
export function legacyLabelColumn(tableKey: string): 'title' | 'name' | null {
  return LEGACY_LABEL_COLUMNS[tableKey] ?? (tableKey.startsWith('documents-') ? 'title' : null);
}

/**
 * Stored id read as the current one.
 * @param {unknown} id Stored id.
 * @param {string} from Old id.
 * @returns {unknown} Id (`label` for the old one).
 */
const aliased = (id: unknown, from: string): unknown => (id === from ? 'label' : id);

/**
 * Filter (or node of one) with the old column id of its conditions read as `label`.
 * @param {unknown} node Stored filter node.
 * @param {string} from Old id.
 * @returns {unknown} Node.
 */
function aliasedFilter(node: unknown, from: string): unknown {
  if (!node || typeof node !== 'object') return node;
  const item = node as Record<string, unknown>;
  if (Array.isArray(item.children)) return { ...item, children: item.children.map((child) => aliasedFilter(child, from)) };
  return 'field' in item ? { ...item, field: aliased(item.field, from) } : item;
}

/**
 * Stored view or column layout of a table with the old id of its label column read as `label` (decision BI): in its
 * column order, hidden columns, widths, sorts, grouping, footer and filter. Anything else is kept as it is.
 * @param {unknown} stored Stored configuration.
 * @param {string | null} from Old id of the label column (legacyLabelColumn), null for none.
 * @returns {unknown} Configuration.
 */
export function withLabelColumn(stored: unknown, from: string | null): unknown {
  if (!from || !stored || typeof stored !== 'object' || Array.isArray(stored)) return stored;
  const config = { ...(stored as Record<string, unknown>) };
  const keyed = (value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [aliased(key, from) as string, item])) : value;
  for (const key of ['columnOrder', 'hiddenColumns'] as const) if (Array.isArray(config[key])) config[key] = [...new Set((config[key] as unknown[]).map((id) => aliased(id, from)))];
  for (const key of ['columnSizing', 'footer'] as const) if (key in config) config[key] = keyed(config[key]);
  if (Array.isArray(config.sorting)) config.sorting = config.sorting.map((sort: unknown) => (sort && typeof sort === 'object' ? { ...sort, id: aliased((sort as { id?: unknown }).id, from) } : sort));
  if ('groupBy' in config) config.groupBy = aliased(config.groupBy, from);
  if ('filter' in config) config.filter = aliasedFilter(config.filter, from);
  return config;
}
