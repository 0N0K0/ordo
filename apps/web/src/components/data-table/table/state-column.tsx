import { ItemBadge } from '../../items/ItemBadge';
import { BADGE_COLUMN, type DataColumn } from './data-table';

/**
 * A state a row can be in (« En cours », « Clôturée »…): its value (kept in the saved filters), its name and the colour
 * of its badge. Also an item of `ChipChoiceCell`, to change it in place.
 */
export interface ColumnState<V extends string = string> {
  id: V;
  label: string;
  color: string;
}

/** What a state column declares: a column without its text, cell, sort, filter and alignment, which come from its states. */
export interface StateColumnOptions<R, V extends string> extends Omit<DataColumn<R>, 'text' | 'cell' | 'sortValue' | 'filter' | 'align' | 'values' | 'numeric'> {
  /** States of a row, in their order (sort, filter choices). */
  states: readonly ColumnState<V>[];
  /** State of a row; null: none (empty cell and text, in the group of the rows without value). */
  value: (row: R) => V | null;
}

/**
 * State of a value among states.
 * @param {readonly ColumnState<V>[]} states States.
 * @param {V | null} value Value; null: none.
 * @returns {ColumnState<V> | undefined} State, none without value.
 */
export const stateOf = <V extends string>(states: readonly ColumnState<V>[], value: V | null): ColumnState<V> | undefined =>
  value === null ? undefined : states.find((state) => state.id === value);

/**
 * Column of the state of a row, one value among a fixed list (the state of a routine, of a shopping list, the category of
 * a task status…): its cells show the state in its coloured badge (`ItemBadge`), centred as every badge; its text is the
 * name of the state (export, search, groups); sorted in the order of the states, filtered by a choice among them.
 * @param {StateColumnOptions<R, V>} options Column, with its states and the state of a row.
 * @returns {DataColumn<R>} Column.
 */
export function stateColumn<R, V extends string>({ states, value, ...column }: StateColumnOptions<R, V>): DataColumn<R> {
  /**
   * State of a row.
   * @param {R} row Row.
   * @returns {ColumnState<V> | undefined} State, none without value.
   */
  const current = (row: R) => stateOf(states, value(row));
  return {
    ...BADGE_COLUMN,
    ...column,
    sortValue: (row) => {
      const state = current(row);
      return state ? states.indexOf(state) : null;
    },
    text: (row) => current(row)?.label ?? '',
    cell: (row) => <ItemBadge item={current(row)} />,
    filter: { kind: 'choice', value, options: states.map(({ id, label }) => ({ value: id, label })) },
  };
}
