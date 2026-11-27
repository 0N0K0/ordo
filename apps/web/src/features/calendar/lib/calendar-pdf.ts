import { addDays, type CalendarPdfKind, DEFAULT_LABEL_COLOR, type SlotPattern, twoDigits } from '@ordo/shared';
import { parisDay, parisParts } from '../../../lib/dates';
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
  line: '#2f9e44',
};

/**
 * How a créneau, an éphéméride or a birthday of the agenda prints, set where the agenda builds its look: its name in
 * the legend (its kind), the color it is drawn in, its pattern, the lightness of its look (`planned`: the working
 * hours and the bars, `typed`: the background of a kind, `full`: thin lines, slots being changed, birthdays) and
 * whether it is archived (faded).
 */
export interface SlotPrint {
  legend: string;
  color: string;
  pattern: SlotPattern | null;
  opacity: 'planned' | 'typed' | 'full';
  archived: boolean;
}

/** Opacity tokens of the app for each lightness of a slot (`full`: none). */
const PRINT_OPACITY: Record<Exclude<SlotPrint['opacity'], 'full'>, { token: string; fallback: number }> = {
  planned: { token: '--onoko-planned-opacity', fallback: 0.6 },
  typed: { token: '--onoko-planned-typed-opacity', fallback: 0.25 },
};
/** Opacity token of what is set back (archived). */
const MUTED_OPACITY = { token: '--onoko-muted-opacity', fallback: 0.5 };

/** Gray of an archived item on screen (`.archived`: `filter: grayscale(0.6)`). */
const ARCHIVED_GRAYSCALE = 0.6;

/**
 * Color grayed as the CSS `grayscale()` filter does: mixed with its luminance.
 * @param {string} hex Color (#rrggbb).
 * @param {number} amount Share of gray (0 to 1).
 * @returns {string} Grayed color (#rrggbb).
 */
function grayed(hex: string, amount: number): string {
  const channels = [0, 1, 2].map((index) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16));
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return `#${channels.map((value) => twoDigits(Math.round(value + (luminance - value) * amount).toString(16))).join('')}`;
}

/** Item of the calendar as the PDF draws it. */
interface PdfItem {
  label: string;
  kind: CalendarPdfKind;
  allDay: boolean;
  start: string;
  end: string;
  color: string;
  struck: boolean;
  /** Name in the legend (créneaux, éphémérides, birthdays), its pattern and its opacity. */
  legend: string | null;
  pattern: SlotPattern | null;
  opacity: number;
  /** Lane of a thin line that day; column of a background among those at the same time, and their number. */
  lane: number;
  column: number;
  columns: number;
}

/**
 * Value of an opacity token of the app, as the page has it.
 * @param {{ token: string, fallback: number }} opacity Token and its value when it cannot be read.
 * @returns {number} Opacity.
 */
function tokenOpacity({ token, fallback }: { token: string; fallback: number }): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
}

/** Opacities of the looks of the slots, as the page has them: each lightness, and what is set back. */
interface PrintOpacities {
  planned: number;
  typed: number;
  muted: number;
}

/**
 * Opacities of the looks of the slots, read once from the tokens of the page.
 * @returns {PrintOpacities} Opacities.
 */
function printOpacities(): PrintOpacities {
  return { planned: tokenOpacity(PRINT_OPACITY.planned), typed: tokenOpacity(PRINT_OPACITY.typed), muted: tokenOpacity(MUTED_OPACITY) };
}

/**
 * Opacity a slot is drawn with in the agenda: the lightness of its look, faded when archived.
 * @param {SlotPrint} print Print of the slot.
 * @param {PrintOpacities} opacities Opacities of the page.
 * @returns {number} Opacity (0 to 1).
 */
function printOpacity(print: SlotPrint, opacities: PrintOpacities): number {
  return (print.opacity === 'full' ? 1 : opacities[print.opacity]) * (print.archived ? opacities.muted : 1);
}

/**
 * Whole number of the extended props of an item, or a default.
 * @param {unknown} value Value.
 * @param {number} fallback Default.
 * @returns {number} Number.
 */
const wholeNumber = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isInteger(value) ? value : fallback);

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

