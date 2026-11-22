import { NO_LABEL, YES_LABEL, type DataColumn } from './data-table';
import { YesNoIcon } from '../cells/YesNoIcon';

/** What a yes / no column declares: a column without its text, cell, sort and filter, which come from its value. */
export interface BooleanColumnOptions<R> extends Omit<DataColumn<R>, 'text' | 'cell' | 'sortValue' | 'filter'> {
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

/**
 * Yes / no column of a table: its cells show a green check or a red cross (`YesNoIcon`), its text is « Oui » / « Non »
 * (export, search), it sorts no before yes and filters as a yes / no; its groups are « Oui » / « Non » unless it names
 * them (`groupLabels`).
 * @param {BooleanColumnOptions<R>} options Column, with the value of a row.
 * @returns {DataColumn<R>} Column.
 */
export function booleanColumn<R>({ value, blank, ...column }: BooleanColumnOptions<R>): DataColumn<R> {
  /**
   * Value shown in the cell of a row: none when the row is left blank.
   * @param {R} row Row.
   * @returns {boolean | null} Value shown.
   */
  const shown = (row: R) => (blank?.(row) ? null : value(row));
  return {
    ...column,
    sortValue: (row) => {
      const yes = shown(row);
      return yes === null ? null : Number(yes);
    },
    text: (row) => {
      const yes = shown(row);
      return yes === null ? '' : yes ? YES_LABEL : NO_LABEL;
    },
    cell: (row) => {
      const yes = shown(row);
      return yes === null ? null : <YesNoIcon value={yes} />;
    },
    filter: { kind: 'boolean', value },
  };
}
