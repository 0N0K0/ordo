import { createRequire } from 'node:module';
import {
  addressLines,
  depositAmount,
  formatMoney,
  UNIT_LABELS,
  type AccountingDocumentType,
  type Address,
  type DocumentTotals,
} from '@ordo/shared';
import PDFDocument from 'pdfkit';
import { prisma } from '../db';
import { clientError } from '../graphql/errors';
import {
  buyerSnapshot,
  documentTotals,
  findDocument,
  lineInput,
  sellerSnapshot,
  type Buyer,
  type DocumentWithLines,
  type Seller,
} from './accounting-documents';
import { documentBalances } from './document-tracking';
import {
  FACTUR_X_FILENAME,
  facturXml,
  facturXmp,
  hasFacturX,
} from './factur-x';

const require = createRequire(import.meta.url);
// Embedded fonts: PDF/A does not allow the standard (non-embedded) ones.
export const FONTS = {
  regular:
    require.resolve('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  bold: require.resolve('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
};

const TYPE_TITLES: Record<AccountingDocumentType, string> = {
  QUOTE: 'Devis',
  INVOICE: 'Facture',
  DEPOSIT_INVOICE: 'Facture d’acompte',
  CREDIT_NOTE: 'Avoir',
};

const COLORS = {
  text: '#1d232b',
  muted: '#66707c',
  border: '#dfe3e8',
  fill: '#f2f4f6',
  accent: '#aa9371',
};
const PAGE = { margin: 34, bottom: 60 };

const countryNames = new Intl.DisplayNames('fr', { type: 'region' });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

/**
 * Printed date (dd/mm/yyyy).
 * @param {Date} date Calendar date (midnight UTC).
 * @returns {string} Date.
 */
const printedDate = (date: Date) => dateFormat.format(date);

/**
 * Lines of an address, the country spelled out (omitted for France).
 * @param {unknown} address Stored address.
 * @returns {string[]} Lines.
 */
function printedAddress(address: unknown): string[] {
  if (!address) return [];
  return addressLines(
    address as Address,
    (code) => countryNames.of(code) ?? code,
  );
}

/** Block of a markdown text, as printed: plain paragraph, heading or list item. */
interface TextBlock {
  text: string;
  heading: boolean;
  bullet: string | null;
  indent?: number;
  task?: boolean;
}

/**
 * Markdown as printable blocks: headings, list items and paragraphs, inline marks removed.
 * @param {string} markdown Markdown.
 * @returns {TextBlock[]} Blocks.
 */
function markdownBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];

  const inline = (text: string) =>
    text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/(^|\W)_([^_]+)_(?!\w)/g, '$1$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*>\s?/, '');

  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        text: inline(paragraph.join(' ')),
        heading: false,
        bullet: null,
      });
      paragraph = [];
    }
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const trimmed = line.trim();

    if (!trimmed || /^(-{3,}|\*{3,})$/.test(trimmed)) {
      flush();
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);

    if (heading) {
      flush();
      blocks.push({
        text: inline(heading[1]),
        heading: true,
        bullet: null,
      });
      continue;
    }

    const indent = Math.floor((line.length - line.trimStart().length) / 2);

    const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);

    if (task) {
      flush();
      blocks.push({
        text: inline(task[2]),
        heading: false,
        bullet: task[1].toLowerCase() === 'x' ? '1' : '0',
        indent,
        task: true,
      });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);

    if (bullet) {
      flush();
      blocks.push({
        text: inline(bullet[1]),
        heading: false,
        bullet: '•',
        indent,
      });
      continue;
    }

    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);

    if (ordered) {
      flush();
      blocks.push({
        text: inline(ordered[2]),
        heading: false,
        bullet: `${ordered[1]}.`,
        indent,
      });
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();

  return blocks;
}
type Doc = PDFKit.PDFDocument;

/**
 * Writes text blocks at a position, or measures them.
 * @param {Doc} doc PDF document.
 * @param {TextBlock[]} blocks Blocks.
 * @param {object} box Position and style.
 * @param {number} box.x Left.
 * @param {number} box.y Top.
 * @param {number} box.width Width.
 * @param {number} box.size Font size.
 * @param {string} box.color Color.
 * @param {boolean} [measure] Only measure. Optional.
 * @returns {number} Height.
 */
