import { addDays, type CalendarPdfKind, DEFAULT_LABEL_COLOR, twoDigits } from '@ordo/shared';
import { dayOf, localParts } from '../../../lib/dates';
import type { EventInput } from '@fullcalendar/core';
import { fileName, postExport } from '../../../lib/download';

/** Look in the PDF of each kind of item of the agenda (`extendedProps.kind`); the backgrounds apart. */
const PDF_KIND: Record<string, CalendarPdfKind> = {
  event: 'event',
  subscribed: 'event',
  birthday: 'event',
  task: 'task',
  routine: 'task',
  time: 'time',
  travel: 'travel',
  routineTravel: 'travel',
  slot: 'slot',
  editSlot: 'slot',
};

/** Color of each look when the item's cannot be read. */
const FALLBACK_COLOR: Record<CalendarPdfKind, string> = {
  event: '#228be6',
  task: DEFAULT_LABEL_COLOR,
  time: DEFAULT_LABEL_COLOR,
  travel: DEFAULT_LABEL_COLOR,
  slot: '#d3f9d8',
  background: '#2f9e44',
};

/** Item of the calendar as the PDF draws it. */
interface PdfItem {
  label: string;
  kind: CalendarPdfKind;
  allDay: boolean;
  start: string;
  end: string;
  color: string;
  struck: boolean;
}

/**
 * #rrggbb of a CSS color of the page (variables resolved, a translucent color laid on white).
 * @param {string | undefined} color CSS color.
 * @param {string} fallback Color when it cannot be read.
 * @returns {string} Hex color.
 */
function hexColor(color: string | undefined, fallback: string): string {
  if (!color || color === 'transparent') return fallback;
  const probe = document.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(computed);
  if (!match) return fallback;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return `#${match
    .slice(1, 4)
    .map((value) => twoDigits(Math.round(255 - (255 - Number(value)) * alpha).toString(16)))
    .join('')}`;
}

/**
 * Local "YYYY-MM-DDTHH:MM" of a FullCalendar date.
 * @param {EventInput['start']} value Date, string or timestamp.
 * @returns {string} Local date-time.
 */
function localDateTime(value: EventInput['start']): string {
  const parts = localParts(value instanceof Date ? value : new Date(value as string | number));
  return `${parts.date}T${parts.time}`;
}

/**
 * Items of the calendar as the PDF draws them: each item shown in its look (`CALENDAR_PDF_KINDS`), dates local,
 * all-day ends included, colors resolved (filled looks: their background, the others: their border).
 * @param {EventInput[]} items Items shown (filters applied).
 * @param {string} closedClass Class of the struck through items (cancelled events, done tasks).
 * @returns {PdfItem[]} Items.
 */
export function pdfItems(items: readonly EventInput[], closedClass: string): PdfItem[] {
  return items.flatMap((item): PdfItem[] => {
    if (!item.start) return [];
    const kind: CalendarPdfKind = item.display === 'background' ? 'background' : (PDF_KIND[String(item.extendedProps?.kind)] ?? 'event');
    const filled = kind === 'event' || kind === 'slot' || kind === 'background';
    const color = hexColor(filled ? item.backgroundColor : item.borderColor, FALLBACK_COLOR[kind]);
    const struck = (Array.isArray(item.classNames) ? item.classNames : []).includes(closedClass);
    const label = item.title ?? '';
    if (item.allDay) {
      const start = dayOf(String(item.start));
      // FullCalendar ends are exclusive.
      const end = item.end ? addDays(dayOf(String(item.end)), -1) : start;
      return [{ label, kind, allDay: true, start, end: end < start ? start : end, color, struck }];
    }
    const start = localDateTime(item.start);
    const end = item.end ? localDateTime(item.end) : start;
    return [{ label, kind, allDay: false, start, end: end < start ? start : end, color, struck }];
  });
}

/**
 * Downloads the PDF of a calendar view.
 * @param {object} view View: title, subtitle, kind, first and last days, today and its items.
 * @param {string} view.title Title (the period).
 * @param {string} view.subtitle Subtitle (filters).
 * @param {'month' | 'week' | 'day'} view.view Kind.
 * @param {string} view.from First day shown.
 * @param {string} view.to Last day shown.
 * @param {string} view.today The user's day.
 * @param {PdfItem[]} view.items Items.
 * @returns {Promise<void>}
 */
export async function downloadCalendarPdf(view: { title: string; subtitle: string; view: 'month' | 'week' | 'day'; from: string; to: string; today: string; items: PdfItem[] }): Promise<void> {
  await postExport('/api/exports/calendar.pdf', view, fileName(`Agenda — ${view.title}`, 'pdf'), 'Export PDF impossible.');
}
