import {
  addDays,
  CALENDAR_PDF_KINDS,
  colorSchema,
  countOf,
  dayPart,
  daysBetween,
  daySchema,
  endAfter,
  LOCAL_DATE_TIME_PATTERN,
  monthOfDay,
  timeToMinutes,
  WEEKDAY_SHORT_LABELS,
  weekdayText,
  weekdayOfDate,
  twoDigits,
  dayOfMonthOf,
} from '@ordo/shared';
import { z } from 'zod';
import { parseInput } from '../../graphql/errors';
import { PDF_TABLE, PDF_TEXT, type PdfDoc, PRINTED_LABEL_MAX, reportHeadingSchema, type ReportFile, startReport, writeHeading } from '../core/pdf-report';

/** Local date and time, "YYYY-MM-DDTHH:MM". */
const localDateTime = z.string().regex(LOCAL_DATE_TIME_PATTERN);

/** A view of the calendar, as displayed (filters applied), to print. */
const calendarPdfSchema = reportHeadingSchema
  .extend({
    view: z.enum(['month', 'week', 'day']),
    /** First and last days shown, included. */
    from: daySchema(),
    to: daySchema(),
    /** The user's day (highlighted). */
    today: daySchema(),
    items: z
      .array(
        z.object({
          label: z.string().max(PRINTED_LABEL_MAX),
          kind: z.enum(CALENDAR_PDF_KINDS),
          allDay: z.boolean(),
          /** All day: first and last days (YYYY-MM-DD, included); timed: local date-times. */
          start: z.union([daySchema(), localDateTime]),
          end: z.union([daySchema(), localDateTime]),
          color: colorSchema,
          /** Cancelled or done: struck through. */
          struck: z.boolean().default(false),
        }),
      )
      .max(5000),
  })
  .refine(...endAfter('from', 'to'))
  .refine((view) => daysBetween(view.from, view.to) <= 45, 'Période invalide.');
type CalendarPdfInput = z.input<typeof calendarPdfSchema>;

const COLORS = { ...PDF_TEXT, border: PDF_TABLE.border, light: PDF_TABLE.fill, today: '#fff8db' };
/** Opacity of the backgrounds (créneaux, éphémérides): the day and the other backgrounds show through. */
const BACKGROUND_OPACITY = 0.18;
const MARGIN = 28;

/**
 * Color mixed with white.
 * @param {string} hex Color (#rrggbb).
 * @param {number} ratio Share of the color (0 to 1).
 * @returns {string} Lighter color.
 */
function tint(hex: string, ratio: number): string {
  const channel = (index: number) => Math.round(255 - (255 - parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)) * ratio);
  return `#${[0, 1, 2].map((index) => twoDigits(channel(index).toString(16))).join('')}`;
}

/**
 * Draws a background (créneaux, éphémérides) in its color, see-through.
 * @param {PdfDoc} doc PDF.
 * @param {string} color Color (#rrggbb).
 * @param {{ x: number, y: number, width: number, height: number }} box Box.
 * @returns {void}
 */
function drawBackground(doc: PdfDoc, color: string, box: { x: number; y: number; width: number; height: number }): void {
  if (box.height <= 0) return;
  doc.save();
  doc.fillOpacity(BACKGROUND_OPACITY).rect(box.x, box.y, box.width, box.height).fill(color);
  doc.restore();
}

/**
 * Lighter look of an item of the time grid or of the all-day row: tint, stripe in its color, dark text.
 * @param {z.infer<typeof calendarPdfSchema>['items'][number]} item Item.
 * @returns {{ fill: string, stripe: boolean, text: string } | null} Look, or none: filled in its color, white text.
 */
function lightLook(item: z.infer<typeof calendarPdfSchema>['items'][number]): { fill: string; stripe: boolean; text: string } | null {
  if (item.kind === 'slot') return { fill: item.color, stripe: false, text: COLORS.text };
  if (item.kind === 'travel') return { fill: tint(item.color, 0.08), stripe: true, text: COLORS.muted };
  if (item.kind === 'task' || item.kind === 'time' || item.struck) return { fill: tint(item.color, 0.2), stripe: true, text: COLORS.text };
  return null;
}

/**
 * Writes a text clipped to a box (ellipsis on its last line).
 * @param {PdfDoc} doc PDF.
 * @param {string} text Text.
 * @param {object} box Box and style.
 * @param {number} box.x Left.
 * @param {number} box.y Top.
 * @param {number} box.width Width.
 * @param {number} box.height Height.
 * @param {number} box.size Font size.
 * @param {string} box.color Text color.
 * @param {boolean} [box.bold] Bold. Optional.
 * @param {boolean} [box.struck] Struck through. Optional.
 * @returns {void}
 */