function writeBlocks(
  doc: Doc,
  blocks: TextBlock[],
  box: {
    x: number;
    y: number;
    width: number;
    size: number;
    color: string;
  },
  measure = false,
): number {
  let y = box.y;

  for (const block of blocks) {
    doc
      .font(block.heading ? 'bold' : 'regular')
      .fontSize(block.heading ? box.size + 1 : box.size);

    const levelIndent = (block.indent ?? 0) * 12;
    const markerWidth = block.task ? 16 : block.bullet ? 16 : 0;

    const textX = box.x + levelIndent + markerWidth;
    const textWidth = Math.max(1, box.width - levelIndent - markerWidth);

    const options = {
      width: textWidth,
      lineGap: 1.5,
    };

    const height = doc.heightOfString(block.text, options);

    if (!measure) {
      doc.fillColor(box.color);

      if (block.task) {
        const iconX = box.x + levelIndent;
        const iconY = y + 2;
        const size = 8;

        doc
          .lineWidth(0.8)
          .strokeColor(box.color)
          .rect(iconX, iconY, size, size)
          .stroke();

        if (block.bullet === '1') {
          doc
            .lineWidth(1.2)
            .moveTo(iconX + 1.5, iconY + 4)
            .lineTo(iconX + 3.5, iconY + 6)
            .lineTo(iconX + 6.5, iconY + 2)
            .stroke();
        }
      }

      if (block.bullet && !block.task) {
        doc.text(block.bullet, box.x + levelIndent, y, {
          width: markerWidth,
          lineBreak: false,
        });
      }

      doc.text(block.text, textX, y, options);
    }

    y += height + box.size * 0.4;
  }

  return y - box.y;
}
/**
 * Flowing writer: keeps the vertical position and adds pages when a block does not fit.
 */
class Flow {
  y: number;

  /**
   * @param {Doc} doc PDF document.
   */
  constructor(private readonly doc: Doc) {
    this.y = doc.page.margins.top;
  }

  /**
   * Bottom limit of the content.
   * @returns {number} Y.
   */
  get limit(): number {
    return this.doc.page.height - this.doc.page.margins.bottom;
  }

  /**
   * Starts a new page when a block of a height does not fit (unless the page is still empty).
   * @param {number} height Block height.
   * @returns {boolean} True when a page was added.
   */
  ensure(height: number): boolean {
    if (this.y + height <= this.limit || this.y <= this.doc.page.margins.top)
      return false;
    this.doc.addPage();
    this.y = this.doc.page.margins.top;
    return true;
  }

  /**
   * Writes a markdown text across pages, block by block.
   * @param {string} markdown Markdown.
   * @param {object} [style] Style. Optional.
   * @param {number} [style.size] Font size. Optional. Default = 9.5.
   * @param {string} [style.color] Color. Optional.
   * @returns {void}
   */
  markdown(
    markdown: string,
    style: { size?: number; color?: string } = {},
  ): void {
    const size = style.size ?? 9.5;
    const width = this.doc.page.width - 2 * PAGE.margin;
    // Block by block, so that a long text continues on the next page.
    for (const block of markdownBlocks(markdown)) {
      const box = {
        x: PAGE.margin,
        y: this.y,
        width,
        size,
        color: style.color ?? COLORS.text,
      };
      this.ensure(writeBlocks(this.doc, [block], box, true));
      this.y += writeBlocks(this.doc, [block], { ...box, y: this.y });
    }
  }

  /**
   * Leaves a vertical space.
   * @param {number} height Space.
   * @returns {void}
   */
  space(height: number): void {
    this.y += height;
  }
}

/** Columns of the lines table. */
interface Column {
  key: 'title' | 'quantity' | 'unit' | 'price' | 'discount' | 'vat' | 'total';
  label: string;
  width: number;
  align: 'left' | 'right';
}

/**
 * Columns of the lines table (no discount column without discounts, no VAT column when VAT does not apply).
 * @param {number} width Table width.
 * @param {boolean} vatApplicable Whether VAT applies.
 * @param {boolean} discounts Whether a line has a discount.
 * @returns {(Column & { x: number })[]} Columns with their left position.
 */
function tableColumns(
  width: number,
  vatApplicable: boolean,
  discounts: boolean,
): (Column & { x: number })[] {
  const fixed: Column[] = [
    { key: 'quantity', label: 'Qté', width: 42, align: 'right' },
    { key: 'unit', label: 'Unité', width: 52, align: 'left' },
    { key: 'price', label: 'PU HT', width: 72, align: 'right' },
    ...(discounts
      ? [{ key: 'discount', label: 'Remise', width: 66, align: 'right' } as const]
      : []),
    ...(vatApplicable
      ? [{ key: 'vat', label: 'TVA', width: 40, align: 'right' } as const]
      : []),
    {
      key: 'total',
      label: vatApplicable ? 'Total HT' : 'Total',
      width: 78,
      align: 'right',
    },
  ];
  const columns: Column[] = [
    {
      key: 'title',
      label: 'Désignation',
      width: width - fixed.reduce((sum, column) => sum + column.width, 0),
      align: 'left',
    },
    ...fixed,
  ];
  let x = PAGE.margin;
  return columns.map((column) => {
    const placed = { ...column, x };
    x += column.width;
    return placed;
  });
}

