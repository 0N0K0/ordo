import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { parseInput } from '../graphql/errors';
import { FONTS } from './accounting-pdf';

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/** Charts drawn by the app (PNG images) to print. */
export const chartsPdfSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().max(500).default(''),
  charts: z
    .array(
      z.object({
        title: z.string().max(200),
        description: z.string().max(500).default(''),
        image: z.string().max(12_000_000).regex(PNG_DATA_URL, 'Image PNG attendue.'),
      }),
    )
    .min(1)
    .max(40),
});
export type ChartsPdfInput = z.input<typeof chartsPdfSchema>;

const COLORS = { text: '#1d232b', muted: '#66707c' };
const MARGIN = 36;

/**
 * PDF (A4 landscape) of charts: one per page (the image shows its title) with its description, the first page
 * also with the title of the export; page numbers in the footer.
 * @param {ChartsPdfInput} input Charts.
 * @returns {Promise<Buffer>} PDF.
 */
export async function chartsPdf(input: ChartsPdfInput): Promise<Buffer> {
  const data = parseInput(chartsPdfSchema, input);
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + 14 },
    bufferPages: true,
    autoFirstPage: false,
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: data.title, Creator: 'Ordo', Producer: 'Ordo' },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  data.charts.forEach((chart, index) => {
    doc.addPage();
    const width = doc.page.width - 2 * MARGIN;
    let y = MARGIN;
    if (index === 0) {
      doc.font('bold').fontSize(16).fillColor(COLORS.text).text(data.title, MARGIN, y, { width });
      y = doc.y + 2;
      if (data.subtitle) {
        doc.font('regular').fontSize(8.5).fillColor(COLORS.muted).text(data.subtitle, MARGIN, y, { width });
        y = doc.y;
      }
      y += 12;
    }
    // The image already shows the chart title.
    if (chart.description) {
      doc.font('regular').fontSize(8.5).fillColor(COLORS.muted).text(chart.description, MARGIN, y, { width });
      y = doc.y;
    }
    y += 8;
    const image = Buffer.from(PNG_DATA_URL.exec(chart.image)![1], 'base64');
    doc.image(image, MARGIN, y, { fit: [width, doc.page.height - doc.page.margins.bottom - y], align: 'center' });
  });

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(7).fillColor(COLORS.muted);
    doc.text(`${index + 1} / ${range.count}`, MARGIN, doc.page.height - MARGIN, { width: doc.page.width - 2 * MARGIN, align: 'right', lineBreak: false });
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
