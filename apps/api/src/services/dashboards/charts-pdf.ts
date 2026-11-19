import { z } from 'zod';
import { parseInput } from '../../graphql/errors';
import { PDF_TEXT, REPORT_MARGIN, reportHeadingSchema, startReport, writeHeading } from '../core/pdf-report';

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/** Charts drawn by the app (PNG images) to print. */
const chartsPdfSchema = reportHeadingSchema.extend({
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
type ChartsPdfInput = z.input<typeof chartsPdfSchema>;

/**
 * PDF (A4 landscape) of charts: one per page (the image shows its title) with its description, the first page
 * also with the title of the export; in the template shared by every export (logo, date, page numbers).
 * @param {ChartsPdfInput} input Charts.
 * @returns {Promise<Buffer>} PDF.
 */
export async function chartsPdf(input: ChartsPdfInput): Promise<Buffer> {
  const data = parseInput(chartsPdfSchema, input);
  const { doc, top, finish } = await startReport({ title: data.title, autoFirstPage: false });

  data.charts.forEach((chart, index) => {
    doc.addPage();
    const width = doc.page.width - 2 * REPORT_MARGIN;
    let y = top;
    if (index === 0) {
      y = writeHeading(doc, data, { x: REPORT_MARGIN, y, width }) + 12;
    }
    // The image already shows the chart title.
    if (chart.description) {
      doc.font('regular').fontSize(8.5).fillColor(PDF_TEXT.muted).text(chart.description, REPORT_MARGIN, y, { width });
      y = doc.y;
    }
    y += 8;
    const image = Buffer.from(PNG_DATA_URL.exec(chart.image)![1], 'base64');
    doc.image(image, REPORT_MARGIN, y, { fit: [width, doc.page.height - doc.page.margins.bottom - y], align: 'center' });
  });

  return finish();
}