/**
 * Writes the lines table across pages, its header repeated on each page.
 * @param {Doc} doc PDF document.
 * @param {Flow} flow Flow.
 * @param {DocumentWithLines} document Document.
 * @param {DocumentTotals} totals Totals.
 * @returns {void}
 */
function writeLines(
  doc: Doc,
  flow: Flow,
  document: DocumentWithLines,
  totals: DocumentTotals,
): void {
  const width = doc.page.width - 2 * PAGE.margin;
  const columns = tableColumns(
    width,
    document.vatApplicable,
    totals.lines.some((line) => line.discount > 0),
  );
  const pad = 5;
  const money = (cents: number) => formatMoney(cents, document.currency);

  const header = () => {
    doc.rect(PAGE.margin, flow.y, width, 20).fill(COLORS.fill);
    doc.font('bold').fontSize(8).fillColor(COLORS.muted);
    for (const column of columns)
      doc.text(column.label.toUpperCase(), column.x + pad, flow.y + 6.5, {
        width: column.width - 2 * pad,
        align: column.align,
        lineBreak: false,
      });
    flow.y += 20;
  };
  flow.ensure(60);
  header();

  document.lines.forEach((stored, index) => {
    const line = lineInput(stored);
    const total = totals.lines[index];
    const titleColumn = columns[0];
    const textWidth =
      (line.kind === 'TEXT' ? width : titleColumn.width) - 2 * pad;
    const notes =
      line.kind === 'DISBURSEMENT' ? ['Débours, hors TVA'] : [];

    const measure = () => {
      doc
        .font(line.kind === 'TEXT' ? 'bold' : 'regular')
        .fontSize(line.kind === 'TEXT' ? 10 : 9);
      let height = line.title
        ? doc.heightOfString(line.title, { width: textWidth, lineGap: 1.5 })
        : 0;
      if (line.description)
        height +=
          3 +
          writeBlocks(
            doc,
            markdownBlocks(line.description),
            { x: 0, y: 0, width: textWidth, size: 8, color: COLORS.muted },
            true,
          );
      doc.font('regular').fontSize(7.5);
      for (const note of notes)
        height += 2 + doc.heightOfString(note, { width: textWidth });
      return height + 2 * pad + 2;
    };
    const height = measure();
    if (flow.ensure(height)) header();

    let y = flow.y + pad + 1;
    const x = titleColumn.x + pad;
    if (line.title) {
      doc
        .font(line.kind === 'TEXT' ? 'bold' : 'regular')
        .fontSize(line.kind === 'TEXT' ? 10 : 9)
        .fillColor(COLORS.text);
      doc.text(line.title, x, y, { width: textWidth, lineGap: 1.5 });
      y += doc.heightOfString(line.title, { width: textWidth, lineGap: 1.5 });
    }
    if (line.description)
      y +=
        3 +
        writeBlocks(doc, markdownBlocks(line.description), {
          x,
          y: y + 3,
          width: textWidth,
          size: 8,
          color: COLORS.muted,
        });
    doc.font('regular').fontSize(7.5).fillColor(COLORS.muted);
    for (const note of notes) {
      doc.text(note, x, y + 2, { width: textWidth });
      y += 2 + doc.heightOfString(note, { width: textWidth });
    }

    if (line.kind !== 'TEXT') {
      const values: Record<Column['key'], string> = {
        title: '',
        quantity: line.quantity.toLocaleString('fr-FR', {
          maximumFractionDigits: 3,
        }),
        unit: line.kind === 'DEDUCTION' ? '' : UNIT_LABELS[line.unit].short,
        price: money(Math.round(line.unitPrice * 100)),
        // A percentage as such, an amount as the amount taken off.
        discount: !total.discount
          ? ''
          : line.discountType === 'PERCENT'
            ? `${line.discountValue?.toLocaleString('fr-FR')} %`
            : `−${money(total.discount)}`,
        vat:
          line.kind === 'DISBURSEMENT'
            ? '—'
            : `${line.vatRate.toLocaleString('fr-FR')} %`,
        total: money(total.net),
      };
      doc.font('regular').fontSize(9).fillColor(COLORS.text);
      for (const column of columns.slice(1)) {
        doc.text(values[column.key], column.x + pad, flow.y + pad + 1, {
          width: column.width - 2 * pad,
          align: column.align,
          lineBreak: false,
        });
      }
    }
    flow.y += height;
    doc
      .moveTo(PAGE.margin, flow.y)
      .lineTo(PAGE.margin + width, flow.y)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
  });
}

