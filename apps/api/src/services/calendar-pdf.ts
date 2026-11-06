import { addDays, daysBetween } from '@ordo/shared';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { parseInput } from '../graphql/errors';
import { FONTS } from './accounting-pdf';

type Doc = InstanceType<typeof PDFDocument>;

const isoDate = z.iso.date();
/** Local date and time, "YYYY-MM-DDTHH:MM". */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** A view of the calendar, as displayed (filters applied), to print. */
export const calendarPdfSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().max(500).default(''),
    view: z.enum(['month', 'week', 'day']),
    /** First and last days shown, included. */
    from: isoDate,
    to: isoDate,
    /** The user's day (highlighted). */
    today: isoDate,
    items: z
      .array(
        z.object({
          title: z.string().max(300),
          kind: z.enum(['event', 'task', 'time', 'pause', 'work']),
          allDay: z.boolean(),
          /** All day: first and last days (YYYY-MM-DD, included); timed: local date-times. */
          start: z.union([isoDate, localDateTime]),
          end: z.union([isoDate, localDateTime]),
          color: hexColor,
          /** Cancelled or done: struck through. */
          struck: z.boolean().default(false),
        }),
      )
      .max(5000),
  })
  .refine((view) => view.from <= view.to && daysBetween(view.from, view.to) <= 45, 'Période invalide.');
export type CalendarPdfInput = z.input<typeof calendarPdfSchema>;
type Item = z.infer<typeof calendarPdfSchema>['items'][number];

