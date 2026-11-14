import { filterConditionSchemaFor, filterDay, filterPeriod, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf, type FilterOperator, type TableSort } from '@ordo/shared';
import type { FilterFields } from '../../features/tasks/views/FilterBuilder';
import type { ColumnFilter, DataColumn } from './data-table';
import { currentWeek } from '../../lib/week';

/** Kind of filter field of each kind of column filter. */
const FIELD_KINDS: Record<ColumnFilter<unknown>['kind'], FilterFieldKind> = {
  text: 'text',
  number: 'number',
  date: 'date',
  boolean: 'boolean',
  choice: 'category',
  choices: 'multiReference',
};

/**
 * How a column is filtered: as asked, else an amount by its number, another column by its text; null when it is not.
 * @param {DataColumn<R>} column Column.
 * @returns {ColumnFilter<R> | null} Filter.
 */
export function columnFilter<R>(column: DataColumn<R>): ColumnFilter<R> | null {
  if (column.filter === false) return null;
  if (column.filter) return column.filter;
  // An amount is filtered as a number (its sort value).
  if (column.numeric && column.sortValue) {
    const sortValue = column.sortValue;
    return { kind: 'number', value: (row) => (typeof sortValue(row) === 'number' ? (sortValue(row) as number) : null) };
  }
  return column.text ? { kind: 'text' } : null;
}

/**
 * Columns of a table that can be filtered, with their filter.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @returns {{ column: DataColumn<R>, filter: ColumnFilter<R> }[]} Filterable columns.
 */
function filterable<R>(columns: readonly DataColumn<R>[]) {
  return columns.flatMap((column) => {
    const filter = columnFilter(column);
    return filter ? [{ column, filter }] : [];
  });
}

/**
 * Fields of the filter builder of a table: its filterable columns.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @returns {FilterFields<string>} Fields.
 */
export function tableFilterFields<R>(columns: readonly DataColumn<R>[]): FilterFields<string> {
  const fields = filterable(columns);
  const kinds = Object.fromEntries(fields.map(({ column, filter }) => [column.id, FIELD_KINDS[filter.kind]])) as Record<string, FilterFieldKind>;
  const choices = Object.fromEntries(fields.flatMap(({ column, filter }) => (filter.kind === 'choice' ? [[column.id, filter.options.map((option) => option.value)]] : [])));
  const schema = fields.length ? filterConditionSchemaFor(kinds, choices) : null;
  return {
    kinds,
    labels: Object.fromEntries(fields.map(({ column }) => [column.id, column.label])),
    groups: [{ group: 'Colonnes', fields: fields.map(({ column }) => column.id) }],
    first: fields[0]?.column.id ?? '',
    options: (field) => {
      const filter = fields.find(({ column }) => column.id === field)?.filter;
      return { data: filter && (filter.kind === 'choice' || filter.kind === 'choices') ? filter.options : [] };
    },
    isComplete: (condition) => Boolean(schema?.safeParse(condition).success),
    emptyText: 'Aucun filtre : toutes les lignes sont affichées.',
  };
}

/**
 * Whether a value is empty (nothing, blank text, no choice).
 * @param {unknown} value Value.
 * @returns {boolean} Empty.
 */
const isEmptyValue = (value: unknown) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Whether a row meets a condition; a condition on an unknown column, or incomplete, is met.
 * @param {FilterConditionOf<string>} condition Condition.
 * @param {R} row Row.
 * @param {Map<string, { column: DataColumn<R>, filter: ColumnFilter<R> }>} fields Filterable columns, by id.
 * @param {(condition: FilterConditionOf<string>) => boolean} complete Whether a condition is complete.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {boolean} Met.
 */
