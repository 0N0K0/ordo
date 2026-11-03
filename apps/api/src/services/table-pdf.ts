import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { parseInput } from '../graphql/errors';
import { FONTS } from './accounting-pdf';

type Doc = InstanceType<typeof PDFDocument>;

/** Table printed as a PDF: the rows and columns the user sees, already formatted. */
export const tablePdfSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().max(500).default(''),
  columns: z.array(z.string().max(80)).min(1).max(30),
  rows: z
    .array(
      z.object({
        kind: z.enum(['group', 'task', 'event']),
        depth: z.number().int().min(0).max(20).default(0),
        cells: z.array(z.string().max(5000)).max(30),
      }),
    )
    .max(10_000),
});
export type TablePdfInput = z.input<typeof tablePdfSchema>;

const COLORS = { text: '#1d232b', muted: '#66707c', border: '#dfe3e8', fill: '#f2f4f6', group: '#e7ebf0', task: '#2f9e44', event: '#1c7ed6' };
const MARGIN = 36;
const PAD = 4;
const FONT_SIZE = 8;
const INDENT = 10;
/** Room for the marker of the first cell (task or event). */
const MARKER = 10;
/** Widest a column grows to fit its longest text before wrapping it (the first one, the title, more). */
const MAX_NATURAL = { first: 340, other: 170 };

/**
 * Column widths fitting the page: each column at least as wide as its longest word, at most its longest text
 * (capped); the room left is shared in proportion, and narrow pages shrink the wide columns first.
 * @param {Doc} doc PDF document (fonts registered).
 * @param {z.infer<typeof tablePdfSchema>} table Table.
 * @param {number} pageWidth Width to fill.
 * @returns {number[]} Widths.
 */
function columnWidths(doc: Doc, table: z.infer<typeof tablePdfSchema>, pageWidth: number): number[] {
  const measure = (text: string, bold: boolean) => doc.font(bold ? 'bold' : 'regular').fontSize(FONT_SIZE).widthOfString(text);
  const columns = table.columns.map((label, index) => {
    const extra = 2 * PAD + (index === 0 ? MARKER + INDENT * Math.max(0, ...table.rows.map((row) => row.depth)) : 0);
    const texts = table.rows.filter((row) => row.kind !== 'group').map((row) => row.cells[index] ?? '');
    const words = [...label.split(/\s+/).map((word) => measure(word, true)), ...texts.flatMap((text) => text.split(/\s+/).map((word) => measure(word, false)))];
    const minimum = Math.max(24, ...words) + extra;
    const natural = Math.max(minimum, Math.min(index === 0 ? MAX_NATURAL.first : MAX_NATURAL.other, Math.max(measure(label, true), ...texts.map((text) => measure(text, false)))) + extra);
    return { minimum, natural };
  });
  const naturalSum = columns.reduce((sum, column) => sum + column.natural, 0);
  if (naturalSum <= pageWidth) return columns.map((column) => (column.natural / naturalSum) * pageWidth);
  const minimumSum = columns.reduce((sum, column) => sum + column.minimum, 0);
  if (minimumSum >= pageWidth) return columns.map((column) => (column.minimum / minimumSum) * pageWidth);
  // Between the two: every column keeps its minimum, the rest goes in proportion of what each would like.
  const ratio = (pageWidth - minimumSum) / (naturalSum - minimumSum);
  return columns.map((column) => column.minimum + (column.natural - column.minimum) * ratio);
}

/**
 * PDF (A4 landscape) of a table: title, subtitle, header repeated on each page, group rows, tasks with a square
 * marker and events with a round one in the first column, indented by level; page numbers in the footer.
 * @param {TablePdfInput} input Table.
 * @returns {Promise<Buffer>} PDF.
 */
export async function tablePdf(input: TablePdfInput): Promise<Buffer> {
  const table = parseInput(tablePdfSchema, input);
  const doc: Doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + 14 },
    bufferPages: true,
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: table.title, Creator: 'Ordo', Producer: 'Ordo' },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width - 2 * MARGIN;
  const widths = columnWidths(doc, table, pageWidth);
  const xs = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  let y = MARGIN;

  doc.font('bold').fontSize(14).fillColor(COLORS.text).text(table.title, MARGIN, y, { width: pageWidth });
  y = doc.y + 2;
  if (table.subtitle) {
    doc.font('regular').fontSize(8.5).fillColor(COLORS.muted).text(table.subtitle, MARGIN, y, { width: pageWidth });
    y = doc.y;
  }
  y += 8;

  /**
   * Header row (column labels).
   * @returns {void}
   */
  const header = () => {
    doc.font('bold').fontSize(FONT_SIZE);
    const height = Math.max(...table.columns.map((label, index) => doc.heightOfString(label, { width: widths[index] - 2 * PAD }))) + 2 * PAD;
    doc.rect(MARGIN, y, pageWidth, height).fill(COLORS.fill);
    doc.fillColor(COLORS.text);
    table.columns.forEach((label, index) => doc.text(label, xs[index] + PAD, y + PAD, { width: widths[index] - 2 * PAD }));
    y += height;
  };

  /**
   * Starts a new page when a row of that height does not fit.
   * @param {number} height Row height.
   * @returns {void}
   */
  const ensure = (height: number) => {
    if (y + height <= bottom()) return;
    doc.addPage();
    y = MARGIN;
    header();
  };

  header();
  for (const row of table.rows) {
    if (row.kind === 'group') {
      doc.font('bold').fontSize(FONT_SIZE + 0.5);
      const label = row.cells[0] ?? '';
      const height = doc.heightOfString(label, { width: pageWidth - 2 * PAD }) + 2 * PAD;
      ensure(height + 14);
      doc.rect(MARGIN, y, pageWidth, height).fill(COLORS.group);
      doc.fillColor(COLORS.text).text(label, MARGIN + PAD, y + PAD, { width: pageWidth - 2 * PAD });
      y += height;
      continue;
    }
    doc.font('regular').fontSize(FONT_SIZE);
    const indent = row.depth * INDENT + MARKER;
    const cellWidth = (index: number) => Math.max(10, widths[index] - 2 * PAD - (index === 0 ? indent : 0));
    const height = Math.max(...table.columns.map((_, index) => doc.heightOfString(row.cells[index] ?? '', { width: cellWidth(index) }))) + 2 * PAD;
    ensure(height);
    // Marker: square for a task, dot for an event.
    const markerX = MARGIN + PAD + row.depth * INDENT;
    const markerY = y + PAD + FONT_SIZE / 2;
    if (row.kind === 'event') doc.circle(markerX + 2.5, markerY, 2.5).fill(COLORS.event);
    else doc.rect(markerX, markerY - 2.5, 5, 5).lineWidth(0.8).stroke(COLORS.task);
    doc.fillColor(COLORS.text);
    table.columns.forEach((_, index) =>
      doc.text(row.cells[index] ?? '', xs[index] + PAD + (index === 0 ? indent : 0), y + PAD, { width: cellWidth(index) }),
    );
    y += height;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + pageWidth, y).lineWidth(0.4).strokeColor(COLORS.border).stroke();
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    // Written in the bottom margin: no automatic page break.
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(7).fillColor(COLORS.muted);
    doc.text(`${index + 1} / ${range.count}`, MARGIN, doc.page.height - MARGIN, { width: pageWidth, align: 'right', lineBreak: false });
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