function clippedText(doc: PdfDoc, text: string, box: { x: number; y: number; width: number; height: number; size: number; color: string; bold?: boolean; struck?: boolean }): void {
  if (box.width < 6 || box.height < box.size) return;
  doc
    .font(box.bold ? 'bold' : 'regular')
    .fontSize(box.size)
    .fillColor(box.color);
  const lineHeight = box.size * 1.2;
  const lines = Math.max(1, Math.floor(box.height / lineHeight));
  doc.text(text, box.x, box.y, { width: box.width, height: lines * lineHeight, ellipsis: true, lineGap: box.size * 0.2 - 0.5, strike: box.struck });
}

/**
 * Week or day view: an all-day row, then the hours with the créneaux and éphémérides in the background and the timed
 * items side by side when they overlap.
 * @param {PdfDoc} doc PDF.
 * @param {z.infer<typeof calendarPdfSchema>} view View.
 * @param {{ x: number, y: number, width: number, height: number }} area Area to fill.
 * @param {string} today Today (highlighted).
 * @returns {void}
 */
function drawTimeGrid(doc: PdfDoc, view: z.infer<typeof calendarPdfSchema>, area: { x: number; y: number; width: number; height: number }, today: string): void {
  const days = Array.from({ length: daysBetween(view.from, view.to) + 1 }, (_, index) => addDays(view.from, index));
  const axis = 30;
  const columnWidth = (area.width - axis) / days.length;
  const columnX = (index: number) => area.x + axis + index * columnWidth;

  // Day headers.
  const headerHeight = 16;
  days.forEach((day, index) => {
    if (day === today) doc.rect(columnX(index), area.y, columnWidth, headerHeight).fill(COLORS.today);
    clippedText(doc, weekdayText(day), { x: columnX(index) + 3, y: area.y + 4, width: columnWidth - 6, height: 10, size: 7.5, color: COLORS.text, bold: true });
  });
  let y = area.y + headerHeight;

  // All-day row: bars over their days, on as few rows as possible.
  const allDay = view.items
    .filter((item) => item.allDay && item.kind !== 'background' && dayPart(item.start) <= view.to && dayPart(item.end) >= view.from)
    .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const rows: string[][] = [];
  const placed = allDay.map((item) => {
    const first = Math.max(0, daysBetween(view.from, dayPart(item.start)));
    const last = Math.min(days.length - 1, daysBetween(view.from, dayPart(item.end)));
    let row = rows.findIndex((taken) => taken.every((range) => Number(range.split(':')[1]) < first || Number(range.split(':')[0]) > last));
    if (row < 0) row = rows.push([]) - 1;
    rows[row].push(`${first}:${last}`);
    return { item, first, last, row };
  });
  const maxRows = 5;
  const barHeight = 10;
  const allDayHeight = Math.max(1, Math.min(rows.length, maxRows)) * (barHeight + 2) + 4;
  doc.rect(area.x, y, area.width, allDayHeight).fill(COLORS.light);
  for (const { item, first, last, row } of placed) {
    if (row >= maxRows) continue;
    const x = columnX(first) + 1;
    const width = (last - first + 1) * columnWidth - 2;
    const top = y + 2 + row * (barHeight + 2);
    const look = lightLook(item);
    doc.rect(x, top, width, barHeight).fill(look?.fill ?? item.color);
    if (look?.stripe) doc.rect(x, top, 2, barHeight).fill(item.color);
    clippedText(doc, item.label, { x: x + 4, y: top + 1.8, width: width - 6, height: barHeight - 2, size: 6.5, color: look?.text ?? '#ffffff', struck: item.struck });
  }
  const hidden = placed.filter((entry) => entry.row >= maxRows).length;
  if (hidden) clippedText(doc, `+${hidden}`, { x: area.x + 2, y: y + 2, width: axis - 4, height: 9, size: 6.5, color: COLORS.muted });
  y += allDayHeight;

  // Hours: those of the items, 8 h to 19 h at least (backgrounds, often whole days, do not widen them).
  const timed = view.items.filter((item) => !item.allDay);
  const ranged = timed.filter((item) => item.kind !== 'background');
  const startHour = Math.min(8, ...ranged.map((item) => (dayPart(item.start) < dayPart(item.end) ? 0 : Math.floor(timeToMinutes(item.start.slice(11)) / 60))));
  const endHour = Math.max(19, ...ranged.map((item) => (dayPart(item.end) > dayPart(item.start) ? 24 : Math.ceil(timeToMinutes(item.end.slice(11)) / 60))));
  const gridTop = y;
  const hourHeight = (area.y + area.height - gridTop) / (endHour - startHour);
  const yOf = (minutes: number) => gridTop + ((Math.min(Math.max(minutes, startHour * 60), endHour * 60) - startHour * 60) / 60) * hourHeight;

  days.forEach((day, index) => {
    if (day === today) doc.rect(columnX(index), gridTop, columnWidth, endHour * 60 > 0 ? (endHour - startHour) * hourHeight : 0).fill(tint('#fab005', 0.08));
  });

  // Pieces of timed items on each day (an item over midnight is cut).
  const pieces = timed.flatMap((item) =>
    days
      .map((day, index) => {
        const startDay = dayPart(item.start);
        const endDay = dayPart(item.end);
        if (day < startDay || day > endDay) return null;
        const start = day === startDay ? timeToMinutes(item.start.slice(11)) : 0;
        const end = day === endDay ? timeToMinutes(item.end.slice(11)) : 24 * 60;
        return end > start || item.kind === 'time' ? { item, index, start, end: Math.max(end, start + 15) } : null;
      })
      .filter((piece) => piece !== null),
  );

  // Créneaux and éphémérides in the background.
  for (const piece of pieces.filter((entry) => entry.item.kind === 'background')) {
    drawBackground(doc, piece.item.color, { x: columnX(piece.index), y: yOf(piece.start), width: columnWidth, height: yOf(piece.end) - yOf(piece.start) });
  }

  // Hour lines and labels.
  for (let hour = startHour; hour <= endHour; hour++) {
    const lineY = gridTop + (hour - startHour) * hourHeight;
    doc
      .moveTo(area.x + axis, lineY)
      .lineTo(area.x + area.width, lineY)
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .stroke();
    if (hour < endHour) clippedText(doc, `${twoDigits(hour)}:00`, { x: area.x, y: lineY + 1, width: axis - 3, height: 9, size: 6.5, color: COLORS.muted });
  }
  days.forEach((_, index) =>
    doc
      .moveTo(columnX(index), area.y)
      .lineTo(columnX(index), area.y + area.height)
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .stroke(),
  );

  // Items of each day: overlapping ones side by side.
  days.forEach((_, index) => {
    const ofDay = pieces.filter((piece) => piece.index === index && piece.item.kind !== 'background').sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster: typeof ofDay = [];
    let clusterEnd = -1;
    const flush = () => {
      const columns: number[] = [];
      const lanes = cluster.map((piece) => {
        let lane = columns.findIndex((end) => end <= piece.start);
        if (lane < 0) lane = columns.push(0) - 1;
        columns[lane] = piece.end;
        return lane;
      });
      cluster.forEach((piece, position) => {
        const width = (columnWidth - 2) / columns.length;
        const x = columnX(index) + 1 + lanes[position] * width;
        const top = yOf(piece.start);
        const height = Math.max(6, yOf(piece.end) - top - 1);
        const { item } = piece;
        const look = lightLook(item);
        doc.save();
        if (item.struck) doc.opacity(0.55);
        doc.rect(x, top, width - 1, height).fill(look?.fill ?? item.color);
        if (look?.stripe) doc.rect(x, top, 2, height).fill(item.color);
        const time = `${item.start.slice(11)}–${item.end.slice(11)}`;
        clippedText(doc, `${item.label}${height > 16 ? `\n${time}` : ''}`, {
          x: x + 4,
          y: top + 1.5,
          width: width - 7,
          height: height - 2,
          size: 6.5,
          color: look?.text ?? '#ffffff',
          struck: item.struck,
        });
        doc.restore();
      });
      cluster = [];
      clusterEnd = -1;
    };
    for (const piece of ofDay) {
      if (cluster.length && piece.start >= clusterEnd) flush();
      cluster.push(piece);
      clusterEnd = Math.max(clusterEnd, piece.end);
    }
    if (cluster.length) flush();
  });
  doc.rect(area.x, area.y, area.width, area.height).lineWidth(0.5).strokeColor(COLORS.border).stroke();
}