/** A day, or a day and time without zone (YYYY-MM-DD, YYYY-MM-DDTHH:MM[:SS]). */
const WALL_TIME = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * Paris "YYYY-MM-DDTHH:MM" of a FullCalendar date (the agenda is shown in Paris time, whatever the browser's zone).
 * @param {EventInput['start']} value Date, string or timestamp.
 * @returns {string} Date-time in Paris.
 */
function parisDateTime(value: EventInput['start']): string {
  // A day, or a day and time without zone, is already a Paris one (the agenda reads it in Paris).
  const wall = typeof value === 'string' ? WALL_TIME.exec(value) : null;
  if (wall) return `${wall[1]}T${wall[2] ?? '00:00'}`;
  const parts = parisParts(value instanceof Date ? value : new Date(value as string | number));
  return `${parts.date}T${parts.time}`;
}

/**
 * Items of the calendar as the PDF draws them: each item shown in its look (`CALENDAR_PDF_KINDS`: a background
 * narrowed to a lane is a thin line), dates in Paris, all-day ends included, colors resolved (filled looks: their
 * background, the others: their border); the créneaux, éphémérides and birthdays as they print (`SlotPrint`: color,
 * pattern, opacity, name in the legend), with the lane of their line or their column among the backgrounds; the other
 * archived items (events, their travel, routines) faded and grayed as on screen.
 * @param {EventInput[]} items Items shown (filters applied).
 * @param {{ closed: string, archived: string }} classNames Classes of the struck through items (cancelled events, done
 * tasks) and of the archived ones.
 * @returns {PdfItem[]} Items.
 */
export function pdfItems(items: readonly EventInput[], classNames: { closed: string; archived: string }): PdfItem[] {
  const opacities = printOpacities();
  return items.flatMap((item): PdfItem[] => {
    if (!item.start) return [];
    const props = (item.extendedProps ?? {}) as { kind?: unknown; print?: SlotPrint; slotLane?: unknown; slotColumn?: unknown; slotColumns?: unknown };
    const lined = typeof props.slotLane === 'number';
    const kind: CalendarPdfKind = item.display === 'background' ? (lined ? 'line' : 'background') : (PDF_KIND[String(props.kind)] ?? 'event');
    const filled = kind === 'event' || kind === 'slot' || kind === 'background' || kind === 'line';
    const { print } = props;
    const classes = Array.isArray(item.classNames) ? item.classNames : [];
    // Archived, outside the créneaux and éphémérides (their print says it): faded and grayed as on screen.
    const archived = !print && classes.includes(classNames.archived);
    const resolved = hexColor(print?.color ?? (filled ? item.backgroundColor : item.borderColor), FALLBACK_COLOR[kind]);
    const color = archived ? grayed(resolved, ARCHIVED_GRAYSCALE) : resolved;
    const struck = classes.includes(classNames.closed);
    const look = {
      label: item.title ?? '',
      kind,
      color,
      struck,
      legend: print?.legend ?? null,
      pattern: print?.pattern ?? null,
      opacity: print ? printOpacity(print, opacities) : archived ? opacities.muted : 1,
      lane: wholeNumber(props.slotLane, 0),
      column: wholeNumber(props.slotColumn, 0),
      columns: wholeNumber(props.slotColumns, 1),
    };
    if (item.allDay) {
      const start = parisDay(item.start as Date | string | number);
      // FullCalendar ends are exclusive.
      const end = item.end ? addDays(parisDay(item.end as Date | string | number), -1) : start;
      return [{ ...look, allDay: true, start, end: end < start ? start : end }];
    }
    const start = parisDateTime(item.start);
    const end = item.end ? parisDateTime(item.end) : start;
    return [{ ...look, allDay: false, start, end: end < start ? start : end }];
  });
}

/**
 * Downloads the PDF of a calendar view.
 * @param {object} view View: title, kind, first and last days, today and its items.
 * @param {string} view.title Title (the period), in the header of the page and the name of the file.
 * @param {'month' | 'week' | 'day'} view.view Kind.
 * @param {string} view.from First day shown.
 * @param {string} view.to Last day shown.
 * @param {string} view.today Today in Paris.
 * @param {PdfItem[]} view.items Items.
 * @returns {Promise<void>}
 */
export async function downloadCalendarPdf(view: { title: string; view: 'month' | 'week' | 'day'; from: string; to: string; today: string; items: PdfItem[] }): Promise<void> {
  await postExport('/api/exports/calendar.pdf', view, fileName(`Agenda — ${view.title}`, 'pdf'), 'Export PDF impossible.');
}