/**
 * Writes the totals, aligned right.
 * @param {Doc} doc PDF document.
 * @param {Flow} flow Flow.
 * @param {DocumentWithLines} document Document.
 * @param {DocumentTotals} totals Totals.
 * @returns {void}
 */
function writeTotals(
  doc: Doc,
  flow: Flow,
  document: DocumentWithLines,
  totals: DocumentTotals,
): void {
  const money = (cents: number) => formatMoney(cents, document.currency);
  const adjusted = totals.globalDiscount !== 0 || totals.deductions !== 0;
  const discountValue =
    document.globalDiscountValue === null
      ? null
      : Number(document.globalDiscountValue);
  const rows: { label: string; value: string; strong?: boolean }[] = [
    {
      label: adjusted
        ? 'Sous-total HT'
        : document.vatApplicable
          ? 'Total HT'
          : 'Total',
      value: money(totals.itemsNet),
    },
    ...(totals.globalDiscount
      ? [
          {
            label: `Remise${document.globalDiscountType === 'PERCENT' && discountValue ? ` (${discountValue.toLocaleString('fr-FR')} %)` : ''}`,
            value: `−${money(totals.globalDiscount)}`,
          },
        ]
      : []),
    ...(totals.deductions
      ? [{ label: 'Déjà facturé', value: `−${money(totals.deductions)}` }]
      : []),
    ...(adjusted
      ? [
          {
            label: document.vatApplicable ? 'Total HT' : 'Total',
            value: money(totals.totalNet),
          },
        ]
      : []),
    ...(document.vatApplicable
      ? totals.vat.map((item) => ({
          label: `TVA ${item.rate.toLocaleString('fr-FR')} % sur ${money(item.base)}`,
          value: money(item.vat),
        }))
      : []),
    ...(totals.disbursements
      ? [{ label: 'Débours', value: money(totals.disbursements) }]
      : []),
    {
      label:
        document.type === 'CREDIT_NOTE'
          ? 'Total de l’avoir'
          : document.vatApplicable
            ? 'Total TTC'
            : 'Net à payer',
      value: money(totals.totalGross),
      strong: true,
    },
  ];
  const width = 250;
  const x = doc.page.width - PAGE.margin - width;
  const rowHeight = 17;
  flow.space(10);
  flow.ensure(rows.length * rowHeight + 10);
  for (const row of rows) {
    if (row.strong) doc.rect(x, flow.y, width, rowHeight + 4).fill(COLORS.fill);
    const y = flow.y + (row.strong ? 6 : 4);
    doc
      .font(row.strong ? 'bold' : 'regular')
      .fontSize(row.strong ? 10.5 : 9)
      .fillColor(row.strong ? COLORS.text : COLORS.muted);
    doc.text(row.label, x + 8, y, { width: width - 100, lineBreak: false });
    doc.fillColor(COLORS.text).text(row.value, x + width - 100, y, {
      width: 92,
      align: 'right',
      lineBreak: false,
    });
    flow.y += rowHeight + (row.strong ? 4 : 0);
  }
  if (!document.vatApplicable) {
    flow.space(6);
    doc.font('regular').fontSize(8).fillColor(COLORS.muted);
    doc.text(document.vatExemptionText ?? 'TVA non applicable', x, flow.y, {
      width,
      align: 'right',
    });
    flow.y = doc.y;
  }
}

/**
 * Writes a titled section of small text (conditions, bank details).
 * @param {Doc} doc PDF document.
 * @param {Flow} flow Flow.
 * @param {string} title Title.
 * @param {string[]} lines Lines.
 * @returns {void}
 */
function writeSection(
  doc: Doc,
  flow: Flow,
  title: string,
  lines: { label: string; value: string }[],
): void {
  const width = doc.page.width - 2 * PAGE.margin;
  const lineGap = 1;

  // Calcul de la hauteur totale
  doc.fontSize(8);

  let contentHeight = 0;

  for (const line of lines) {
    doc.font('bold');

    const labelWidth = line.label ? doc.widthOfString(`${line.label} : `) : 0;

    doc.font('regular');

    const height = doc.heightOfString(line.value, {
      width: Math.max(1, width - Math.min(labelWidth, width)),
      lineGap,
    });

    contentHeight += height;
  }

  flow.ensure(14 + contentHeight + lines.length * 3);

  // Titre de section
  doc
    .font('bold')
    .fontSize(8.5)
    .fillColor(COLORS.accent)
    .text(title, PAGE.margin, flow.y);

  let y = flow.y + 13;

  // Contenu
  for (const line of lines) {
    doc.fontSize(8);

    if (line.label) {
      doc
        .font('bold')
        .fillColor(COLORS.text)
        .text(`${line.label} : `, PAGE.margin, y, {
          continued: true,
        });
    }

    doc.font('regular').fillColor(COLORS.muted).text(line.value, {
      width,
      lineGap,
    });

    y = doc.y + 3;
  }

  flow.y = y + 5;
}
/** Points per millimetre. */
const MM = 72 / 25.4;

