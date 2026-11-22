import { yesNoText, type DataColumn, type YesNoIcons, type YesNoLabels } from './data-table';
import { YesNoIcon } from '../cells/YesNoIcon';

/** What a yes / no column declares: a column without its text, cell, sort and filter, which come from its value. */
export interface BooleanColumnOptions<R> extends Omit<DataColumn<R>, 'text' | 'cell' | 'sortValue' | 'filter' | 'groupLabels' | 'yesNoIcons'> {
  /**
   * Yes or no of a row; null: neither (a closed task is not « faisable maintenant »): empty cell and text, met by
   * neither « oui » nor « non », in the group of the rows without value.
   */
  value: (row: R) => boolean | null;
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
  /**
   * Rows whose cell and text stay empty while they keep their value for the filter and the groups (the events listed
   * with the tasks). Optional. Default = none.
   */
  blank?: (row: R) => boolean;
}

/**
 * Yes / no column of a table: its cells show an icon (`YesNoIcon`: a green check or a red cross unless it sets `icons`)
 * named after its value (`groupLabels`), its text is « Oui » / « Non » (export, search), it sorts no before yes and
 * filters as a yes / no; its groups are named by `groupLabels`, yes first.
 * @param {BooleanColumnOptions<R>} options Column, with the value of a row.
 * @returns {DataColumn<R>} Column.
 */
export function booleanColumn<R>({ value, blank, icons, ...column }: BooleanColumnOptions<R>): DataColumn<R> {
  /**
   * Value shown in the cell of a row: none when the row is left blank.
   * @param {R} row Row.
   * @returns {boolean | null} Value shown.
   */
  const shown = (row: R) => (blank?.(row) ? null : value(row));
  return {
    ...column,
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
      return yes === null ? null : <YesNoIcon value={yes} labels={column.groupLabels} icons={icons} />;
    },
    filter: { kind: 'boolean', value },
  };
}
