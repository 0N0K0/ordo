import {
  addDays,
  CALENDAR_PDF_KINDS,
  calendarLegend,
  type CalendarLegendEntry,
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
  SLOT_PATTERNS,
  type SlotPattern,
} from '@ordo/shared';
import { z } from 'zod';
import { parseInput } from '../../graphql/errors';
import { PDF_TABLE, PDF_TEXT, type PdfDoc, PRINTED_LABEL_MAX, reportHeadingSchema, type ReportFile, startReport } from '../core/pdf-report';

/** Local date and time, "YYYY-MM-DDTHH:MM". */
const localDateTime = z.string().regex(LOCAL_DATE_TIME_PATTERN);

/** Most lanes of thin lines, or columns of backgrounds, on a day. */
const MAX_LANES = 100;

/** A view of the calendar, as displayed (filters applied), to print: its period (`title`, in the header of the page). */
const calendarPdfSchema = reportHeadingSchema
  .pick({ title: true })
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
          /** Name in the legend (the kind of a créneau or an éphéméride); none: not in the legend. */
          legend: z.string().max(PRINTED_LABEL_MAX).nullable().default(null),
          /** Hatched (another workspace) or dotted (an éphéméride). */
          pattern: z.enum(SLOT_PATTERNS).nullable().default(null),
          /** Opacity it is drawn with, as in the agenda (light backgrounds, faded when archived, events too). */
          opacity: z.number().min(0).max(1).default(1),
          /** Lane of a thin line that day; column of a background among those at the same time, and their number. */
          lane: z.number().int().min(0).max(MAX_LANES).default(0),
          column: z.number().int().min(0).max(MAX_LANES).default(0),
          columns: z.number().int().min(1).max(MAX_LANES).default(1),
        }),
      )
      .max(5000),
  })
  .refine(...endAfter('from', 'to'))
  .refine((view) => daysBetween(view.from, view.to) <= 45, 'Période invalide.');
type CalendarPdfInput = z.input<typeof calendarPdfSchema>;
type CalendarPdfView = z.infer<typeof calendarPdfSchema>;
type CalendarPdfItem = CalendarPdfView['items'][number];

/** A box of the page. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A column of a time grid: its day (the items are placed by it) and its heading. */
interface GridDay {
  date: string;
  label: string;
}

const COLORS = { ...PDF_TEXT, border: PDF_TABLE.border, light: PDF_TABLE.fill, today: '#fff8db' };
const MARGIN = 28;
/** Thickness of a thin line of slots, and the gap between two lanes (3 px and 1 px of the agenda). */
const LINE = 2.25;
const LINE_GAP = 0.75;
/** White laid over the color by each pattern, as in the agenda: its opacity. */
const PATTERN_OPACITY: Record<SlotPattern, number> = { hatched: 0.5, dotted: 0.55 };
/** Height of a row of the legend, and the gap above it. */
const LEGEND_ROW = 12;
const LEGEND_GAP = 6;

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
 * Path of a circle in the content of a PDF (four curves), not painted.
 * @param {number} cx Center, left.
 * @param {number} cy Center, top.
 * @param {number} r Radius.
 * @returns {string} Path.
 */
function circlePath(cx: number, cy: number, r: number): string {
  const k = r * 0.5523;
  return [
    `${cx + r} ${cy} m`,
    `${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c`,
    `${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c`,
    `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c`,
    `${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c`,
  ].join(' ');
}

/**
 * Stripes « / » of 3 pt across a square tile, on the diagonals x + y = offset and x + y = offset + side (both
 * overshooting the tile, cut by it).
 * @param {number} side Side of the tile.
 * @param {number} offset Where the first stripe crosses the top of the tile.
 * @returns {string} Stroked path.
 */
function stripesPath(side: number, offset: number): string {
  return [offset, offset + side, offset - side].map((c) => `${c - side - 2} ${side + 2} m ${c + 2} -2 l`).join(' ') + ' S';
}

/** A pattern drawn in two parts: the white of the pattern laid on the color, and the color alone between. */
interface PatternTiles {
  marks: PDFKit.PDFTilingPattern;
  gaps: PDFKit.PDFTilingPattern;
}

/** Tiles of the patterns of a PDF, made once per document. */
const PATTERN_TILES = new WeakMap<PdfDoc, Record<SlotPattern, PatternTiles>>();

/**
 * Tiles of the patterns, as in the agenda: stripes of 3 pt every 6 pt at 45° (hatched), dots every 4.5 pt (dotted);
 * each with its marks and the gaps between them.
 * @param {PdfDoc} doc PDF.
 * @returns {Record<SlotPattern, PatternTiles>} Tiles.
 */