/**
 * Where the address of the buyer goes, to show through the window of a standard DL envelope (110 × 220 mm,
 * window 100 × 45 mm at 20 mm from the right and 15 mm from the bottom) holding the page folded in three: the
 * window spans 100–200 mm across and 50–95 mm down the page, less the play of the letter in the envelope.
 */
const ENVELOPE_WINDOW = { x: 116 * MM, y: 55 * MM, width: 78 * MM, bottom: 90 * MM };
/** Below the window, whatever the play of the letter in the envelope. */
const BELOW_WINDOW = 98 * MM;

/** Spacing of the seller block: between its lines, and between its groups (address, identifiers, contact). */
const SELLER_SPACING = { line: 2.5, group: 8 };

/**
 * Writes the header: logo and seller on the left (address, identifiers and contact in airy groups), title,
 * number and dates on the right, then the buyer on a white background where the window of an envelope shows it
 * (its identifiers under it, out of the window).
 * @param {Doc} doc PDF document.
 * @param {Flow} flow Flow.
 * @param {object} data Data.
 * @param {DocumentWithLines} data.document Document.
 * @param {Seller} data.seller Seller.
 * @param {Buyer} data.buyer Buyer.
 * @param {Buffer | null} data.logo Logo.
 * @param {string | null} data.sourceNumber Number of the source document.
 * @returns {void}
 */
