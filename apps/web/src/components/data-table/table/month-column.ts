import * as fmt from '../../../lib/format';
import { localDay } from '../../../lib/dates';
import type { DataColumn } from './data-table';

/** A calendar day (YYYY-MM-DD) or month (YYYY-MM): its month is read as it is, whatever the time zone. */
const CALENDAR_DAY = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * Month (YYYY-MM) of a day or an instant: an instant in the user's time zone (not UTC: the 1st at midnight stays in its month).
 * @param {string | null | undefined} value Day (YYYY-MM-DD) or instant (ISO date-time).
 * @returns {string | null} Month, or null without a value.
 */
function monthOfValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return (CALENDAR_DAY.test(value) ? value : localDay(value)).slice(0, 7);
}

/**
 * « Mois » column of a table, hidden by default: sorted and grouped by month, shown « Novembre 2026 ».
 * @param {string} id Column id.
 * @param {string} label Column label (« Mois », « Mois d’échéance »…).
 * @param {(row: R) => string | null | undefined} date Day or instant of a row.
 * @param {number} [size] Width. Optional. Default = 150.
 * @returns {DataColumn<R>} Column.
 */
export function monthColumn<R>(id: string, label: string, date: (row: R) => string | null | undefined, size = 150): DataColumn<R> {
  return {
    id,
    label,
    size,
    hiddenByDefault: true,
    sortValue: (row) => monthOfValue(date(row)),
    text: (row) => {
      const month = monthOfValue(date(row));
      return month ? fmt.capitalize(fmt.month(month)) : '';
    },
    filter: false,
    groupable: true,
  };
}
