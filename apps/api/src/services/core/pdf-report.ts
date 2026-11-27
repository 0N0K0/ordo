import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma } from '../../db';
import { currentWorkspaceId } from '../../workspace-context';
import { currentWorkspaceFields } from '../workspaces/current-workspace';
import { fileName, LOCALE, TEXT_MAX } from '@ordo/shared';
import { PARIS } from '../../today';

/** A PDF document being written (pdfkit). */
// eslint-disable-next-line no-restricted-syntax -- PdfDoc itself.
export type PdfDoc = InstanceType<typeof PDFDocument>;

const require = createRequire(import.meta.url);
// Embedded fonts: PDF/A does not allow the standard (non-embedded) ones.
export const FONTS = {
  regular: require.resolve('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  bold: require.resolve('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
};

/** How a PDF is created: the pdfkit options, with its title and author for its properties. */
type PdfOptions = Omit<PDFKit.PDFDocumentOptions, 'info'> & { title: string; author?: string };

/**
 * Creates a PDF in Inter (« regular » and « bold » fonts), in French, its pages buffered, showing its title.
 * @param {PdfOptions} options Page size, margins… with the title (and author) of its properties.
 * @returns {{ doc: PdfDoc, end: () => Promise<Buffer> }} Document, and its ending returning the PDF.
 */
export function createPdf({ title, author, ...options }: PdfOptions): { doc: PdfDoc; end: () => Promise<Buffer> } {
  const doc: PdfDoc = new PDFDocument({
    bufferPages: true,
    font: FONTS.regular,
    lang: LOCALE,
    displayTitle: true,
    ...options,
    info: { Title: title, ...(author === undefined ? {} : { Author: author }), Creator: 'Ordo', Producer: 'Ordo' },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  /**
   * Ends the document.
   * @returns {Promise<Buffer>} PDF.
   */
  const end = async (): Promise<Buffer> => {
    doc.end();
    await done;
    return Buffer.concat(chunks);
  };
  return { doc, end };
}

/** Most characters of a printed label or title, as the app sends it (a label of `TEXT_MAX` and words around it): a bound of the request, not a field. */
export const PRINTED_LABEL_MAX = 2 * TEXT_MAX;
/** Most characters of a printed cell, as the app sends it. */
export const PRINTED_CELL_MAX = 5000;

/** Title and subtitle of an export, as the app sends them. */
export const reportHeadingSchema = z.object({
  title: z.string().trim().min(1).max(PRINTED_LABEL_MAX),
  subtitle: z.string().max(PRINTED_LABEL_MAX).default(''),
});

/** Text colors of every PDF export: the text, and what is muted (captions, footers). */
export const PDF_TEXT = { text: '#1d232b', muted: '#66707c' };

/**
 * Writes the title of an export (16 pt) and its subtitle (10 pt, muted) at the top of its content.
 * @param {PdfDoc} doc Document.
 * @param {{ title: string, subtitle?: string }} heading Title and subtitle (none: left out).
 * @param {{ x: number, y: number, width: number }} box Left, top and width of the heading.
 * @returns {number} Bottom of the heading.
 */
export function writeHeading(doc: PdfDoc, heading: { title: string; subtitle?: string }, box: { x: number; y: number; width: number }): number {
  doc.font('bold').fontSize(16).fillColor(PDF_TEXT.text).text(heading.title, box.x, box.y, { width: box.width });
  let y = doc.y + 2;
  if (heading.subtitle) {
    doc.font('regular').fontSize(10).fillColor(PDF_TEXT.muted).text(heading.subtitle, box.x, y, { width: box.width });
    y = doc.y;
  }
  return y;
}

/** Side margins of the reports. */
export const REPORT_MARGIN = 36;
/** Band of the header (logo or name, title), above the content of every page. */
const HEADER_HEIGHT = 30;
/** Band of the footer (export date, issuer, page number). */
const FOOTER_HEIGHT = 18;
/** Borders and fills of every PDF table: lines, cell backgrounds, group headings. */
export const PDF_TABLE = { border: '#dfe3e8', fill: '#f2f4f6', group: '#e7ebf0' };
const COLORS = { ...PDF_TEXT, border: PDF_TABLE.border };

// eslint-disable-next-line no-restricted-syntax -- the date of an export, in Paris.
const exportFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short', timeZone: PARIS });

export interface Report {
  doc: PdfDoc;
  /** Top of the content of a page (below the header). */
  top: number;
  /** Bottom of the content of a page (above the footer). */
  bottom: number;
  /** Writes the header and footer of every page and returns the PDF, with the name of its file. */
  finish: () => Promise<ReportFile>;
}

/** A report ready to download: the name of its file (« Titre.pdf ») and its content. */
export interface ReportFile {
  filename: string;
  content: Buffer;
}

/**
 * Issuer of the reports: the company with its logo (professional workspace), or else the workspace.
 * @returns {Promise<{ name: string, logo: Buffer | null }>} Name and logo.
 */
async function issuer(): Promise<{ name: string; logo: Buffer | null }> {
  const company = await prisma.companyProfile.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { logoId: true } });
  const logo = company?.logoId ? await prisma.attachment.findUnique({ where: { id: company.logoId }, select: { data: true } }) : null;
  return { name: await issuerName(), logo: logo ? Buffer.from(logo.data) : null };
}

/**
 * Name the exports bear: the company (professional workspace), or else the workspace.
 * @returns {Promise<string>} Name.
 */
export async function issuerName(): Promise<string> {
  const company = await prisma.companyProfile.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { name: true } });
  return company?.name.trim() || (await currentWorkspaceFields({ label: true })).label || 'Ordo';
}