function patternTiles(doc: PdfDoc): Record<SlotPattern, PatternTiles> {
  const made = PATTERN_TILES.get(doc);
  if (made) return made;
  const step = 6 * Math.SQRT2;
  const dot = circlePath(2.25, 2.25, 0.9);
  const tiles = {
    hatched: {
      marks: doc.pattern([0, 0, step, step], step, step, `3 w ${stripesPath(step, step)}`),
      gaps: doc.pattern([0, 0, step, step], step, step, `3 w ${stripesPath(step, step / 2)}`),
    },
    dotted: {
      marks: doc.pattern([0, 0, 4.5, 4.5], 4.5, 4.5, `${dot} f`),
      // The tile without its dot (even-odd).
      gaps: doc.pattern([0, 0, 4.5, 4.5], 4.5, 4.5, `0 0 4.5 4.5 re ${dot} f*`),
    },
  };
  PATTERN_TILES.set(doc, tiles);
  return tiles;
}

/**
 * Fills a box with a créneau or an éphéméride as the agenda draws it: its color, its pattern (white stripes or dots
 * laid on the color), the whole at its opacity over what is below.
 * @param {PdfDoc} doc PDF.
 * @param {Box} box Box.
 * @param {{ color: string, opacity: number, pattern: SlotPattern | null }} look Color (#rrggbb), opacity and pattern.
 * @returns {void}
 */
function fillSlot(doc: PdfDoc, box: Box, look: { color: string; opacity: number; pattern: SlotPattern | null }): void {
  if (box.height <= 0 || box.width <= 0) return;
  doc.save();
  doc.fillOpacity(look.opacity);
  if (look.pattern) {
    const tiles = patternTiles(doc)[look.pattern];
    // The marks in the color whitened by the pattern, the gaps in the color: each point painted once.
    doc.rect(box.x, box.y, box.width, box.height).fill([tiles.marks, tint(look.color, 1 - PATTERN_OPACITY[look.pattern])]);
    doc.rect(box.x, box.y, box.width, box.height).fill([tiles.gaps, look.color]);
  } else doc.rect(box.x, box.y, box.width, box.height).fill(look.color);
  doc.restore();
}

/**
 * Lighter look of an item of the time grid or of the all-day row: tint, stripe in its color, dark text (a slot apart:
 * `paintItem`).
 * @param {CalendarPdfItem} item Item.
 * @returns {{ fill: string, stripe: boolean, text: string } | null} Look, or none: filled in its color, white text.
 */
