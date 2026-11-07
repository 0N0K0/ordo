import { addDays, formatDay, formatMoney, offsetLinkedMovements, parseDay, splitAmounts, toCents } from '@ordo/shared';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma, unscopedPrisma } from '../db';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { FONTS } from './accounting-pdf';
import { accountBalance } from './treasury';
import { currentWorkspaceId } from '../workspace-context';

type Doc = InstanceType<typeof PDFDocument>;

/** Period (and account) of a statement. */
export const statementSchema = z
  .object({
    from: z.iso.date({ error: 'Date de début invalide.' }),
    to: z.iso.date({ error: 'Date de fin invalide.' }),
    /** One account, or all of them. */
    accountId: z.string().nullable(),
  })
  .refine((period) => period.from <= period.to, { path: ['to'], message: 'La fin de la période précède son début.' })
  .refine((period) => period.to <= addDays(period.from, 366 * 10), { path: ['to'], message: 'Dix ans au plus.' });
export type StatementInput = z.input<typeof statementSchema>;

const COLORS = { text: '#1d232b', muted: '#66707c', border: '#dfe3e8', fill: '#f2f4f6', month: '#e7ebf0', in: '#2b8a3e', out: '#c92a2a' };
const MARGIN = 36;
const PAD = 4;
const FONT_SIZE = 7.5;

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Printed day.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} DD/MM/YYYY.
 */
const printed = (day: string) => dateFormat.format(new Date(`${day}T00:00:00Z`));

/**
 * Printed amount.
 * @param {number} cents Amount, in cents.
 * @returns {string} Amount in euros.
 */
const money = (cents: number) => formatMoney(cents);

/** Column of the statement table. */
interface Column {
  label: string;
  width: number;
  align: 'left' | 'right';
}

/**
 * PDF (A4 landscape) statement of the actual entries of a period, of one account or all: opening balance,
 * entries by execution date with payer or payee, category, method, documents settled, linked entries and
 * supporting documents, their split under them (a muted row per line, and what the lines leave),
 * money out, money in and running balance, a subtotal per month over several months, and the closing balance.
 * Forecasts are left out. The running balance only counts an entry from the opening date of its account, and
 * an account opened during the period adds its opening balance that day.
 * @param {StatementInput} input Period and account.
 * @returns {Promise<{ name: string, content: Buffer }>} File name and PDF.
 */