/**
 * Starts a report PDF (A4 landscape, Inter) in the template shared by every export: on each page, the logo of the
 * company (or the name of the company or of the workspace) and the title at the top, the date of the export, the
 * issuer and the page number at the bottom. The content goes between `top` and `bottom`; pages added keep these
 * margins.
 * @param {{ title: string, pageTitles?: readonly string[], filename?: string, autoFirstPage?: boolean, singlePageNumber?: boolean }} options
 * Title (header and PDF properties), titles in the header of each page instead (a page without one: the title), name
 * of the file without its extension (default: the title), whether the first page is added at once (default true), and
 * whether a document of a single page shows « Page 1 / 1 » (default true).
 * @returns {Promise<Report>} Document, content area and finisher.
 */
export async function startReport({
  title,
  pageTitles = [],
  filename = title,
  autoFirstPage = true,
  singlePageNumber = true,
}: {
  title: string;
  pageTitles?: readonly string[];
  filename?: string;
  autoFirstPage?: boolean;
  singlePageNumber?: boolean;
}): Promise<Report> {
  const from = await issuer();
  const exportedAt = exportFormat.format(new Date());
  const top = REPORT_MARGIN + HEADER_HEIGHT;
  const footer = REPORT_MARGIN + FOOTER_HEIGHT;
  const { doc, end } = createPdf({
    size: 'A4',
    layout: 'landscape',
    margins: { top, left: REPORT_MARGIN, right: REPORT_MARGIN, bottom: footer },
    autoFirstPage,
    title,
    author: from.name,
  });

  /**
   * Header and footer of every page, then the PDF and the name of its file.
   * @returns {Promise<ReportFile>} File.
   */
  const finish = async (): Promise<ReportFile> => {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      const width = doc.page.width - 2 * REPORT_MARGIN;
      // Written in the margins: no automatic page break.
      doc.page.margins.top = 0;
      doc.page.margins.bottom = 0;
      const headerTop = REPORT_MARGIN - 14;
      let titleLeft = REPORT_MARGIN;
      if (from.logo) {
        try {
          doc.image(from.logo, REPORT_MARGIN, headerTop, { fit: [110, 24], valign: 'center' });
          titleLeft += 120;
        } catch {
          // An unreadable logo is left out: the name stands instead.
        }
      }
      if (titleLeft === REPORT_MARGIN) {
        doc
          .font('bold')
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(from.name, REPORT_MARGIN, headerTop + 7, { width: width / 2, lineBreak: false, ellipsis: true });
        titleLeft += width / 2;
      }
      doc
        .font('regular')
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(pageTitles[index - range.start] ?? title, titleLeft, headerTop + 8, { width: REPORT_MARGIN + width - titleLeft, align: 'right', lineBreak: false, ellipsis: true });
      doc
        .moveTo(REPORT_MARGIN, headerTop + 28)
        .lineTo(REPORT_MARGIN + width, headerTop + 28)
        .lineWidth(0.5)
        .strokeColor(COLORS.border)
        .stroke();

      const footerTop = doc.page.height - REPORT_MARGIN;
      doc
        .moveTo(REPORT_MARGIN, footerTop - 6)
        .lineTo(REPORT_MARGIN + width, footerTop - 6)
        .lineWidth(0.5)
        .strokeColor(COLORS.border)
        .stroke();
      doc.font('regular').fontSize(7).fillColor(COLORS.muted);
      doc.text(`${from.name} · Exporté le ${exportedAt}`, REPORT_MARGIN, footerTop, { width: width * 0.7, lineBreak: false, ellipsis: true });
      if (singlePageNumber || range.count > 1) doc.text(`Page ${index + 1} / ${range.count}`, REPORT_MARGIN + width * 0.7, footerTop, { width: width * 0.3, align: 'right', lineBreak: false });
    }
    return { filename: fileName(filename, 'pdf'), content: await end() };
  };

  return { doc, top, bottom: footer, finish };
}
