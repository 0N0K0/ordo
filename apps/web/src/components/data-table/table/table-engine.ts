import { unarchived } from '../../../lib/archive';
import {
  addDays,
  type FilterConditionOf,
  filterConditionSchemaFor,
  filterDay,
  type FilterFieldKind,
  type FilterGroupOf,
  type FilterOperator,
  filterPeriod,
  type GroupPeriod,
  isoWeek,
  isoWeekYear,
  type TableSort,
  weekdayOf,
  yearOfDay,
} from '@ordo/shared';
import { hasAvatar, itemRenderOption } from '../../items/item-look';
import type { FilterFields } from '../../filters/FilterBuilder';
import type { ColumnChoice, ColumnFilter, DataColumn } from './data-table';
import { currentWeek } from '../../../lib/week';
import { dayOf, monthOfDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { periodName, quarterName } from '../../../lib/periods';
import { treeSelectProps } from '../../tree/tree-select';
import { collator, normalize } from '../../../lib/text';

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
 * Choices a column filter offers: the archived ones left out, except those in the filter (a saved filter keeps its
 * label); in a tree, an archived parent of choices offered stays, greyed out.
 * @param {readonly ColumnChoice[]} options Choices of the column.
 * @param {readonly string[]} values Values in the filter.
 * @returns {ColumnChoice[]} Choices offered.
 */
function offeredChoices(options: readonly ColumnChoice[], values: readonly string[]): ColumnChoice[] {
  if (!options.some((option) => option.archived)) return [...options];
  const offered = new Set(unarchived(options, values, (option) => option.value).map((option) => option.value));
  // Parents of the choices offered, to keep their tree.
  const byValue = new Map(options.map((option) => [option.value, option]));
  const parents = new Set<string>();
  for (const value of offered) {
    for (let parent = byValue.get(value)?.parent; parent && !parents.has(parent); parent = byValue.get(parent)?.parent) parents.add(parent);
  }
  return options.flatMap((option) => (offered.has(option.value) ? [option] : parents.has(option.value) ? [{ ...option, disabled: true }] : []));
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
    options: (field, values) => {
      const filter = fields.find(({ column }) => column.id === field)?.filter;
      const options = offeredChoices(filter && (filter.kind === 'choice' || filter.kind === 'choices') ? filter.options : [], values);
      // Choices of a tree (categories, projects, tasks…) offered as their tree.
      return options.some((option) => option.depth !== undefined)
        ? treeSelectProps(options.map((option) => ({ ...option, nodeLabel: option.nodeLabel ?? option.label, depth: option.depth ?? 0, parent: option.parent ?? null })))
        : options.some(hasAvatar)
          ? { data: options, renderOption: itemRenderOption(options) }
          : { data: options };
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
      // Without case nor accents, as the searches of the selects.
      const text = normalize(String(value ?? ''));
      const query = normalize(String(wanted ?? ''));
      return { contains: text.includes(query), notContains: !text.includes(query), is: text === query, isNot: text !== query }[operator as 'is'] ?? true;
    }
    case 'number': {
      if (typeof value !== 'number' || typeof wanted !== 'number') return operator === 'neq';
      return { eq: value === wanted, neq: value !== wanted, lt: value < wanted, lte: value <= wanted, gt: value > wanted, gte: value >= wanted }[operator as 'eq'] ?? true;
    }
    case 'date': {
      if (typeof value !== 'string') return false;
      const day = dayOf(value);
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
  const needle = normalize(search.trim());
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

  return rows.filter((row) => (!needle || texts.some((column) => normalize(column.text!(row)).includes(needle))) && matches(filter, row));
}

/** Group of rows of a table. */
export interface RowGroup<R> {
  key: string;
  label: string;
  rows: R[];
}

/**
 * ISO week of a day: its year (that of its Thursday), its number and its Monday.
 * @param {string} date YYYY-MM-DD.
 * @returns {{ year: number, week: number, monday: string }} Week.
 */
const weekOf = (date: string) => ({ year: isoWeekYear(date), week: isoWeek(date), monday: addDays(date, 1 - weekdayOf(date)) });

/**
 * Group of a day in a period: its key (in date order) and its name.
 * @param {string} date YYYY-MM-DD.
 * @param {GroupPeriod} period Period.
 * @returns {{ key: string, label: string }} Group.
 */
function periodGroup(date: string, period: GroupPeriod): { key: string; label: string } {
  const year = yearOfDay(date);
  const month = Number(date.slice(5, 7));
  switch (period) {
    case 'DAY':
      return { key: date, label: fmt.capitalize(fmt.dayLong(date)) };
    case 'WEEK': {
      const week = weekOf(date);
      return { key: `${week.year}-W${String(week.week).padStart(2, '0')}`, label: `Semaine ${week.week} · ${week.year} (du ${fmt.dayShort(week.monday)})` };
    }
    case 'MONTH':
      return { key: monthOfDay(date), label: periodName('month', `${monthOfDay(date)}-01`) };
    case 'QUARTER': {
      const quarter = Math.ceil(month / 3);
      return { key: `${year}-Q${quarter}`, label: quarterName(date) };
    }
    case 'YEAR':
      return { key: String(year), label: String(year) };
  }
}

/**
 * Whether the rows can be grouped by a column: every column but the label (locked), unless it says not; with a value
 * to group by (its filter, or its text).
 * @param {DataColumn<R>} column Column.
 * @returns {boolean} Groupable.
 */
export function isGroupable<R>(column: DataColumn<R>): boolean {
  if (column.groupable === false || column.locked) return false;
  return Boolean(column.text || columnFilter(column));
}

/**
 * Groups of a row by a column: its value as told by its filter (each value of several, the period of a date, yes or
 * no), else its text; with the order of the groups.
 * @param {R} row Row.
 * @param {DataColumn<R>} column Column.
 * @param {GroupPeriod} period Period of a date.
 * @returns {{ key: string, label: string, order: string | number | null }[]} Groups (one without value: key '').
 */
function groupsOf<R>(row: R, column: DataColumn<R>, period: GroupPeriod): { key: string; label: string; order: string | number | null }[] {
  const none = [{ key: '', label: 'Sans valeur', order: null }];
  const filter = columnFilter(column);
  if (column.groupValue) {
    const values = column.groupValue(row);
    if (!values.length) return none;
    const options = filter && (filter.kind === 'choice' || filter.kind === 'choices') ? filter.options : [];
    return values.map((value) => {
      const index = options.findIndex((option) => option.value === value);
      return { key: value, label: options[index]?.label ?? value, order: index < 0 ? Number.MAX_SAFE_INTEGER : index };
    });
  }
  if (filter?.kind === 'date') {
    const date = filter.value(row);
    if (!date) return none;
    const group = periodGroup(dayOf(date), period);
    return [{ ...group, order: group.key }];
  }
  if (filter?.kind === 'choices') {
    const values = filter.value(row);
    if (!values.length) return none;
    return values.map((value) => {
      const index = filter.options.findIndex((option) => option.value === value);
      return { key: value, label: filter.options[index]?.label ?? value, order: index < 0 ? Number.MAX_SAFE_INTEGER : index };
    });
  }
  if (filter?.kind === 'choice') {
    const value = filter.value(row);
    if (value === null || value === '') return none;
    const index = filter.options.findIndex((option) => option.value === value);
    return [{ key: value, label: filter.options[index]?.label ?? value, order: index < 0 ? Number.MAX_SAFE_INTEGER : index }];
  }
  if (filter?.kind === 'boolean') {
    const value = filter.value(row);
    return [{ key: value ? 'yes' : 'no', label: value ? 'Oui' : 'Non', order: value ? 0 : 1 }];
  }
  const label = column.text?.(row) ?? (filter?.kind === 'number' ? String(filter.value(row) ?? '') : '');
  if (!label) return none;
  return [{ key: label, label, order: column.sortValue?.(row) ?? label }];
}

/**
 * Rows grouped by the values of a column (a row with several values in each of their groups; a date by its period),
 * the groups in the order of their values, reversed when the column is sorted descending; the rows without value last.
 * @param {readonly R[]} rows Rows, in their order.
 * @param {DataColumn<R>} column Column.
 * @param {readonly TableSort[]} sorting Sorts of the table.
 * @param {GroupPeriod} [period] Period of a date. Optional. Default = MONTH.
 * @returns {RowGroup<R>[]} Groups.
 */
export function groupRows<R>(rows: readonly R[], column: DataColumn<R>, sorting: readonly TableSort[], period: GroupPeriod = 'MONTH'): RowGroup<R>[] {
  const groups = new Map<string, RowGroup<R> & { order: string | number | null }>();
  for (const row of rows) {
    for (const { key, label, order } of groupsOf(row, column, period)) {
      const group = groups.get(key) ?? { key, label, rows: [], order };
      group.rows.push(row);
      groups.set(key, group);
    }
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
export const groupableColumns = <R>(columns: readonly DataColumn<R>[]) => columns.filter(isGroupable);
