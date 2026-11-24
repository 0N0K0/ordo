import { stateIcons, yesNoText, type DataColumn, type YesNoIcons, type YesNoLabels, type YesNoStates } from './data-table';
import { YesNoIcon } from '../cells/YesNoIcon';

/** What every yes / no column declares: a column without its text, cell, sort and filter, which come from its value. */
interface BooleanColumnBase<R> extends Omit<DataColumn<R>, 'text' | 'cell' | 'sortValue' | 'filter' | 'groupLabels' | 'yesNoIcons'> {
  /**
   * Yes or no of a row; null: neither (a closed task is not « faisable maintenant »): empty cell and text, met by
   * neither « oui » nor « non », in the group of the rows without value.
   */
  value: (row: R) => boolean | null;
  /**
   * Rows whose cell and text stay empty while they keep their value for the filter and the groups (the events listed
   * with the tasks). Optional. Default = none.
   */
  blank?: (row: R) => boolean;
}

/** A yes / no column of its own (read only everywhere): its names and icons. */
interface PlainBooleanColumn<R> extends BooleanColumnBase<R> {
  /**
   * Names of its values, yes first (« En retard » / « Dans le délai »): its groups, the name of its icons, the choices
   * of its filter.
   */
  groupLabels: YesNoLabels;
  /**
   * Icons of its values (a value that is a warning: `warning`; a neutral yes: `check: 'info'`). Optional. Default = a
   * green check for yes, a red cross for no.
   */
  icons?: YesNoIcons;
  states?: never;
}

/** A yes / no column whose value is changed elsewhere by a state button: it shows the states of that button. */
interface StatesBooleanColumn<R> extends BooleanColumnBase<R> {
  /**
   * States of its state buttons (`YesNoStates`): its icons are theirs (a no without icon is the empty gray square, not the
   * red cross) and its icons are named after them.
   */
  states: YesNoStates;
  /** Names of its groups and filter choices (« Faites » / « À faire »). Optional. Default = the names of its states. */
  groupLabels?: YesNoLabels;
  icons?: never;
}

/** What a yes / no column declares: its names and icons, or the states of its state buttons. */
export type BooleanColumnOptions<R> = PlainBooleanColumn<R> | StatesBooleanColumn<R>;

/**
 * Yes / no column of a table: its cells show an icon (`YesNoIcon`: a green check or a red cross unless it sets `icons`)
 * named after its value (`groupLabels`); a column whose value a state button changes takes its `states` instead, and
 * so shows the same icons with the same names as the button. Its text is « Oui » / « Non » (export, search), it sorts
 * no before yes and filters as a yes / no, its cells centred; its groups are named by `groupLabels` (default: the states), yes first.
 * @param {BooleanColumnOptions<R>} options Column, with the value of a row.
 * @returns {DataColumn<R>} Column.
 */
export function booleanColumn<R>({ value, blank, icons: given, states, groupLabels: groups, ...column }: BooleanColumnOptions<R>): DataColumn<R> {
  /**
   * Value shown in the cell of a row: none when the row is left blank.
   * @param {R} row Row.
   * @returns {boolean | null} Value shown.
   */
  const shown = (row: R) => (blank?.(row) ? null : value(row));
  const icons = states ? stateIcons(states) : given;
  const names = states?.labels ?? groups;
  return {
    // Its icons (and state buttons) centred.
    // eslint-disable-next-line no-restricted-syntax -- the kind of the yes / no columns.
    align: 'center',
    ...column,
    groupLabels: groups ?? names,
    yesNoIcons: icons,
    sortValue: (row) => {
      const yes = shown(row);
      return yes === null ? null : Number(yes);
    },
    text: (row) => {
      const yes = shown(row);
      return yes === null ? '' : yesNoText(yes);
    },
    cell: (row) => {
      const yes = shown(row);
      return yes === null ? null : <YesNoIcon value={yes} labels={names} icons={icons} />;
    },
    filter: { kind: 'boolean', value },
  };
}