function writeHeader(
  doc: Doc,
  flow: Flow,
  {
    document,
    seller,
    buyer,
    logo,
    sourceNumber,
  }: {
    document: DocumentWithLines;
    seller: Seller;
    buyer: Buyer;
    logo: Buffer | null;
    sourceNumber: string | null;
  },
): void {
  const left = PAGE.margin;
  // Left of the window: the seller never shows through it.
  const leftWidth = 220;
  const right = ENVELOPE_WINDOW.x;
  const rightWidth = doc.page.width - PAGE.margin - right;
  const top = flow.y;

  // Seller.
  let y = top;
  if (logo) {
    try {
      doc.image(logo, left, y, { fit: [150, 56] });
      y += 66;
    } catch {
      // An unreadable logo is left out.
    }
  }
  doc
    .font('bold')
    .fontSize(12)
    .fillColor(COLORS.text)
    .text(seller.name, left, y, { width: leftWidth });
  y = doc.y + 4;

  type SellerLine =
    | { type: 'text'; text: string; url?: string }
    | { type: 'rich'; runs: { text: string; bold?: boolean }[] };

  /**
   * Link of a website, with its scheme.
   * @param {string} website Website as entered.
   * @returns {string} URL.
   */
  const websiteUrl = (website: string) =>
    /^https?:\/\//i.test(website) ? website : `https://${website}`;

  // Groups apart from each other: address, identifiers, contact.
  const sellerGroups: SellerLine[][] = [
    printedAddress(seller.address).map((text) => ({
      type: 'text' as const,
      text,
    })),
    [
      ...(seller.siret
        ? [{ type: 'text' as const, text: `SIRET ${seller.siret}` }]
        : seller.siren
          ? [{ type: 'text' as const, text: `SIREN ${seller.siren}` }]
          : []),
      ...(seller.vatNumber
        ? [{ type: 'text' as const, text: `TVA ${seller.vatNumber}` }]
        : []),
    ],
    [
      ...(seller.contact
        ? [
            {
              type: 'rich' as const,
              runs: [
                { text: 'Contact : ', bold: true },
                { text: seller.contact },
              ],
            },
          ]
        : []),
      ...(seller.phone
        ? [
            {
              type: 'text' as const,
              text: seller.phone,
              url: `tel:${seller.phone}`,
            },
          ]
        : []),
      ...(seller.email
        ? [
            {
              type: 'text' as const,
              text: seller.email,
              url: `mailto:${seller.email}`,
            },
          ]
        : []),
      ...(seller.website
        ? [
            {
              type: 'text' as const,
              text: seller.website,
              url: websiteUrl(seller.website),
            },
          ]
        : []),
    ],
  ].filter((group) => group.length > 0);

  doc.fontSize(8.5).fillColor(COLORS.muted);
  sellerGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) y += SELLER_SPACING.group;
    for (const line of group) {
      if (line.type === 'rich') {
        line.runs.forEach((run, index) => {
          doc
            .font(run.bold ? 'bold' : 'regular')
            .text(run.text, left, y, {
              width: leftWidth,
              lineGap: SELLER_SPACING.line,
              continued: index < line.runs.length - 1,
            });
        });
      } else {
        doc.font('regular').text(line.text, left, y, {
          width: leftWidth,
          lineGap: SELLER_SPACING.line,
          link: line.url,
        });
      }
      y = doc.y;
    }
  });
  const sellerBottom = y;

  // Title, number and dates, above the window.
  doc
    .font('bold')
    .fontSize(20)
    .fillColor(COLORS.accent)
    .text(TYPE_TITLES[document.type].toUpperCase(), right, top, {
      width: rightWidth,
      align: 'right',
    });
  doc
    .font('bold')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(
      document.number ? `N° ${document.number}` : 'Provisoire',
      right,
      doc.y + 2,
      { width: rightWidth, align: 'right' },
    );
  const isQuote = document.type === 'QUOTE';
  const facts: [string, string | null][] = [
    ['Date', printedDate(document.issueDate)],
    [
      isQuote ? 'Valable jusqu’au' : 'Échéance',
      document.dueDate ? printedDate(document.dueDate) : null,
    ],
    [
      'Prestation',
      document.serviceStart
        ? document.serviceEnd &&
          document.serviceEnd.getTime() !== document.serviceStart.getTime()
          ? `du ${printedDate(document.serviceStart)} au ${printedDate(document.serviceEnd)}`
          : printedDate(document.serviceStart)
        : null,
    ],
    [
      document.type === 'CREDIT_NOTE' ? 'Facture d’origine' : 'Devis',
      sourceNumber,
    ],
    [document.referenceLabel ?? 'Référence', document.referenceValue],
  ];
  y = doc.y + 6;
  for (const [label, value] of facts) {
    if (!value) continue;
    doc
      .font('regular')
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(label, right, y, { width: 95 });
    doc
      .fillColor(COLORS.text)
      .text(value, right + 95, y, { width: rightWidth - 95, align: 'right' });
    y = doc.y + 2;
  }

  // Buyer, in the window of the envelope (lower when the facts above reach it), on the white of the page.
  const contact = buyer.contact
    ? [
        `${buyer.contact.firstName} ${buyer.contact.lastName}`,
        buyer.contact.jobTitle,
      ]
        .filter(Boolean)
        .join(', ')
    : null;
  const postalLines = [
    buyer.service?.name ?? null,
    contact ? `À l’attention de ${contact}` : null,
    ...printedAddress(buyer.address),
  ].filter((line): line is string => Boolean(line?.trim()));
  const identifiers = [
    buyer.siret
      ? `SIRET ${buyer.siret}`
      : buyer.siren
        ? `SIREN ${buyer.siren}`
        : null,
    buyer.vatNumber ? `TVA ${buyer.vatNumber}` : null,
  ].filter((line): line is string => Boolean(line));
  const addressTop = Math.max(ENVELOPE_WINDOW.y, y + 10);
  doc
    .font('bold')
    .fontSize(10.5)
    .fillColor(COLORS.text)
    .text(buyer.name, right, addressTop, { width: ENVELOPE_WINDOW.width });
  if (postalLines.length)
    doc
      .font('regular')
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(postalLines.join('\n'), right, doc.y + 2, {
        width: ENVELOPE_WINDOW.width,
        lineGap: 1.5,
      });
  // Identifiers under the window: they are not part of the postal address.
  if (identifiers.length)
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        identifiers.join('  ·  '),
        right,
        Math.max(doc.y + 6, BELOW_WINDOW),
        { width: rightWidth },
      );
  flow.y = Math.max(doc.y, sellerBottom) + 24;
}

/**
 * Writes the "Bon pour accord" box of a quote: date, and signature preceded by the handwritten mention.
 * @param {Doc} doc PDF document.
 * @param {Flow} flow Flow.
 * @returns {void}
 */
function writeApproval(doc: Doc, flow: Flow): void {
  const width = 260;
  const height = 120;
  const x = doc.page.width - PAGE.margin - width;
  flow.space(8);
  flow.ensure(height);
  doc
    .roundedRect(x, flow.y, width, height, 4)
    .lineWidth(0.8)
    .strokeColor(COLORS.border)
    .stroke();
  doc
    .font('bold')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text('Bon pour accord', x + 12, flow.y + 10);
  doc.font('regular').fontSize(8).fillColor(COLORS.muted);
  doc.text('Date :', x + 12, flow.y + 28);
  doc
    .fontSize(7)
    .text(
      'Signature, précédée de la mention manuscrite « Bon pour accord » :',
      x + 12,
      flow.y + 44,
      { width: width - 24 },
    );
  flow.y += height + 8;
}

