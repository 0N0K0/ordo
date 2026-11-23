import { round2 } from '@ordo/shared';
import type { AccountingLineInput } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { taggedKey } from '../../../lib/tagged-key';

/** How tracked time becomes lines. */
export type TimeGrouping = 'TOTAL' | 'DAY' | 'TASK' | 'ENTRY';

export interface BillableTime {
  id: string;
  /** Day in Paris, YYYY-MM-DD. */
  day: string;
  seconds: number;
  description: string | null;
  /** Titles of its tasks (the time is shared equally between them). */
  tasks: string[];
}

interface TimeLineOptions {
  grouping: TimeGrouping;
  unit: 'HOUR' | 'DAY';
  /** Hours in a billed day. */
  hoursPerDay: number;
  unitPrice: number;
  vatRate: number;
  /** Label of the lines (or of the lines without task). */
  label: string;
  /** Rounds each line up to the quarter hour. */
  roundQuarter: boolean;
}

/**
 * Quantity of a duration in the billed unit: hours (2 decimals) or days (3 decimals).
 * @param {number} seconds Duration.
 * @param {TimeLineOptions} options Unit, day length and rounding.
 * @returns {number} Quantity.
 */
function quantityOf(seconds: number, options: TimeLineOptions): number {
  let hours = seconds / 3600;
  if (options.roundQuarter) hours = Math.ceil(hours * 4 - 1e-9) / 4;
  return options.unit === 'DAY' ? Math.round((hours / options.hoursPerDay) * 1000) / 1000 : round2(hours);
}

/**
 * Markdown list of what was done (descriptions, once each).
 * @param {string[]} items Descriptions.
 * @returns {string | null} List, or null when empty.
 */
function doneList(items: (string | null)[]): string | null {
  const unique = [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
  return unique.length ? unique.map((item) => `- ${item.replace(/\n+/g, ' ')}`).join('\n') : null;
}

/**
 * Lines billing tracked time: one line overall, per day, per task or per entry, at a price per hour or per
 * day; the descriptions of the time make the description of the lines.
 * @param {BillableTime[]} entries Time to bill.
 * @param {TimeLineOptions} options Grouping, unit, price, VAT, label, rounding.
 * @returns {AccountingLineInput[]} Lines (empty groups left out).
 */
export function timeLines(entries: BillableTime[], options: TimeLineOptions): AccountingLineInput[] {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  const groups = new Map<string, { label: string; seconds: number; descriptions: (string | null)[] }>();
  const add = (key: string, label: string, seconds: number, description: string | null) => {
    const group = groups.get(key) ?? { label, seconds: 0, descriptions: [] };
    group.seconds += seconds;
    group.descriptions.push(description);
    groups.set(key, group);
  };
  for (const entry of sorted) {
    if (options.grouping === 'TOTAL') add('total', options.label, entry.seconds, entry.description && `${fmt.day(entry.day)} : ${entry.description}`);
    else if (options.grouping === 'DAY') add(entry.day, `${options.label} — ${fmt.day(entry.day)}`, entry.seconds, entry.description);
    else if (options.grouping === 'ENTRY') add(entry.id, `${options.label} — ${fmt.day(entry.day)}`, entry.seconds, entry.description);
    else if (entry.tasks.length === 0) add('', options.label, entry.seconds, entry.description);
    else for (const task of entry.tasks) add(taggedKey('task', task), task, entry.seconds / entry.tasks.length, entry.description);
  }
  return [...groups.values()]
    .filter((group) => group.seconds > 0)
    .map((group) => ({
      kind: 'ITEM',
      label: group.label,
      description: doneList(group.descriptions),
      quantity: quantityOf(group.seconds, options),
      unit: options.unit,
      unitPrice: options.unitPrice,
      vatRate: options.vatRate,
      discountType: null,
      discountValue: null,
    }));
}
