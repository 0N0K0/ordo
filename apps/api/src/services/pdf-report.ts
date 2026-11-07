import PDFDocument from 'pdfkit';
import { prisma, unscopedPrisma } from '../db';
import { currentWorkspaceId } from '../workspace-context';
import { FONTS } from './accounting-pdf';

type Doc = InstanceType<typeof PDFDocument>;

/** Side margins of the reports. */
export const REPORT_MARGIN = 36;
/** Band of the header (logo or name, title), above the content of every page. */
const HEADER_HEIGHT = 30;
/** Band of the footer (export date, issuer, page number). */
const FOOTER_HEIGHT = 18;
const COLORS = { text: '#1d232b', muted: '#66707c', border: '#d0d5dc' };

const exportFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

export interface Report {
  doc: Doc;
  /** Top of the content of a page (below the header). */
  top: number;
  /** Bottom of the content of a page (above the footer). */
  bottom: number;
  /** Writes the header and footer of every page and returns the PDF. */
  finish: () => Promise<Buffer>;
}

/**
 * Issuer of the reports: the company with its logo (professional workspace), or else the workspace.
 * @returns {Promise<{ name: string, logo: Buffer | null }>} Name and logo.
 */
async function issuer(): Promise<{ name: string; logo: Buffer | null }> {
  const company = await prisma.companyProfile.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { name: true, logoId: true } });
  const logo = company?.logoId ? await prisma.attachment.findUnique({ where: { id: company.logoId }, select: { data: true } }) : null;
  const name = company?.name.trim() || (await unscopedPrisma.workspace.findUnique({ where: { id: currentWorkspaceId() }, select: { name: true } }))?.name || 'Ordo';
  return { name, logo: logo ? Buffer.from(logo.data) : null };
}

/**
 * Starts a report PDF (A4 landscape, Inter) in the template shared by every export: on each page, the logo of the
 * company (or the name of the company or of the workspace) and the title at the top, the date of the export, the
 * issuer and the page number at the bottom. The content goes between `top` and `bottom`; pages added keep these
 * margins.
 * @param {{ title: string, autoFirstPage?: boolean }} options Title (header and PDF properties), and whether the
 * first page is added at once (default true).
 * @returns {Promise<Report>} Document, content area and finisher.
 */
export async function startReport({ title, autoFirstPage = true }: { title: string; autoFirstPage?: boolean }): Promise<Report> {
  const from = await issuer();
  const exportedAt = exportFormat.format(new Date());
  const top = REPORT_MARGIN + HEADER_HEIGHT;
  const footer = REPORT_MARGIN + FOOTER_HEIGHT;
  const doc: Doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top, left: REPORT_MARGIN, right: REPORT_MARGIN, bottom: footer },
    bufferPages: true,
    autoFirstPage,
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: title, Author: from.name, Creator: 'Ordo', Producer: 'Ordo' },
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
   * Header and footer of every page, then the PDF.
   * @returns {Promise<Buffer>} PDF.
   */
  const finish = async (): Promise<Buffer> => {
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
        .text(title, titleLeft, headerTop + 8, { width: REPORT_MARGIN + width - titleLeft, align: 'right', lineBreak: false, ellipsis: true });
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
      doc.text(`Page ${index + 1} / ${range.count}`, REPORT_MARGIN + width * 0.7, footerTop, { width: width * 0.3, align: 'right', lineBreak: false });
    }
    doc.end();
    await done;
    return Buffer.concat(chunks);
  };

  return { doc, top, bottom: footer, finish };
}