function lightLook(item: CalendarPdfItem): { fill: string; stripe: boolean; text: string } | null {
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
 * Opacity of an item other than a créneau or an éphéméride (those carry it in their fill): its own (an archived one
 * faded), or that of a struck through one; the fainter of both, not multiplied (as on screen, both set the same
 * opacity).
 * @param {CalendarPdfItem} item Item.
 * @returns {number} Opacity (0 to 1).
 */
function itemOpacity(item: CalendarPdfItem): number {
  return Math.min(item.kind === 'slot' ? 1 : item.opacity, item.struck ? 0.55 : 1);
}

/**
 * Paints the box of an item of the all-day row or of the time grid: a créneau or an éphéméride as the agenda draws it
 * (`fillSlot`), another item filled in its color or in its lighter look (`lightLook`).
 * @param {PdfDoc} doc PDF.
 * @param {CalendarPdfItem} item Item.
 * @param {Box} box Box.
 * @returns {string} Color of its text.
 */
function paintItem(doc: PdfDoc, item: CalendarPdfItem, box: Box): string {
  if (item.kind === 'slot') {
    fillSlot(doc, box, item);
    return COLORS.text;
  }
  const look = lightLook(item);
  doc.rect(box.x, box.y, box.width, box.height).fill(look?.fill ?? item.color);
  if (look?.stripe) doc.rect(box.x, box.y, 2, box.height).fill(item.color);
  return look?.text ?? '#ffffff';
}

/**
 * Week or day grid: a column per day, an all-day row, then the hours with the créneaux and éphémérides in the
 * background (side by side when at the same time) or as thin lines on the left of their hours (in lanes), and the timed
 * items side by side when they overlap. The days are those given, consecutive, each with its heading.
 * @param {PdfDoc} doc PDF.
 * @param {{ days: readonly GridDay[], items: readonly CalendarPdfItem[], today: string | null }} grid Days, items,
 * and the day highlighted (none: no day).
 * @param {Box} area Area to fill.
 * @returns {void}
 */
function drawTimeGrid(doc: PdfDoc, { days, items, today }: { days: readonly GridDay[]; items: readonly CalendarPdfItem[]; today: string | null }, area: Box): void {
  const from = days[0].date;
  const to = days[days.length - 1].date;
  const axis = 30;
  const columnWidth = (area.width - axis) / days.length;
  const columnX = (index: number) => area.x + axis + index * columnWidth;

  // Day headers.
  const headerHeight = 16;
  days.forEach((day, index) => {
    if (day.date === today) doc.rect(columnX(index), area.y, columnWidth, headerHeight).fill(COLORS.today);
    clippedText(doc, day.label, { x: columnX(index) + 3, y: area.y + 4, width: columnWidth - 6, height: 10, size: 7.5, color: COLORS.text, bold: true });
  });
  let y = area.y + headerHeight;

  // All-day row: bars over their days, on as few rows as possible.
  const allDay = items
    .filter((item) => item.allDay && item.kind !== 'background' && item.kind !== 'line' && dayPart(item.start) <= to && dayPart(item.end) >= from)
    .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const rows: string[][] = [];
  const placed = allDay.map((item) => {
    const first = Math.max(0, daysBetween(from, dayPart(item.start)));
    const last = Math.min(days.length - 1, daysBetween(from, dayPart(item.end)));
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
    doc.save();
    doc.opacity(itemOpacity(item));
    const text = paintItem(doc, item, { x, y: top, width, height: barHeight });
    clippedText(doc, item.label, { x: x + 4, y: top + 1.8, width: width - 6, height: barHeight - 2, size: 6.5, color: text, struck: item.struck });
    doc.restore();
  }
  const hidden = placed.filter((entry) => entry.row >= maxRows).length;
  if (hidden) clippedText(doc, `+${hidden}`, { x: area.x + 2, y: y + 2, width: axis - 4, height: 9, size: 6.5, color: COLORS.muted });
  y += allDayHeight;

  // Hours: those of the items, 8 h to 19 h at least (a background or a line over whole days does not widen them).
  const timed = items.filter((item) => !item.allDay);
  const ranged = timed.filter((item) => (item.kind !== 'background' && item.kind !== 'line') || item.start.slice(11) !== '00:00' || item.end.slice(11) !== '00:00');
  const startHour = Math.min(8, ...ranged.map((item) => (dayPart(item.start) < dayPart(item.end) ? 0 : Math.floor(timeToMinutes(item.start.slice(11)) / 60))));
  const endHour = Math.max(19, ...ranged.map((item) => (dayPart(item.end) > dayPart(item.start) ? 24 : Math.ceil(timeToMinutes(item.end.slice(11)) / 60))));
  const gridTop = y;
  const hourHeight = (area.y + area.height - gridTop) / (endHour - startHour);
  const yOf = (minutes: number) => gridTop + ((Math.min(Math.max(minutes, startHour * 60), endHour * 60) - startHour * 60) / 60) * hourHeight;

  days.forEach((day, index) => {
    if (day.date === today) doc.rect(columnX(index), gridTop, columnWidth, (endHour - startHour) * hourHeight).fill(tint('#fab005', 0.08));
  });

  // Pieces of timed items on each day (an item over midnight is cut).
  const pieces = timed.flatMap((item) =>
    days
      .map((day, index) => {
        const startDay = dayPart(item.start);
        const endDay = dayPart(item.end);
        if (day.date < startDay || day.date > endDay) return null;
        const start = day.date === startDay ? timeToMinutes(item.start.slice(11)) : 0;
        const end = day.date === endDay ? timeToMinutes(item.end.slice(11)) : 24 * 60;
        return end > start || item.kind === 'time' ? { item, index, start, end: Math.max(end, start + 15) } : null;
      })
      .filter((piece) => piece !== null),
  );

  // Créneaux and éphémérides in the background, side by side when at the same time, or as thin lines in their lane.
  for (const { item, index, start, end } of pieces) {
    const height = yOf(end) - yOf(start);
    if (item.kind === 'line') fillSlot(doc, { x: columnX(index) + item.lane * (LINE + LINE_GAP), y: yOf(start), width: LINE, height }, item);
    else if (item.kind === 'background') {
      const width = columnWidth / item.columns;
      fillSlot(doc, { x: columnX(index) + Math.min(item.column, item.columns - 1) * width, y: yOf(start), width, height }, item);
    }
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
    const ofDay = pieces.filter((piece) => piece.index === index && piece.item.kind !== 'background' && piece.item.kind !== 'line').sort((a, b) => a.start - b.start || b.end - a.end);
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
        doc.save();
        doc.opacity(itemOpacity(item));
        const text = paintItem(doc, item, { x, y: top, width: width - 1, height });
        const time = `${item.start.slice(11)}–${item.end.slice(11)}`;
        clippedText(doc, `${item.label}${height > 16 ? `\n${time}` : ''}`, {
          x: x + 4,
          y: top + 1.5,
          width: width - 7,
          height: height - 2,
          size: 6.5,
          color: text,
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
 * Month view: weeks of days, each with its créneaux and éphémérides in the background or as thin lines at its bottom
 * (in lanes), listing its items (time and title), "+n" when they do not fit.
 * @param {PdfDoc} doc PDF.
 * @param {CalendarPdfView} view View.
 * @param {Box} area Area to fill.
 * @param {string} today Today (highlighted).
 * @returns {void}
 */
function drawMonth(doc: PdfDoc, view: CalendarPdfView, area: Box, today: string): void {
  const weeks = Math.ceil((daysBetween(view.from, view.to) + 1) / 7);
  const headerHeight = 14;
  const cellWidth = area.width / 7;
  const cellHeight = (area.height - headerHeight) / weeks;
  const month = monthOfDay(addDays(view.from, 15));
  // The days of the week from the first day shown (the first day of the week of the workspace).
  Array.from({ length: 7 }, (_, index) => WEEKDAY_SHORT_LABELS[weekdayOfDate(addDays(view.from, index)) - 1]).forEach((label, index) =>
    clippedText(doc, label, { x: area.x + index * cellWidth + 4, y: area.y + 3, width: cellWidth - 8, height: 10, size: 7.5, color: COLORS.muted, bold: true }),
  );
  const items = view.items.filter((item) => item.kind !== 'background' && item.kind !== 'line');
  const behind = view.items.filter((item) => item.kind === 'background' || item.kind === 'line');
  /**
   * Whether an item is on a day.
   * @param {CalendarPdfItem} item Item.
   * @param {string} day Day.
   * @returns {boolean} On it.
   */
  const onDay = (item: CalendarPdfItem, day: string) => dayPart(item.start) <= day && day <= dayPart(item.end);
  const lineHeight = 8.6;
  for (let week = 0; week < weeks; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = addDays(view.from, week * 7 + weekday);
      const x = area.x + weekday * cellWidth;
      const y = area.y + headerHeight + week * cellHeight;
      if (day === today) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.today);
      else if (monthOfDay(day) !== month) doc.rect(x, y, cellWidth, cellHeight).fill(COLORS.light);
      for (const slot of behind.filter((item) => onDay(item, day))) {
        if (slot.kind === 'line') fillSlot(doc, { x, y: y + cellHeight - (slot.lane + 1) * LINE - slot.lane * LINE_GAP, width: cellWidth, height: LINE }, slot);
        else fillSlot(doc, { x, y, width: cellWidth, height: cellHeight }, slot);
      }
      doc.rect(x, y, cellWidth, cellHeight).lineWidth(0.3).strokeColor(COLORS.border).stroke();
      clippedText(doc, String(dayOfMonthOf(day)), { x: x + 3, y: y + 2, width: cellWidth - 6, height: 10, size: 7.5, color: monthOfDay(day) === month ? COLORS.text : COLORS.muted, bold: true });
      const ofDay = items.filter((item) => onDay(item, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
      const room = Math.max(0, Math.floor((cellHeight - 13) / lineHeight));
      const shown = ofDay.length > room ? ofDay.slice(0, Math.max(0, room - 1)) : ofDay;
      shown.forEach((item, index) => {
        const lineY = y + 12 + index * lineHeight;
        doc.save();
        doc.opacity(itemOpacity(item));
        const box = { x: x + 2, y: lineY, width: cellWidth - 4, height: lineHeight - 1 };
        if (item.allDay && item.kind === 'slot') fillSlot(doc, box, item);
        else if (item.allDay) doc.rect(box.x, box.y, box.width, box.height).fill(item.kind === 'event' ? item.color : tint(item.color, 0.2));
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

/** Size of the glyphs of the legend: a square, a line (as wide as two squares). */
const LEGEND_SQUARE = 8;
const LEGEND_LINE = { width: 16, height: 4 };
/** Font size of the names of the legend. */
const LEGEND_SIZE = 7;

/**
 * Places of the entries of a legend, row after row: glyph, then name.
 * @param {PdfDoc} doc PDF.
 * @param {readonly CalendarLegendEntry[]} entries Entries.
 * @param {number} width Width of the legend.
 * @returns {{ places: { entry: CalendarLegendEntry, x: number, row: number, name: number }[], rows: number }} Left, row and width of the name of each entry, and the number of rows.
 */
function legendLayout(doc: PdfDoc, entries: readonly CalendarLegendEntry[], width: number): { places: { entry: CalendarLegendEntry; x: number; row: number; name: number }[]; rows: number } {
  doc.font('regular').fontSize(LEGEND_SIZE);
  let x = 0;
  let row = 0;
  const places = entries.map((entry) => {
    const glyph = entry.glyph === 'square' ? LEGEND_SQUARE : LEGEND_LINE.width;
    const name = Math.min(doc.widthOfString(entry.name), width - glyph - 4);
    const size = glyph + 4 + name;
    if (x > 0 && x + size > width) {
      x = 0;
      row += 1;
    }
    const place = { entry, x, row, name };
    x += size + 12;
    return place;
  });
  return { places, rows: entries.length ? row + 1 : 0 };
}

/**
 * Height of a legend of colors.
 * @param {PdfDoc} doc PDF.
 * @param {readonly CalendarLegendEntry[]} entries Entries.
 * @param {number} width Width of the legend.
 * @returns {number} Height (none: 0).
 */
function legendHeight(doc: PdfDoc, entries: readonly CalendarLegendEntry[], width: number): number {
  return legendLayout(doc, entries, width).rows * LEGEND_ROW;
}

/**
 * Legend of the colors of the créneaux and éphémérides shown: each kind as a square (backgrounds, blocks of hours) or
 * a line (bars, thin lines) in its color, its opacity and its pattern, then its name.
 * @param {PdfDoc} doc PDF.
 * @param {readonly CalendarLegendEntry[]} entries Entries.
 * @param {{ x: number, y: number, width: number }} box Left, top and width of the legend.
 * @returns {void}
 */
function drawLegend(doc: PdfDoc, entries: readonly CalendarLegendEntry[], box: { x: number; y: number; width: number }): void {
  for (const { entry, x, row, name } of legendLayout(doc, entries, box.width).places) {
    const left = box.x + x;
    const middle = box.y + row * LEGEND_ROW + LEGEND_ROW / 2;
    const glyph = entry.glyph === 'square' ? { width: LEGEND_SQUARE, height: LEGEND_SQUARE } : LEGEND_LINE;
    const glyphBox = { x: left, y: middle - glyph.height / 2, width: glyph.width, height: glyph.height };
    fillSlot(doc, glyphBox, entry);
    // A square outlined: a light background stands out on the paper.
    if (entry.glyph === 'square') doc.rect(glyphBox.x, glyphBox.y, glyphBox.width, glyphBox.height).lineWidth(0.3).strokeColor(COLORS.muted).stroke();
    clippedText(doc, entry.name, { x: left + glyph.width + 4, y: middle - LEGEND_SIZE * 0.6, width: name + 1, height: LEGEND_SIZE * 1.2, size: LEGEND_SIZE, color: COLORS.text });
  }
}

/**
 * PDF (A4 landscape) of a calendar view as displayed: month grid, or week / day hours with the all-day row; the
 * créneaux and éphémérides drawn as the agenda shows them (bars, backgrounds side by side, thin lines in lanes,
 * hatched or dotted, faded when archived), their legend at the bottom of the page; cancelled events and done tasks
 * struck through. Light colors, for printing, in the template shared by every export (logo, period and page number
 * when there are several pages).
 * @param {CalendarPdfInput} input View and its items.
 * @returns {Promise<ReportFile>} PDF and its file name.
 */
export async function calendarPdf(input: CalendarPdfInput): Promise<ReportFile> {
  const view = parseInput(calendarPdfSchema, input);
  const { today } = view;
  const { doc, top, finish } = await startReport({ title: view.title, singlePageNumber: false });

  const width = doc.page.width - 2 * MARGIN;
  const legend = calendarLegend(view.items);
  const legendSpace = legend.length ? legendHeight(doc, legend, width) + LEGEND_GAP : 0;
  const y = top + 6;
  const area = { x: MARGIN, y, width, height: doc.page.height - doc.page.margins.bottom - y - legendSpace };
  if (view.view === 'month') drawMonth(doc, view, area, today);
  else {
    const days = Array.from({ length: daysBetween(view.from, view.to) + 1 }, (_, index) => addDays(view.from, index)).map((date) => ({ date, label: weekdayText(date) }));
    drawTimeGrid(doc, { days, items: view.items, today }, area);
  }
  if (legend.length) drawLegend(doc, legend, { x: MARGIN, y: area.y + area.height + LEGEND_GAP, width });
  return finish();
}