/**
 * Month view: weeks of days, each listing its items (time and title), "+n" when they do not fit.
 * @param {PdfDoc} doc PDF.
 * @param {z.infer<typeof calendarPdfSchema>} view View.
 * @param {{ x: number, y: number, width: number, height: number }} area Area to fill.
 * @param {string} today Today (highlighted).
 * @returns {void}
 */
function drawMonth(doc: PdfDoc, view: z.infer<typeof calendarPdfSchema>, area: { x: number; y: number; width: number; height: number }, today: string): void {
  const weeks = Math.ceil((daysBetween(view.from, view.to) + 1) / 7);
  const headerHeight = 14;
  const cellWidth = area.width / 7;
  const cellHeight = (area.height - headerHeight) / weeks;
  const month = monthOfDay(addDays(view.from, 15));
  // The days of the week from the first day shown (the first day of the week of the workspace).
  Array.from({ length: 7 }, (_, index) => WEEKDAY_SHORT_LABELS[weekdayOfDate(addDays(view.from, index)) - 1]).forEach((label, index) =>
    clippedText(doc, label, { x: area.x + index * cellWidth + 4, y: area.y + 3, width: cellWidth - 8, height: 10, size: 7.5, color: COLORS.muted, bold: true }),
  );
  const items = view.items.filter((item) => item.kind !== 'background');
  const backgrounds = view.items.filter((item) => item.kind === 'background');
  const lineHeight = 8.6;
  for (let week = 0; week < weeks; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = addDays(view.from, week * 7 + weekday);
      const x = area.x + weekday * cellWidth;
      const y = area.y + headerHeight + week * cellHeight;
      if (day === today) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.today);
      else if (monthOfDay(day) !== month) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.light);
      for (const background of backgrounds) if (dayPart(background.start) <= day && day <= dayPart(background.end)) drawBackground(doc, background.color, { x, y, width: cellWidth, height: cellHeight });
      doc.rect(x, y, cellWidth, cellHeight).lineWidth(0.3).strokeColor(COLORS.border).stroke();
      clippedText(doc, String(dayOfMonthOf(day)), { x: x + 3, y: y + 2, width: cellWidth - 6, height: 10, size: 7.5, color: monthOfDay(day) === month ? COLORS.text : COLORS.muted, bold: true });
      const ofDay = items.filter((item) => dayPart(item.start) <= day && day <= dayPart(item.end)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
      const room = Math.max(0, Math.floor((cellHeight - 13) / lineHeight));
      const shown = ofDay.length > room ? ofDay.slice(0, Math.max(0, room - 1)) : ofDay;
      shown.forEach((item, index) => {
        const lineY = y + 12 + index * lineHeight;
        doc.save();
        if (item.struck) doc.opacity(0.55);
        const filled = item.kind === 'event' || item.kind === 'slot';
        if (item.allDay) doc.rect(x + 2, lineY, cellWidth - 4, lineHeight - 1).fill(filled ? item.color : tint(item.color, 0.2));
        else doc.circle(x + 5, lineY + lineHeight / 2 - 0.5, 1.8).fill(item.color);
        const label = item.allDay ? item.label : `${item.start.slice(11)} ${item.label}`;
        clippedText(doc, label, {
          x: x + (item.allDay ? 4 : 9),
          y: lineY + 1.2,
          width: cellWidth - (item.allDay ? 7 : 12),
          height: lineHeight - 1,
          size: 6.3,
          color: item.allDay && item.kind === 'event' ? '#ffffff' : COLORS.text,
          struck: item.struck,
        });
        doc.restore();
      });
      if (ofDay.length > shown.length) {
        clippedText(doc, `+${countOf(ofDay.length - shown.length, 'autre')}`, {
          x: x + 4,
          y: y + 12 + shown.length * lineHeight + 1,
          width: cellWidth - 8,
          height: lineHeight,
          size: 6.3,
          color: COLORS.muted,
        });
      }
    }
  }
}

/**
 * PDF (A4 landscape) of a calendar view as displayed: month grid, or week / day hours with the all-day row
 * and the créneaux and éphémérides in the background; cancelled events and done tasks struck through. Light colors,
 * for printing, in the template shared by every export (logo, date, page number).
 * @param {CalendarPdfInput} input View and its items.
 * @returns {Promise<ReportFile>} PDF and its file name.
 */
export async function calendarPdf(input: CalendarPdfInput): Promise<ReportFile> {
  const view = parseInput(calendarPdfSchema, input);
  const { today } = view;
  const { doc, top, finish } = await startReport({ title: view.title });

  const width = doc.page.width - 2 * MARGIN;
  const y = writeHeading(doc, view, { x: MARGIN, y: top, width }) + 4;
  const area = { x: MARGIN, y: y + 2, width, height: doc.page.height - doc.page.margins.bottom - y - 2 };
  if (view.view === 'month') drawMonth(doc, view, area, today);
  else drawTimeGrid(doc, view, area, today);
  return finish();
}
