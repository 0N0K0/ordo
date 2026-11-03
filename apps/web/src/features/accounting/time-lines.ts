import type { AccountingLineInput } from '@ordo/shared';

/** How tracked time becomes lines. */
export type TimeGrouping = 'TOTAL' | 'DAY' | 'TASK' | 'ENTRY';

export interface BillableTime {
  id: string;
  /** Local day, YYYY-MM-DD. */
  day: string;
  seconds: number;
  description: string | null;
  /** Titles of its tasks (the time is shared equally between them). */
  tasks: string[];
}

export interface TimeLineOptions {
  grouping: TimeGrouping;
  unit: 'HOUR' | 'DAY';
  /** Hours in a billed day. */
  hoursPerDay: number;
  unitPrice: number;
  vatRate: number;
  /** Title of the lines (or of the lines without task). */
  title: string;
  /** Rounds each line up to the quarter hour. */
  roundQuarter: boolean;
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Printed day: "5 mars 2026".
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Day.
 */
function printedDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
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
  return options.unit === 'DAY' ? Math.round((hours / options.hoursPerDay) * 1000) / 1000 : Math.round(hours * 100) / 100;
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
 * @param {TimeLineOptions} options Grouping, unit, price, VAT, title, rounding.
 * @returns {AccountingLineInput[]} Lines (empty groups left out).
 */
export function timeLines(entries: BillableTime[], options: TimeLineOptions): AccountingLineInput[] {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  const groups = new Map<string, { title: string; seconds: number; descriptions: (string | null)[] }>();
  const add = (key: string, title: string, seconds: number, description: string | null) => {
    const group = groups.get(key) ?? { title, seconds: 0, descriptions: [] };
    group.seconds += seconds;
    group.descriptions.push(description);
    groups.set(key, group);
  };
  for (const entry of sorted) {
    if (options.grouping === 'TOTAL') add('total', options.title, entry.seconds, entry.description && `${printedDay(entry.day)} : ${entry.description}`);
    else if (options.grouping === 'DAY') add(entry.day, `${options.title} — ${printedDay(entry.day)}`, entry.seconds, entry.description);
    else if (options.grouping === 'ENTRY') add(entry.id, `${options.title} — ${printedDay(entry.day)}`, entry.seconds, entry.description);
    else if (entry.tasks.length === 0) add('', options.title, entry.seconds, entry.description);
    else for (const task of entry.tasks) add(`task:${task}`, task, entry.seconds / entry.tasks.length, entry.description);
  }
  return [...groups.values()]
    .filter((group) => group.seconds > 0)
    .map((group) => ({
      kind: 'ITEM',
      title: group.title,
      description: doneList(group.descriptions),
      quantity: quantityOf(group.seconds, options),
      unit: options.unit,
      unitPrice: options.unitPrice,
      vatRate: options.vatRate,
      discountType: null,
      discountValue: null,
    }));
}