/**
 * Footer of every page: legal identity of the seller and page number; a watermark on drafts.
 * @param {Doc} doc PDF document.
 * @param {Seller} seller Seller.
 * @param {boolean} draft Whether the document is a draft.
 * @returns {void}
 */
function writeFooters(
  doc: Doc,
  draft: boolean,
  document: DocumentWithLines,
): void {
  const reference = `${TYPE_TITLES[document.type]} ${draft ? 'provisoire' : 'N° ' + document.number} du ${printedDate(document.issueDate)}`;
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const { width, height } = doc.page;
    // Written in the bottom margin: no automatic page break.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .moveTo(PAGE.margin, height - 48)
      .lineTo(width - PAGE.margin, height - 48)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
    doc.font('regular').fontSize(7).fillColor(COLORS.muted);
    doc.text(reference, PAGE.margin, height - 40, {
      width: width - 2 * PAGE.margin - 60,
      lineGap: 1,
    });
    doc.text(
      `${index + 1} / ${range.count}`,
      width - PAGE.margin - 60,
      height - 40,
      { width: 60, align: 'right', lineBreak: false },
    );
    if (draft) {
      doc.save();
      doc.rotate(-35, { origin: [width / 2, height / 2] });
      doc.font('bold').fontSize(90).fillColor(COLORS.muted).fillOpacity(0.09);
      doc.text('PROVISOIRE', 0, height / 2 - 50, {
        width,
        align: 'center',
        lineBreak: false,
      });
      doc.restore();
    }
    doc.page.margins.bottom = bottom;
  }
}

export interface DocumentPdf {
  content: Buffer;
  filename: string;
}

/**
 * Payments of a fully paid final invoice or deposit invoice, oldest first.
 * @param {DocumentWithLines} document Document.
 * @returns {Promise<{ date: Date, method: string | null, amount: number }[]>} Payments (amounts in cents).
 */
async function paidInvoicePayments(document: DocumentWithLines): Promise<{ date: Date; method: string | null; amount: number }[]> {
  if (document.status !== 'FINAL' || (document.type !== 'INVOICE' && document.type !== 'DEPOSIT_INVOICE')) {
    throw clientError('BAD_USER_INPUT', 'Seule une facture validée peut être acquittée.');
  }
  const balance = (await documentBalances()).get(document.id);
  if (!balance || balance.paid <= 0 || balance.balance > 0) {
    throw clientError('BAD_USER_INPUT', 'La facture n’est pas entièrement réglée : enregistrez d’abord son règlement.');
  }
  const allocations = await prisma.treasuryAllocation.findMany({
    where: { documentId: document.id },
    select: { amount: true, entry: { select: { date: true, method: { select: { name: true } } } } },
    orderBy: { entry: { date: 'asc' } },
  });
  return allocations.map((allocation) => ({ date: allocation.entry.date, method: allocation.entry.method?.name ?? null, amount: Math.round(Number(allocation.amount) * 100) }));
}

/**
 * PDF of an accounting document (PDF/A-3). Final invoices, deposit invoices and credit notes embed their
 * Factur-X XML (EN 16931); drafts and recurring models are watermarked and use the current details of the
 * company and the client; quotes end with a "Bon pour accord" box. A fully paid invoice can be printed
 * receipted ("acquittée"), with its payments.
 * @param {string} id Document id.
 * @param {{ paid?: boolean }} [options] Receipted invoice. Optional.
 * @returns {Promise<DocumentPdf>} PDF.
 */