function meets<R>(
  condition: FilterConditionOf<string>,
  row: R,
  fields: Map<string, { column: DataColumn<R>; filter: ColumnFilter<R> }>,
  complete: (condition: FilterConditionOf<string>) => boolean,
  today: string,
): boolean {
  const field = fields.get(condition.field);
  if (!field || !complete(condition)) return true;
  const { column, filter } = field;
  const operator = condition.operator as FilterOperator;
  const wanted = condition.value;
  const value = filter.kind === 'text' ? (filter.value ? filter.value(row) : (column.text?.(row) ?? null)) : filter.value(row);
  if (operator === 'isEmpty') return isEmptyValue(value);
  if (operator === 'isNotEmpty') return !isEmptyValue(value);
  if (operator === 'isTrue') return value === true;
  if (operator === 'isFalse') return value !== true;
  switch (filter.kind) {
    case 'text': {
      const text = String(value ?? '').toLocaleLowerCase('fr');
      const query = String(wanted ?? '').toLocaleLowerCase('fr');
      return { contains: text.includes(query), notContains: !text.includes(query), is: text === query, isNot: text !== query }[operator as 'is'] ?? true;
    }
    case 'number': {
      if (typeof value !== 'number' || typeof wanted !== 'number') return operator === 'neq';
      return { eq: value === wanted, neq: value !== wanted, lt: value < wanted, lte: value <= wanted, gt: value > wanted, gte: value >= wanted }[operator as 'eq'] ?? true;
    }
    case 'date': {
      if (typeof value !== 'string') return false;
      const day = value.slice(0, 10);
      if (operator === 'within') {
        const [from, to] = filterPeriod(String(wanted), today, currentWeek());
        return day >= from && day < to;
      }
      const target = filterDay(String(wanted), today);
      return { is: day === target, before: day < target, after: day > target, onOrBefore: day <= target, onOrAfter: day >= target }[operator as 'is'] ?? true;
    }
    case 'choice': {
      const chosen = Array.isArray(wanted) ? wanted : [];
      const inside = value !== null && chosen.includes(String(value));
      return operator === 'notIn' ? !inside : inside;
    }
    case 'choices': {
      const own = Array.isArray(value) ? value : [];
      const chosen = Array.isArray(wanted) ? wanted : [];
      if (operator === 'anyOf') return chosen.some((item) => own.includes(item));
      if (operator === 'allOf') return chosen.every((item) => own.includes(item));
      return !chosen.some((item) => own.includes(item));
    }
    default:
      return true;
  }
}

/**
 * Rows kept by the search (in the texts of the columns) and the filter of a table.
 * @param {readonly R[]} rows Rows.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {{ search: string, filter: FilterGroupOf<string> }} view Search and filter.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {R[]} Rows kept.
 */
export function filterRows<R>(rows: readonly R[], columns: readonly DataColumn<R>[], { search, filter }: { search: string; filter: FilterGroupOf<string> }, today: string): R[] {
  const fields = new Map(filterable(columns).map((field) => [field.column.id, field]));
  const { isComplete } = tableFilterFields(columns);
  const needle = search.trim().toLocaleLowerCase('fr');
  const texts = columns.filter((column) => column.text);

  /**
   * Whether a row meets a filter tree.
   * @param {FilterGroupOf<string>} group Group.
   * @param {R} row Row.
   * @returns {boolean} Met.
   */
  const matches = (group: FilterGroupOf<string>, row: R): boolean => {
    if (group.children.length === 0) return true;
    const results = group.children.map((child) => (child.type === 'condition' ? meets(child, row, fields, isComplete, today) : matches(child, row)));
    return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
  };

  return rows.filter((row) => (!needle || texts.some((column) => column.text!(row).toLocaleLowerCase('fr').includes(needle))) && matches(filter, row));
}

/** Group of rows of a table. */
export interface RowGroup<R> {
  key: string;
  label: string;
  rows: R[];
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Rows grouped by the values of a column (its text), the groups in the order of its sort value (its text without),
 * reversed when the column is sorted descending; the rows without value last.
 * @param {readonly R[]} rows Rows, in their order.
 * @param {DataColumn<R>} column Column.
 * @param {readonly TableSort[]} sorting Sorts of the table.
 * @returns {RowGroup<R>[]} Groups.
 */
export function groupRows<R>(rows: readonly R[], column: DataColumn<R>, sorting: readonly TableSort[]): RowGroup<R>[] {
  const groups = new Map<string, RowGroup<R> & { order: string | number | null }>();
  for (const row of rows) {
    const label = column.text?.(row) ?? '';
    const group = groups.get(label) ?? { key: label, label: label || 'Sans valeur', rows: [], order: label ? (column.sortValue?.(row) ?? label) : null };
    group.rows.push(row);
    groups.set(label, group);
  }
  const desc = sorting.find((sort) => sort.id === column.id)?.desc ?? false;
  return [...groups.values()]
    .sort((a, b) => {
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      const order = typeof a.order === 'number' && typeof b.order === 'number' ? a.order - b.order : collator.compare(String(a.order), String(b.order));
      return desc ? -order : order;
    })
    .map(({ key, label, rows: items }) => ({ key, label, rows: items }));
}

/**
 * Columns the rows can be grouped by.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @returns {DataColumn<R>[]} Groupable columns.
 */
export const groupableColumns = <R>(columns: readonly DataColumn<R>[]) => columns.filter((column) => column.groupable && column.text);
