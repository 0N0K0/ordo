import { unarchived } from '../../../lib/archive';
import {
  addDays,
  type FilterConditionOf,
  filterConditionSchemaFor,
  type FilterFieldKind,
  type FilterGroupOf,
  matchesFilter,
  meetsCondition,
  type GroupPeriod,
  isoWeek,
  isoWeekYear,
  type TableSort,
  type TableViewConfig,
  weekdayOf,
  quarterOf,
  twoDigits,
} from '@ordo/shared';
import { hasAvatar, itemRenderOption } from '../../items/item-look';
import type { FilterFields } from '../../filters/FilterBuilder';
import { NO_LABEL, sortRows, YES_LABEL, type ColumnChoice, type ColumnFilter, type DataColumn } from './data-table';
import { currentWeek } from '../../../lib/week';
import { dayOf, monthOfDay, yearOfDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { periodName, quarterName } from '../../../lib/periods';
import { treeSelectProps } from '../../tree/tree-select';
import { collator, normalize } from '../../../lib/text';

/** Rank of what has none (a value out of the options, a row out of the order): after the others. */
// eslint-disable-next-line no-restricted-syntax -- LAST_RANK itself.
export const LAST_RANK = Number.MAX_SAFE_INTEGER;

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
    required: new Set(fields.flatMap(({ column }) => (column.required ? [column.id] : []))),
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
    yesNo: (field) => {
      const column = fields.find((item) => item.column.id === field)?.column;
      return column?.groupLabels || column?.yesNoIcons ? { labels: column.groupLabels, icons: column.yesNoIcons } : undefined;
    },
    emptyText: 'Aucun filtre : toutes les lignes sont affichées.',
  };
}

/**
 * Whether a row meets a condition (`meetsCondition`, the rule the API applies too); a condition on an unknown column,
 * or incomplete, is met.
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
  const value = filter.kind === 'text' ? (filter.value ? filter.value(row) : (column.text?.(row) ?? null)) : filter.value(row);
  // A date is compared by its day (an instant: its day here).
  const read = filter.kind === 'date' && typeof value === 'string' ? dayOf(value) : value;
  return meetsCondition(condition, { kind: filter.kind, value: read, none: filter.kind === 'choice' ? filter.none : undefined }, today, currentWeek());
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

  return rows.filter((row) => (!needle || texts.some((column) => normalize(column.text!(row)).includes(needle))) && matchesFilter(filter, (condition) => meets(condition, row, fields, isComplete, today)));
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
  switch (period) {
    case 'DAY':
      return { key: date, label: fmt.capitalize(fmt.dayLong(date)) };
    case 'WEEK': {
      const week = weekOf(date);
      return { key: `${week.year}-W${twoDigits(week.week)}`, label: `Semaine ${week.week} · ${week.year} (du ${fmt.dayShort(week.monday)})` };
    }
    case 'MONTH':
      return { key: monthOfDay(date), label: periodName('month', `${monthOfDay(date)}-01`) };
    case 'QUARTER': {
      return { key: `${year}-Q${quarterOf(date)}`, label: quarterName(date) };
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

/** Name of the group of the rows without value, unless the column names it (`groupNoneLabel`). */
export const NO_VALUE_LABEL = 'Sans valeur';

/**
 * Groups of a row by a column: its value as told by its filter (each value of several, the period of a date, yes or
 * no, none when empty), else its text; with the order of the groups.
 * @param {R} row Row.
 * @param {DataColumn<R>} column Column.
 * @param {GroupPeriod} period Period of a date.
 * @returns {{ key: string, label: string, order: string | number | null }[]} Groups (one without value: key '').
 */
function groupsOf<R>(row: R, column: DataColumn<R>, period: GroupPeriod): { key: string; label: string; order: string | number | null }[] {
  const none = [{ key: '', label: column.groupNoneLabel ?? NO_VALUE_LABEL, order: null }];
  const filter = columnFilter(column);
  if (column.groupValue) {
    const values = column.groupValue(row);
    if (!values.length) return none;
    const options = filter && (filter.kind === 'choice' || filter.kind === 'choices') ? filter.options : [];
    return values.map((value) => {
      const index = options.findIndex((option) => option.value === value);
      return { key: value, label: options[index]?.label ?? value, order: index < 0 ? LAST_RANK : index };
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
      return { key: value, label: filter.options[index]?.label ?? value, order: index < 0 ? LAST_RANK : index };
    });
  }
  if (filter?.kind === 'choice') {
    const value = filter.value(row);
    if (value === null || value === '') return none;
    const index = filter.options.findIndex((option) => option.value === value);
    return [{ key: value, label: filter.options[index]?.label ?? value, order: index < 0 ? LAST_RANK : index }];
  }
  if (filter?.kind === 'boolean') {
    const value = filter.value(row);
    if (value === null) return none;
    const labels = column.groupLabels ?? { yes: YES_LABEL, no: NO_LABEL };
    return [{ key: value ? 'yes' : 'no', label: value ? labels.yes : labels.no, order: value ? 0 : 1 }];
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

/** Rows of a view of a table: those its search and its filter keep, sorted, grouped. */
export interface ViewRows<R> {
  /** Rows kept, sorted. */
  rows: R[];
  /** Groups of the rows (one of every row, without heading, when not grouped). */
  groups: RowGroup<R>[];
  /** Column the rows are grouped by. */
  groupColumn: DataColumn<R> | null;
}

/**
 * A view applied to the rows of a table: its search and its filter on the columns, its sorts, its groups.
 * @param {readonly R[]} rows Rows, in their default order (the archived ones already left out or not).
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {TableViewConfig} config Configuration of the view.
 * @param {string} today User's day (YYYY-MM-DD).
 * @param {(row: R) => boolean} [alwaysKept] Rows kept whatever the search and the filter. Optional. Default = none.
 * @returns {ViewRows<R>} Rows, groups and the column grouped by.
 */
export function viewRows<R>(rows: readonly R[], columns: readonly DataColumn<R>[], config: TableViewConfig, today: string, alwaysKept?: (row: R) => boolean): ViewRows<R> {
  const matched = filterRows(rows, columns, config, today);
  const forced = alwaysKept ? new Set(matched) : null;
  const kept = sortRows(forced ? rows.filter((row) => forced.has(row) || alwaysKept!(row)) : matched, config.sorting, columns);
  const groupColumn = (config.groupBy && columns.find((column) => column.id === config.groupBy && isGroupable(column))) || null;
  return { rows: kept, groupColumn, groups: groupColumn ? groupRows(kept, groupColumn, config.sorting, config.groupPeriod) : [{ key: '', label: '', rows: kept }] };
}