export async function documentPdf(id: string, options: { paid?: boolean } = {}): Promise<DocumentPdf> {
  const document = await findDocument(id);
  const payments = options.paid ? await paidInvoicePayments(document) : null;
  const draft = document.status !== 'FINAL';
  const seller =
    !draft && document.seller
      ? (document.seller as Seller)
      : await sellerSnapshot();
  const buyer =
    !draft && document.buyer
      ? (document.buyer as Buyer)
      : await buyerSnapshot(document);
  const logo = seller.logoId
    ? await prisma.attachment.findUnique({
        where: { id: seller.logoId },
        select: { data: true },
      })
    : null;
  const source = document.sourceId
    ? await prisma.accountingDocument.findUnique({
        where: { id: document.sourceId },
        select: { number: true, issueDate: true },
      })
    : null;
  // A deposit invoice made from an imported quote.
  const importedSource = document.importedSourceId
    ? await prisma.importedDocument.findUnique({
        where: { id: document.importedSourceId },
        select: { number: true },
      })
    : null;
  const totals = documentTotals(document);
  const typeTitle = TYPE_TITLES[document.type];
  const title = document.number
    ? `${typeTitle} ${document.number}${payments ? ' acquittée' : ''}`
    : `${typeTitle} (brouillon)`;

  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
      bottom: PAGE.bottom,
    },
    bufferPages: true,
    pdfVersion: '1.7',
    subset: 'PDF/A-3b',
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: title, Creator: 'Ordo', Producer: 'Ordo' },
  });
  doc.registerFont('regular', FONTS.regular);
  doc.registerFont('bold', FONTS.bold);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const flow = new Flow(doc);
  writeHeader(doc, flow, {
    document,
    seller,
    buyer,
    logo: logo ? Buffer.from(logo.data) : null,
    sourceNumber: source?.number ?? importedSource?.number ?? null,
  });
  if (document.title) {
    flow.ensure(20);
    doc
      .font('bold')
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(document.title, PAGE.margin, flow.y, {
        width: doc.page.width - 2 * PAGE.margin,
      });
    flow.y = doc.y + 8;
  }
  if (document.introduction) {
    flow.markdown(document.introduction);
    flow.space(6);
  }
  writeLines(doc, flow, document, totals);
  writeTotals(doc, flow, document, totals);
  flow.space(16);
  if (payments) {
    const last = payments[payments.length - 1];
    writeSection(doc, flow, 'Facture acquittée', [
      ...payments.map((payment) => ({
        label: `Réglé le ${printedDate(payment.date)}${payment.method ? ` (${payment.method.toLowerCase()})` : ''}`,
        value: formatMoney(payment.amount, document.currency),
      })),
      { label: '', value: `Pour acquit, le ${printedDate(last.date)}.` },
    ]);
  }
  if (document.conclusion) {
    flow.markdown(document.conclusion);
    flow.space(8);
  }
  const isQuote = document.type === 'QUOTE';
  const deposit = isQuote
    ? depositAmount(
        document.depositType,
        document.depositValue === null ? null : Number(document.depositValue),
        totals.totalGross,
      )
    : 0;
  const labelled = (label: string, value: string | null) =>
    value?.trim() ? { label, value: value.trim() } : null;

  const conditions = [
    isQuote ? labelled('Mode de facturation', document.billingSchedule) : null,

    labelled('Conditions de règlement', document.paymentTerms),
    labelled('Mode de règlement', document.paymentMethods),

    deposit
      ? {
          label: 'Acompte à la commande',
          value:
            document.depositType === 'PERCENT'
              ? `${Number(document.depositValue).toLocaleString('fr-FR')} %, soit ${formatMoney(deposit, document.currency)}`
              : formatMoney(deposit, document.currency),
        }
      : null,

    labelled('Intérêts de retard', document.lateInterest),

    document.type !== 'CREDIT_NOTE' && buyer.kind === 'COMPANY'
      ? {
          label:
            'Indemnité forfaitaire pour frais de recouvrement en cas de retard',
          value: '40 €',
        }
      : null,

    document.otherMentions?.trim()
      ? { label: '', value: document.otherMentions.trim() }
      : null,
  ].filter((line): line is { label: string; value: string } => line !== null);

  if (conditions.length) {
    writeSection(doc, flow, 'Conditions', conditions);
  }
  if (document.showBankDetails && seller.iban) {
    writeSection(
      doc,
      flow,
      'Coordonnées bancaires',
      [
        seller.accountHolder
          ? { label: 'Titulaire', value: seller.accountHolder }
          : null,
        seller.bankName ? { label: 'Banque', value: seller.bankName } : null,
        { label: 'IBAN', value: seller.iban },
        seller.bic ? { label: 'BIC', value: seller.bic } : null,
      ].filter(
        (line): line is { label: string; value: string } => line !== null,
      ),
    );
  }
  if (document.type === 'QUOTE') writeApproval(doc, flow);
  writeFooters(doc, draft, document);

  if (!draft && hasFacturX(document.type)) {
    const xml = facturXml(
      document,
      totals,
      seller,
      buyer,
      source?.number
        ? { number: source.number, issueDate: source.issueDate }
        : null,
    );
    // AFRelationship "Alternative": the XML is the same invoice (pdfkit supports it, its types do not).
    const options: PDFKit.Mixins.PDFAttachmentOptions & {
      relationship: string;
    } = {
      name: FACTUR_X_FILENAME,
      type: 'text/xml',
      relationship: 'Alternative',
      description: 'Factur-X',
      creationDate: document.finalizedAt ?? new Date(),
      modifiedDate: document.finalizedAt ?? new Date(),
    };
    doc.file(Buffer.from(xml, 'utf8'), options);
    doc.appendXML(facturXmp());
  }
  doc.end();
  await done;
  return { content: Buffer.concat(chunks), filename: `${title}.pdf` };
}
