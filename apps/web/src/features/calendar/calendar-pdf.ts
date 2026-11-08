import type { EventInput } from '@fullcalendar/core';
import { addDays } from '@ordo/shared';
import { exportFileName, saveFile } from '../dashboards/chart-image';
import { localParts } from './event-input';

type PdfKind = 'event' | 'task' | 'time' | 'pause' | 'work';

/** Item of the calendar as the PDF draws it. */
interface PdfItem {
  title: string;
  kind: PdfKind;
  allDay: boolean;
  start: string;
  end: string;
  color: string;
  struck: boolean;
}

/**
 * #rrggbb of a CSS color of the page (variables resolved).
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
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
  return match
    ? `#${match
        .slice(1, 4)
        .map((value) => Number(value).toString(16).padStart(2, '0'))
        .join('')}`
    : fallback;
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
 * Items of the calendar as the PDF draws them: dates local, all-day ends included, colors resolved.
 * @param {EventInput[]} items Items shown (filters applied).
 * @param {string} closedClass Class of the struck through items (cancelled events, done tasks).
 * @returns {PdfItem[]} Items.
 */
export function pdfItems(items: readonly EventInput[], closedClass: string): PdfItem[] {
  return items.flatMap((item): PdfItem[] => {
    if (!item.start) return [];
    // The bar of a day of planned slots (week, day): its hours are exported in the background already.
    // Bars of planned slots and travel times stay out of the report.
    if (item.extendedProps?.kind === 'slot' || item.extendedProps?.kind === 'travel') return [];
    const kind: PdfKind = item.display === 'background' ? 'work' : ((item.extendedProps?.kind as PdfKind | undefined) ?? 'event');
    const classes = Array.isArray(item.classNames) ? item.classNames : [];
    const color = kind === 'work' ? '#2f9e44' : kind === 'pause' ? '#fd7e14' : kind === 'event' ? hexColor(item.backgroundColor, '#228be6') : hexColor(item.borderColor, '#868e96');
    if (item.allDay) {
      const start = String(item.start).slice(0, 10);
      // FullCalendar ends are exclusive.
      const end = item.end ? addDays(String(item.end).slice(0, 10), -1) : start;
      return [{ title: item.title ?? '', kind, allDay: true, start, end: end < start ? start : end, color, struck: classes.includes(closedClass) }];
    }
    const start = localDateTime(item.start);
    const end = item.end ? localDateTime(item.end) : start;
    return [{ title: item.title ?? '', kind, allDay: false, start, end: end < start ? start : end, color, struck: classes.includes(closedClass) }];
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
  const response = await fetch('/api/exports/calendar.pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(view),
  });
  if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Export PDF impossible.');
  saveFile(await response.blob(), exportFileName(`Agenda — ${view.title}`, 'pdf'));
}