export async function treasuryStatementPdf(input: StatementInput): Promise<{ name: string; content: Buffer }> {
  const { from, to, accountId } = parseInput(statementSchema, input);
  const accounts = await prisma.treasuryAccount.findMany({ where: accountId ? { id: accountId } : {}, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  if (accountId && !accounts.length) throw notFound('Compte');
  if (!accounts.length) throw clientError('BAD_USER_INPUT', 'Aucun compte.');
  const company = await prisma.companyProfile.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { name: true } });
  // Without a company (personal workspace), the statement bears the name of the workspace.
  const owner = company?.name.trim() || (await unscopedPrisma.workspace.findUnique({ where: { id: currentWorkspaceId() }, select: { name: true } }))?.name;
  const entries = await prisma.treasuryEntry.findMany({
    where: { status: 'ACTUAL', accountId: { in: accounts.map((account) => account.id) }, date: { gte: parseDay(from), lte: parseDay(to) } },
    include: {
      account: { select: { name: true } },
      category: { select: { id: true } },
      method: { select: { name: true } },
      client: { select: { name: true } },
      counterparty: { select: { name: true } },
      allocations: { select: { document: { select: { number: true } }, importedDocument: { select: { number: true } } } },
      links: { select: { id: true, label: true } },
      linkedBy: { select: { id: true, label: true } },
      libraryDocuments: { select: { title: true } },
      projectResources: { select: { title: true } },
      lines: {
        orderBy: { position: 'asc' },
        select: {
          label: true,
          mode: true,
          value: true,
          categoryId: true,
          loan: true,
          date: true,
          member: { select: { name: true } },
          relation: { select: { name: true } },
          context: { select: { name: true } },
          project: { select: { title: true } },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Category paths ("Parent › Enfant").
  const categories = await prisma.treasuryCategory.findMany({ select: { id: true, name: true, parentId: true } });
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  /**
   * Full path of a category.
   * @param {string | null} id Category id.
   * @returns {string} Path, empty without category.
   */
  const categoryPath = (id: string | null) => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let current = id ? categoryById.get(id) : undefined; current && !seen.has(current.id); current = current.parentId ? categoryById.get(current.parentId) : undefined) {
      seen.add(current.id);
      names.unshift(current.name);
    }
    return names.join(' › ');
  };

  const openingDates = new Map(accounts.map((account) => [account.id, formatDay(account.openingDate)]));
  const counted = (entry: (typeof entries)[number]) => formatDay(entry.date) >= (openingDates.get(entry.accountId) ?? '');
  const opening = (await Promise.all(accounts.map((account) => accountBalance(account, addDays(from, -1))))).reduce((sum, value) => sum + value, 0);
  const closing = (await Promise.all(accounts.map((account) => accountBalance(account, to)))).reduce((sum, value) => sum + value, 0);
  // Accounts opened during the period: their opening balance, that day.
  const openings = accounts
    .filter((account) => formatDay(account.openingDate) >= from && formatDay(account.openingDate) <= to)
    .map((account) => ({ day: formatDay(account.openingDate), name: account.name, amount: toCents(Number(account.openingBalance)) }));

  const amounts = entries.map((entry) => toCents(Number(entry.amount)));
  const incoming = amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0);
  const outgoing = -amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0);
  // Linked money in and out of the period offsetting each other.
  const remaining = offsetLinkedMovements(
    entries.map((entry, index) => ({ id: entry.id, amount: amounts[index], linkedIds: [...entry.links, ...entry.linkedBy].map((linked) => linked.id), period: 'all' })),
  );
  const offset = entries.reduce((sum, entry, index) => sum + (amounts[index] > 0 ? amounts[index] - Math.round(remaining.get(entry.id) ?? amounts[index]) : 0), 0);

  const doc: Doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + 14 },
    bufferPages: true,
    font: FONTS.regular,
    lang: 'fr-FR',
    displayTitle: true,
    info: { Title: `Relevé des mouvements du ${printed(from)} au ${printed(to)}`, Creator: 'Ordo', Producer: 'Ordo' },
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
  const several = accounts.length > 1;
  const fixed: Column[] = [
    { label: 'Exécution', width: 52, align: 'left' },
    { label: 'Valeur', width: 52, align: 'left' },
    { label: 'Libellé', width: 0, align: 'left' },
    { label: 'Émetteur / destinataire', width: 100, align: 'left' },
    { label: 'Catégorie', width: 110, align: 'left' },
    { label: 'Moyen', width: 58, align: 'left' },
    ...(several ? [{ label: 'Compte', width: 72, align: 'left' as const }] : []),
    { label: 'Débit', width: 62, align: 'right' },
    { label: 'Crédit', width: 62, align: 'right' },
    { label: 'Solde', width: 66, align: 'right' },
  ];
  const labelIndex = 2;
  fixed[labelIndex].width = pageWidth - fixed.reduce((sum, column) => sum + column.width, 0);
  const xs = fixed.map((_, index) => MARGIN + fixed.slice(0, index).reduce((sum, column) => sum + column.width, 0));
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  let y = MARGIN;

  // Title and summary.
  doc.font('bold').fontSize(14).fillColor(COLORS.text).text('Relevé des mouvements', MARGIN, y, { width: pageWidth });
  y = doc.y + 2;
  const scope = several ? 'Tous les comptes' : accounts[0].name;
  doc
    .font('regular')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text([owner, scope, `Du ${longDate.format(parseDay(from))} au ${longDate.format(parseDay(to))}`].filter(Boolean).join(' · '), MARGIN, y, { width: pageWidth });
  y = doc.y + 8;
  const figures = [
    { label: `Solde au ${printed(addDays(from, -1))}`, value: opening, color: COLORS.text },
    { label: 'Entrées', value: incoming, color: COLORS.in },
    { label: 'Sorties', value: outgoing, color: COLORS.out },
    { label: `Solde au ${printed(to)}`, value: closing, color: COLORS.text },
  ];
  const boxWidth = (pageWidth - 3 * 8) / 4;
  figures.forEach((figure, index) => {
    const x = MARGIN + index * (boxWidth + 8);
    doc.roundedRect(x, y, boxWidth, 36, 3).fill(COLORS.fill);
    doc
      .font('regular')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(figure.label.toUpperCase(), x + 8, y + 6, { width: boxWidth - 16 });
    doc
      .font('bold')
      .fontSize(11)
      .fillColor(figure.color)
      .text(money(figure.value), x + 8, y + 17, { width: boxWidth - 16 });
  });
  y += 36 + 6;
  const notes = [
    `${entries.length} mouvement${entries.length > 1 ? 's' : ''} réel${entries.length > 1 ? 's' : ''}, par date d’exécution ; les prévisions ne sont pas incluses.`,
    offset > 0 ? `Dont ${money(offset)} d’entrées et de sorties liées qui se compensent (entrées nettes ${money(incoming - offset)}, sorties nettes ${money(outgoing - offset)}).` : '',
  ].filter(Boolean);
  doc.font('regular').fontSize(7.5).fillColor(COLORS.muted).text(notes.join(' '), MARGIN, y, { width: pageWidth });
  y = doc.y + 8;

  /**
   * Header row (column labels).
   * @returns {void}
   */
  const header = () => {
    doc.font('bold').fontSize(FONT_SIZE);
    const height = FONT_SIZE + 2 * PAD + 2;
    doc.rect(MARGIN, y, pageWidth, height).fill(COLORS.fill);
    doc.fillColor(COLORS.text);
    fixed.forEach((column, index) => doc.text(column.label, xs[index] + PAD, y + PAD, { width: column.width - 2 * PAD, align: column.align, lineBreak: false }));
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

  /**
   * Full width row: month heading, opening of an account, totals.
   * @param {string} label Text on the left.
   * @param {string} right Text on the right.
   * @param {string} fill Background.
   * @returns {void}
   */
  const band = (label: string, right: string, fill: string) => {
    doc.font('bold').fontSize(FONT_SIZE);
    const height = FONT_SIZE + 2 * PAD + 2;
    ensure(height + 12);
    doc.rect(MARGIN, y, pageWidth, height).fill(fill);
    doc.fillColor(COLORS.text).text(label, MARGIN + PAD, y + PAD, { width: pageWidth / 2, lineBreak: false });
    doc.text(right, MARGIN + pageWidth / 2, y + PAD, { width: pageWidth / 2 - PAD, align: 'right', lineBreak: false });
    y += height;
  };

  header();
  const byMonth = new Set(entries.map((entry) => formatDay(entry.date).slice(0, 7))).size > 1 || from.slice(0, 7) !== to.slice(0, 7);
  let running = opening;
  let month = '';
  let pendingOpenings = [...openings];
  if (!entries.length && !openings.length) {
    doc
      .font('regular')
      .fontSize(FONT_SIZE + 0.5)
      .fillColor(COLORS.muted)
      .text('Aucun mouvement sur la période.', MARGIN + PAD, y + 8, { width: pageWidth });
  }
  entries.forEach((entry, index) => {
    const day = formatDay(entry.date);
    if (byMonth && day.slice(0, 7) !== month) {
      month = day.slice(0, 7);
      const ofMonth = entries.map((other, otherIndex) => ({ other, amount: amounts[otherIndex] })).filter(({ other }) => formatDay(other.date).slice(0, 7) === month);
      const monthIn = ofMonth.filter(({ amount }) => amount > 0).reduce((sum, { amount }) => sum + amount, 0);
      const monthOut = -ofMonth.filter(({ amount }) => amount < 0).reduce((sum, { amount }) => sum + amount, 0);
      const title = monthFormat.format(new Date(`${month}-01T00:00:00Z`));
      band(title.charAt(0).toUpperCase() + title.slice(1), `Entrées ${money(monthIn)} · Sorties ${money(monthOut)}`, COLORS.month);
    }
    // Accounts opened by then.
    for (const account of pendingOpenings.filter((item) => item.day <= day)) {
      running += account.amount;
      band(`${printed(account.day)} — Ouverture du compte ${account.name}`, `Solde ${money(running)}`, COLORS.fill);
    }
    pendingOpenings = pendingOpenings.filter((item) => item.day > day);
    if (counted(entry)) running += amounts[index];

    const linked = [...entry.links, ...entry.linkedBy].map((item) => item.label);
    const supports = [...entry.libraryDocuments, ...entry.projectResources].map((item) => item.title);
    const documents = entry.allocations.map((allocation) => allocation.document?.number ?? (allocation.importedDocument ? `${allocation.importedDocument.number} (importé)` : '')).filter(Boolean);
    const details = [
      documents.length ? `Règle ${documents.join(', ')}` : '',
      linked.length ? `Lié à : ${linked.join(' ; ')}` : '',
      supports.length ? `Pièces : ${supports.join(' ; ')}` : '',
      counted(entry) ? '' : 'Avant l’ouverture du compte : hors solde',
    ]
      .filter(Boolean)
      .join(' · ');
    const cells = [
      printed(day),
      printed(formatDay(entry.valueDate)),
      entry.label,
      entry.client?.name ?? entry.counterparty?.name ?? '',
      categoryPath(entry.category?.id ?? null),
      entry.method?.name ?? '',
      ...(several ? [entry.account.name] : []),
      amounts[index] < 0 ? money(-amounts[index]) : '',
      amounts[index] > 0 ? money(amounts[index]) : '',
      money(running),
    ];
    doc.font('regular').fontSize(FONT_SIZE);
    const labelHeight =
      doc.heightOfString(entry.label, { width: fixed[labelIndex].width - 2 * PAD }) +
      (details ? doc.fontSize(FONT_SIZE - 1).heightOfString(details, { width: fixed[labelIndex].width - 2 * PAD }) + 1 : 0);
    doc.fontSize(FONT_SIZE);
    const height = Math.max(labelHeight, ...cells.map((text, cellIndex) => (cellIndex === labelIndex ? 0 : doc.heightOfString(text, { width: fixed[cellIndex].width - 2 * PAD })))) + 2 * PAD;
    ensure(height);
    cells.forEach((text, cellIndex) => {
      const column = fixed[cellIndex];
      const debit = column.label === 'Débit';
      const credit = column.label === 'Crédit';
      doc
        .font(column.label === 'Solde' ? 'bold' : 'regular')
        .fontSize(FONT_SIZE)
        .fillColor(debit ? COLORS.out : credit ? COLORS.in : column.label === 'Solde' && running < 0 ? COLORS.out : COLORS.text)
        .text(text, xs[cellIndex] + PAD, y + PAD, { width: column.width - 2 * PAD, align: column.align });
    });
    if (details) {
      const labelTop =
        y +
        PAD +
        doc
          .font('regular')
          .fontSize(FONT_SIZE)
          .heightOfString(entry.label, { width: fixed[labelIndex].width - 2 * PAD }) +
        1;
      doc
        .fontSize(FONT_SIZE - 1)
        .fillColor(COLORS.muted)
        .text(details, xs[labelIndex] + PAD, labelTop, { width: fixed[labelIndex].width - 2 * PAD });
    }
    y += height;
    // Split: one muted row per line (and what they leave), under the entry, without balance.
    if (entry.lines.length) {
      const split = splitAmounts(
        Number(entry.amount),
        entry.lines.map((line) => ({ mode: line.mode, value: Number(line.value) })),
      );
      const parts = [
        ...entry.lines.map((line, lineIndex) => ({
          text:
            [
              line.label ?? '',
              line.relation ? `pour ${line.relation.name}` : line.member ? `pour ${line.member.name}` : '',
              line.context?.name ?? '',
              line.project ? `projet ${line.project.title}` : '',
              line.loan ? 'prêt' : '',
              line.date ? `le ${printed(formatDay(line.date))}` : '',
            ]
              .filter(Boolean)
              .join(' · ') || 'Ligne',
          category: categoryPath(line.categoryId),
          amount: split.amounts[lineIndex],
        })),
        ...(split.remainder ? [{ text: 'Non réparti', category: '', amount: split.remainder }] : []),
      ];
      for (const part of parts) {
        const subCells = cells.map((_, cellIndex) => {
          const column = fixed[cellIndex];
          if (cellIndex === labelIndex) return `↳ ${part.text}`;
          if (column.label === 'Catégorie') return part.category;
          if (column.label === 'Débit') return part.amount < 0 ? money(-part.amount) : '';
          if (column.label === 'Crédit') return part.amount > 0 ? money(part.amount) : '';
          return '';
        });
        doc.font('regular').fontSize(FONT_SIZE - 1);
        const subHeight = Math.max(...subCells.map((text, cellIndex) => doc.heightOfString(text, { width: fixed[cellIndex].width - 2 * PAD - (cellIndex === labelIndex ? 8 : 0) }))) + PAD;
        ensure(subHeight);
        subCells.forEach((text, cellIndex) => {
          if (!text) return;
          const column = fixed[cellIndex];
          const indent = cellIndex === labelIndex ? 8 : 0;
          doc
            .font('regular')
            .fontSize(FONT_SIZE - 1)
            .fillColor(COLORS.muted)
            .text(text, xs[cellIndex] + PAD + indent, y + PAD / 2, { width: column.width - 2 * PAD - indent, align: column.align });
        });
        y += subHeight;
      }
    }
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + pageWidth, y)
      .lineWidth(0.4)
      .strokeColor(COLORS.border)
      .stroke();
  });
  // Accounts opened after the last entry.
  for (const account of pendingOpenings) {
    running += account.amount;
    band(`${printed(account.day)} — Ouverture du compte ${account.name}`, `Solde ${money(running)}`, COLORS.fill);
  }
  y += 4;
  band(`Total de la période · Débit ${money(outgoing)} · Crédit ${money(incoming)}`, `Solde au ${printed(to)} : ${money(closing)}`, COLORS.month);

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    // Written in the bottom margin: no automatic page break.
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(7).fillColor(COLORS.muted);
    doc.text(`Relevé du ${printed(from)} au ${printed(to)} · ${scope}`, MARGIN, doc.page.height - MARGIN, { width: pageWidth / 2, lineBreak: false });
    doc.text(`${index + 1} / ${range.count}`, MARGIN + pageWidth / 2, doc.page.height - MARGIN, { width: pageWidth / 2, align: 'right', lineBreak: false });
  }
  doc.end();
  await done;
  return { name: `Relevé ${several ? 'trésorerie' : accounts[0].name} du ${from} au ${to}.pdf`.replace(/[\\/:*?"<>|]/g, '-'), content: Buffer.concat(chunks) };
}