const COLORS = { text: '#1d232b', muted: '#66707c', border: '#d5dae0', light: '#f2f4f6', work: '#e6f4ea', today: '#fff8db' };
const MARGIN = 28;
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const dayTitle = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Minutes of a "HH:MM" time.
 * @param {string} time Time.
 * @returns {number} Minutes since midnight.
 */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * Color mixed with white.
 * @param {string} hex Color (#rrggbb).
 * @param {number} ratio Share of the color (0 to 1).
 * @returns {string} Lighter color.
 */
function tint(hex: string, ratio: number): string {
  const channel = (index: number) => Math.round(255 - (255 - parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)) * ratio);
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Writes a text clipped to a box (ellipsis on its last line).
 * @param {Doc} doc PDF.
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
function clippedText(doc: Doc, text: string, box: { x: number; y: number; width: number; height: number; size: number; color: string; bold?: boolean; struck?: boolean }): void {
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
 * Week or day view: an all-day row, then the hours with the working hours in the background and the timed
 * items side by side when they overlap.
 * @param {Doc} doc PDF.
 * @param {z.infer<typeof calendarPdfSchema>} view View.
 * @param {{ x: number, y: number, width: number, height: number }} area Area to fill.
 * @param {string} today Today (highlighted).
 * @returns {void}
 */
function drawTimeGrid(doc: Doc, view: z.infer<typeof calendarPdfSchema>, area: { x: number; y: number; width: number; height: number }, today: string): void {
  const days = Array.from({ length: daysBetween(view.from, view.to) + 1 }, (_, index) => addDays(view.from, index));
  const axis = 30;
  const columnWidth = (area.width - axis) / days.length;
  const columnX = (index: number) => area.x + axis + index * columnWidth;

  // Day headers.
  const headerHeight = 16;
  days.forEach((day, index) => {
    if (day === today) doc.rect(columnX(index), area.y, columnWidth, headerHeight).fill(COLORS.today);
    clippedText(doc, dayTitle.format(new Date(`${day}T00:00:00Z`)), { x: columnX(index) + 3, y: area.y + 4, width: columnWidth - 6, height: 10, size: 7.5, color: COLORS.text, bold: true });
  });
  let y = area.y + headerHeight;

  // All-day row: bars over their days, on as few rows as possible.
  const allDay = view.items
    .filter((item) => item.allDay && item.kind !== 'work' && item.start.slice(0, 10) <= view.to && item.end.slice(0, 10) >= view.from)
    .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const rows: string[][] = [];
  const placed = allDay.map((item) => {
    const first = Math.max(0, daysBetween(view.from, item.start.slice(0, 10)));
    const last = Math.min(days.length - 1, daysBetween(view.from, item.end.slice(0, 10)));
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
    const outlined = item.kind === 'task' || item.kind === 'pause';
    doc.rect(x, top, width, barHeight).fill(outlined ? tint(item.color, 0.15) : item.color);
    if (outlined) doc.rect(x, top, 2, barHeight).fill(item.color);
    clippedText(doc, item.title, { x: x + 4, y: top + 1.8, width: width - 6, height: barHeight - 2, size: 6.5, color: outlined ? COLORS.text : '#ffffff', struck: item.struck });
  }
  const hidden = placed.filter((entry) => entry.row >= maxRows).length;
  if (hidden) clippedText(doc, `+${hidden}`, { x: area.x + 2, y: y + 2, width: axis - 4, height: 9, size: 6.5, color: COLORS.muted });
  y += allDayHeight;

  // Hours: those of the items, 8 h to 19 h at least.
  const timed = view.items.filter((item) => !item.allDay);
  const startHour = Math.min(8, ...timed.map((item) => (item.start.slice(0, 10) < item.end.slice(0, 10) ? 0 : Math.floor(minutesOf(item.start.slice(11)) / 60))));
  const endHour = Math.max(19, ...timed.map((item) => (item.end.slice(0, 10) > item.start.slice(0, 10) ? 24 : Math.ceil(minutesOf(item.end.slice(11)) / 60))));
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
        const startDay = item.start.slice(0, 10);
        const endDay = item.end.slice(0, 10);
        if (day < startDay || day > endDay) return null;
        const start = day === startDay ? minutesOf(item.start.slice(11)) : 0;
        const end = day === endDay ? minutesOf(item.end.slice(11)) : 24 * 60;
        return end > start || item.kind === 'time' ? { item, index, start, end: Math.max(end, start + 15) } : null;
      })
      .filter((piece) => piece !== null),
  );

  // Working hours in the background.
  for (const piece of pieces.filter((entry) => entry.item.kind === 'work')) {
    doc.rect(columnX(piece.index), yOf(piece.start), columnWidth, yOf(piece.end) - yOf(piece.start)).fill(COLORS.work);
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
    if (hour < endHour) clippedText(doc, `${String(hour).padStart(2, '0')}:00`, { x: area.x, y: lineY + 1, width: axis - 3, height: 9, size: 6.5, color: COLORS.muted });
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
    const ofDay = pieces.filter((piece) => piece.index === index && piece.item.kind !== 'work').sort((a, b) => a.start - b.start || b.end - a.end);
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
        const light = item.kind === 'time' || item.kind === 'task' || item.struck;
        doc.save();
        if (item.struck) doc.opacity(0.55);
        doc.rect(x, top, width - 1, height).fill(light ? tint(item.color, 0.2) : item.color);
        if (light) doc.rect(x, top, 2, height).fill(item.color);
        const time = `${item.start.slice(11)}–${item.end.slice(11)}`;
        clippedText(doc, `${item.title}${height > 16 ? `\n${time}` : ''}`, {
          x: x + 4,
          y: top + 1.5,
          width: width - 7,
          height: height - 2,
          size: 6.5,
          color: light ? COLORS.text : '#ffffff',
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
 * @param {Doc} doc PDF.
 * @param {z.infer<typeof calendarPdfSchema>} view View.
 * @param {{ x: number, y: number, width: number, height: number }} area Area to fill.
 * @param {string} today Today (highlighted).
 * @returns {void}
 */
function drawMonth(doc: Doc, view: z.infer<typeof calendarPdfSchema>, area: { x: number; y: number; width: number; height: number }, today: string): void {
  const weeks = Math.ceil((daysBetween(view.from, view.to) + 1) / 7);
  const headerHeight = 14;
  const cellWidth = area.width / 7;
  const cellHeight = (area.height - headerHeight) / weeks;
  const month = addDays(view.from, 15).slice(0, 7);
  WEEKDAYS.forEach((label, index) => clippedText(doc, label, { x: area.x + index * cellWidth + 4, y: area.y + 3, width: cellWidth - 8, height: 10, size: 7.5, color: COLORS.muted, bold: true }));
  const items = view.items.filter((item) => item.kind !== 'work');
  const lineHeight = 8.6;
  for (let week = 0; week < weeks; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = addDays(view.from, week * 7 + weekday);
      const x = area.x + weekday * cellWidth;
      const y = area.y + headerHeight + week * cellHeight;
      if (day === today) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.today);
      else if (day.slice(0, 7) !== month) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.light);
      doc.rect(x, y, cellWidth, cellHeight).lineWidth(0.3).strokeColor(COLORS.border).stroke();
      clippedText(doc, String(Number(day.slice(8))), { x: x + 3, y: y + 2, width: cellWidth - 6, height: 10, size: 7.5, color: day.slice(0, 7) === month ? COLORS.text : COLORS.muted, bold: true });
      const ofDay = items.filter((item) => item.start.slice(0, 10) <= day && day <= item.end.slice(0, 10)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
      const room = Math.max(0, Math.floor((cellHeight - 13) / lineHeight));
      const shown = ofDay.length > room ? ofDay.slice(0, Math.max(0, room - 1)) : ofDay;
      shown.forEach((item, index) => {
        const lineY = y + 12 + index * lineHeight;
        doc.save();
        if (item.struck) doc.opacity(0.55);
        if (item.allDay) doc.rect(x + 2, lineY, cellWidth - 4, lineHeight - 1).fill(item.kind === 'event' ? item.color : tint(item.color, 0.2));
        else doc.circle(x + 5, lineY + lineHeight / 2 - 0.5, 1.8).fill(item.color);
        const label = item.allDay ? item.title : `${item.start.slice(11)} ${item.title}`;
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
        clippedText(doc, `+${ofDay.length - shown.length} autre${ofDay.length - shown.length > 1 ? 's' : ''}`, {
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
 * and the working hours in the background; cancelled events and done tasks struck through. Light colors,
 * for printing.
 * @param {CalendarPdfInput} input View and its items.
 * @returns {Promise<Buffer>} PDF.
 */
export async function calendarPdf(input: CalendarPdfInput): Promise<Buffer> {
  const view = parseInput(calendarPdfSchema, input);
  const { today } = view;
  const doc: Doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN },
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: view.title, Creator: 'Ordo', Producer: 'Ordo' },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const width = doc.page.width - 2 * MARGIN;
  doc.font('bold').fontSize(14).fillColor(COLORS.text).text(view.title, MARGIN, MARGIN, { width, lineBreak: false });
  let top = MARGIN + 20;
  if (view.subtitle) {
    doc.font('regular').fontSize(8).fillColor(COLORS.muted).text(view.subtitle, MARGIN, top, { width, lineBreak: false, ellipsis: true });
    top += 13;
  }
  const area = { x: MARGIN, y: top + 2, width, height: doc.page.height - MARGIN - top - 2 };
  if (view.view === 'month') drawMonth(doc, view, area, today);
  else drawTimeGrid(doc, view, area, today);
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
