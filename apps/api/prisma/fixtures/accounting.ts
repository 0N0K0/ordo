import { fakerFR as faker } from '@faker-js/faker';
import {
  addDays,
  DEFAULT_RECURRENCE,
  occurrenceDates,
  parseDay,
  type AccountingDocumentInput,
  type AccountingLineInput,
  type Recurrence,
} from '@ordo/shared';
import { prisma } from '../../src/db';
import type { CatalogItem, Client, Project } from '../../src/generated/prisma/client';
import { createDocument, createFromDocument, defaultFields, finalizeDocument, updateDocument, editableFields, findDocument } from '../../src/services/accounting-documents';
import { createCatalogItem } from '../../src/services/catalog';
import { statusOf } from '../../src/services/document-statuses';
import { acceptQuote, documentBalances, markSent, recordPayment, setTrackingStatus } from '../../src/services/document-tracking';
import { importDocument } from '../../src/services/imported-documents';
import { createRecurringInvoice, issueDueInvoices } from '../../src/services/recurring-invoices';
import { createAccount, createEntry, realizeForecast } from '../../src/services/treasury';
import { createCategory, createCounterparty, createPaymentMethod } from '../../src/services/treasury-settings';
import { maybe } from './factories';

/** Seller of the fixture documents: the seed only reloads a database whose final documents are its own. */
export const DEMO_COMPANY = 'Atelier Ordo (démo)';

const SERVICES = ['Comptabilité', 'Direction marketing', 'Achats', 'Direction générale', 'Service informatique'];
const JOB_TITLES = ['Responsable comptable', 'Directrice marketing', 'Chef de projet', 'Gérant', 'Assistante de direction', 'Responsable achats', 'DSI'];

/**
 * French address.
 * @returns {object} Address.
 */
function address() {
  return { lines: [faker.location.streetAddress()], postalCode: faker.location.zipCode('#####'), city: faker.location.city(), region: '', country: 'FR' };
}

/**
 * French phone numbers.
 * @param {number} max Maximum count.
 * @returns {{ label: string, number: string }[]} Phones.
 */
function phones(max: number) {
  return faker.helpers.multiple(() => ({ label: faker.helpers.arrayElement(['Standard', 'Mobile', 'Direct']), number: faker.phone.number({ style: 'national' }) }), {
    count: { min: 0, max },
  });
}

/**
 * Digits only.
 * @param {number} length Length.
 * @returns {string} Digits.
 */
const digits = (length: number) => faker.string.numeric({ length, allowLeadingZeros: false });

/**
 * Company profile of the fixtures: legal mentions, bank details and default terms.
 * @returns {Promise<void>}
 */
async function seedCompany(): Promise<void> {
  const data = {
    name: DEMO_COMPANY,
    legalForm: 'SASU',
    capital: '1 000 €',
    registration: 'RCS Lyon 912 345 678',
    siren: '912345678',
    siret: '91234567800018',
    activityCode: '62.01Z',
    vatNumber: 'FR51912345678',
    vatApplicable: true,
    address: { lines: ['12 rue de la République'], postalCode: '69002', city: 'Lyon', region: '', country: 'FR' },
    email: 'contact@atelier-demo.fr',
    phone: '04 78 00 00 00',
    website: 'https://atelier-demo.fr',
    logoId: null,
    bankName: 'Banque Démo',
    accountHolder: DEMO_COMPANY,
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: 'AGRIFRPP',
    paymentTerms: 'À 30 jours',
    paymentDays: 30,
    paymentMethods: 'Virement bancaire',
    lateInterest: 'Trois fois le taux d’intérêt légal',
  };
  await prisma.companyProfile.upsert({ where: { id: 'company' }, create: data, update: data });
}

/**
 * Billing details of the clients: kind, address, identifiers, services and contacts. The third client is an
 * individual.
 * @param {Client[]} clients Clients.
 * @returns {Promise<void>}
 */
async function seedClientBilling(clients: Client[]): Promise<void> {
  for (const [index, client] of clients.entries()) {
    if (index === 2) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      await prisma.client.update({
        where: { id: client.id },
        data: { kind: 'INDIVIDUAL', name: `${firstName} ${lastName}`, firstName, lastName, address: address(), email: faker.internet.email({ firstName, lastName }).toLowerCase(), phones: phones(1) },
      });
      continue;
    }
    const siren = digits(9);
    const domain = `${faker.helpers.slugify(client.name).toLowerCase().slice(0, 20)}.fr`;
    await prisma.client.update({
      where: { id: client.id },
      data: {
        kind: 'COMPANY',
        address: address(),
        email: `contact@${domain}`,
        website: `https://www.${domain}`,
        phones: phones(2),
        siren,
        siret: `${siren}${digits(5)}`,
        vatNumber: `FR${digits(2)}${siren}`,
        activityCode: faker.helpers.arrayElement(['47.91B', '70.22Z', '56.10A', '68.20B', '86.21Z']),
      },
    });
    const services = await Promise.all(
      faker.helpers.arrayElements(SERVICES, { min: 0, max: 2 }).map((name, position) =>
        prisma.clientService.create({
          data: { clientId: client.id, name, position, email: `${faker.helpers.slugify(name).toLowerCase()}@${domain}`, address: maybe(0.4, address) ?? undefined, phones: phones(1) },
        }),
      ),
    );
    for (let contact = 0; contact < faker.number.int({ min: 1, max: 3 }); contact += 1) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      await prisma.clientContact.create({
        data: {
          clientId: client.id,
          serviceId: services.length ? maybe(0.6, () => faker.helpers.arrayElement(services).id) : null,
          firstName,
          lastName,
          email: `${faker.helpers.slugify(firstName).toLowerCase()}.${faker.helpers.slugify(lastName).toLowerCase()}@${domain}`,
          jobTitle: faker.helpers.arrayElement(JOB_TITLES),
          phones: phones(2),
        },
      });
    }
  }
}

/**
 * Catalogue of products and services (one archived offer).
 * @returns {Promise<Map<string, CatalogItem>>} Items by title.
 */
async function seedCatalog(): Promise<Map<string, CatalogItem>> {
  const items = [
    { title: 'Développement', unit: 'HOUR', unitPrice: 75, description: 'Développement, intégration et tests.' },
    { title: 'Journée de développement', unit: 'DAY', unitPrice: 550, description: null },
    { title: 'Journée de conseil', unit: 'DAY', unitPrice: 650, description: 'Atelier, audit ou accompagnement, sur site ou à distance.' },
    { title: 'Maquettes', unit: 'FLAT', unitPrice: 1800, description: '- Maquettes desktop et mobile\n- Deux allers-retours de corrections' },
    { title: 'Formation', unit: 'DAY', unitPrice: 900, description: 'Formation des équipes à l’outil livré (8 personnes maximum).' },
    { title: 'Maintenance mensuelle', unit: 'MONTH', unitPrice: 150, description: 'Mises à jour de sécurité, sauvegardes et support (2 h incluses).' },
    { title: 'Hébergement', unit: 'MONTH', unitPrice: 25, description: null },
    { title: 'Nom de domaine', unit: 'UNIT', unitPrice: 15, description: 'Renouvellement annuel.' },
    { title: 'Audit SEO (ancienne offre)', unit: 'FLAT', unitPrice: 1200, description: null, archived: true },
  ] as const;
  const created = new Map<string, CatalogItem>();
  for (const item of items) {
    const saved = await createCatalogItem({ kind: 'ITEM', vatRate: 20, archived: false, ...item });
    created.set(item.title, saved);
  }
  const travel = await createCatalogItem({ kind: 'DISBURSEMENT', title: 'Frais de déplacement', description: 'Billets de train, sur justificatifs.', unit: 'FLAT', unitPrice: 0, vatRate: 0, archived: false });
  created.set(travel.title, travel);
  return created;
}

/**
 * Line from a catalogue item.
 * @param {CatalogItem} item Item.
 * @param {number} quantity Quantity.
 * @param {Partial<AccountingLineInput>} [changes] Other fields. Optional.
 * @returns {AccountingLineInput} Line.
 */
function line(item: CatalogItem, quantity: number, changes: Partial<AccountingLineInput> = {}): AccountingLineInput {
  return {
    kind: item.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'ITEM',
    title: item.title,
    description: item.description,
    quantity,
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    vatRate: Number(item.vatRate),
    discountType: null,
    discountValue: null,
    ...changes,
  };
}

/**
 * Section title line.
 * @param {string} title Title.
 * @returns {AccountingLineInput} Line.
 */
function section(title: string): AccountingLineInput {
  return { kind: 'TEXT', title, description: null, quantity: 1, unit: 'UNIT', unitPrice: 0, vatRate: 0, discountType: null, discountValue: null };
}

/**
 * Rule from the default one.
 * @param {Partial<Recurrence>} changes Changes.
 * @returns {Recurrence} Rule.
 */
const rule = (changes: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...changes });

interface AccountingContext {
  clients: Client[];
  projects: Project[];
  /** YYYY-MM-DD. */
  today: string;
}

/**
 * Accounting fixtures: company, client billing details, catalogue, treasury accounts and movements, quotes,
 * invoices, deposit invoices, credit notes, recurring invoices, imported documents, payments, reminders and
 * billed time. Documents are made final in the order of their dates, so that numbers follow dates.
 * @param {AccountingContext} context Clients, projects and today.
 * @returns {Promise<void>}
 */
export async function seedAccounting({ clients, projects, today }: AccountingContext): Promise<void> {
  const day = (offset: number) => addDays(today, offset);
  await seedCompany();
  await seedClientBilling(clients);
  const catalog = await seedCatalog();
  const item = (title: string) => catalog.get(title)!;
  const fresh = await prisma.client.findMany({ where: { id: { in: clients.map((client) => client.id) } } });
  const byId = new Map(fresh.map((client) => [client.id, client]));
  const [clientA, clientB, clientC, clientD] = clients.slice(0, 4).map((client) => byId.get(client.id)!);
  const archived = byId.get(clients[clients.length - 1].id)!;
  const rootOf = (client: Client) => projects.find((project) => project.clientId === client.id && project.parentId === null) ?? null;

  // --- Treasury accounts ---------------------------------------------------------------------------
  const bank = await createAccount({ name: 'Compte courant pro', openingBalance: 6200, openingDate: day(-180) });

  // --- Treasury settings: categories (with sub-categories), payment methods, counterparties -------------
  const categoryIds = new Map<string, string>();
  const category = async (name: string, direction: 'IN' | 'OUT', parent?: string) => {
    const created = await createCategory({ name, direction, parentId: parent ? (categoryIds.get(`${direction}:${parent}`) ?? null) : null });
    categoryIds.set(`${direction}:${name}`, created.id);
  };
  for (const name of ['Ventes', 'Subventions', 'Remboursements de frais', 'Divers']) await category(name, 'IN');
  for (const name of ['Prestations', 'Ventes de produits']) await category(name, 'IN', 'Ventes');
  for (const name of ['Locaux', 'Charges sociales', 'Impôts et taxes', 'Équipement', 'Frais de fonctionnement', 'Remboursements clients', 'Divers']) await category(name, 'OUT');
  await category('Loyer', 'OUT', 'Locaux');
  await category('TVA', 'OUT', 'Impôts et taxes');
  for (const name of ['Matériel', 'Logiciels']) await category(name, 'OUT', 'Équipement');
  for (const name of ['Frais bancaires', 'Déplacements', 'Repas']) await category(name, 'OUT', 'Frais de fonctionnement');
  const categoryOf = (name: string, amount: number) => categoryIds.get(`${amount < 0 ? 'OUT' : 'IN'}:${name}`) ?? null;
  const methodIds = new Map<string, string>();
  for (const method of [
    { name: 'Virement', incoming: true, outgoing: true },
    { name: 'Chèque', incoming: true, outgoing: true },
    { name: 'Prélèvement', incoming: false, outgoing: true },
    { name: 'Carte', incoming: false, outgoing: true },
    { name: 'Espèces', incoming: true, outgoing: true },
  ]) {
    methodIds.set(method.name, (await createPaymentMethod(method)).id);
  }
  const methodOf = (name: string) => methodIds.get(name) ?? null;
  const counterpartyIds = new Map<string, string>();
  for (const name of ['Agence immobilière du Centre', 'URSSAF', 'DGFiP', 'Banque Populaire', 'Région', 'SNCF', 'Boulanger']) {
    counterpartyIds.set(name, (await createCounterparty({ name, note: null, archived: false })).id);
  }
  const counterpartyOf = (name: string | undefined) => (name ? (counterpartyIds.get(name) ?? null) : null);
  const entryBase = { valueDate: null, clientId: null, counterpartyId: null, projectId: null, note: null, recurrence: null, allocations: [], linkedEntryIds: [], libraryDocumentIds: [], projectResourceIds: [] };
  await createAccount({ name: 'Livret pro', openingBalance: 12000, openingDate: day(-180) });

  /**
   * Fields of a new document of a client, on a date.
   * @param {'QUOTE' | 'INVOICE'} type Type.
   * @param {Client} client Client.
   * @param {string} date Date.
   * @param {Partial<AccountingDocumentInput>} changes Fields.
   * @returns {Promise<AccountingDocumentInput>} Fields.
   */
  const fields = async (type: 'QUOTE' | 'INVOICE', client: Client, date: string, changes: Partial<AccountingDocumentInput>) => {
    const contact = await prisma.clientContact.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'asc' } });
    return { ...(await defaultFields(type, client.id, date)), contactId: contact?.id ?? null, serviceId: contact?.serviceId ?? null, projectId: rootOf(client)?.id ?? null, ...changes };
  };

  /**
   * Makes a draft final on its date (the validation time follows it).
   * @param {string} id Draft.
   * @param {string} date Date of the document.
   * @returns {Promise<string>} Document id.
   */
  const finalize = async (id: string, date: string) => {
    await finalizeDocument(id);
    await prisma.accountingDocument.update({ where: { id }, data: { finalizedAt: new Date(`${date}T10:00:00`) } });
    return id;
  };

  const ids: Record<string, string> = {};

  // Documents made final in date order: [date, step]. Recurring invoices due before each date are issued first.
  const timeline: [string, () => Promise<void>][] = [
    [
      day(-170),
      async () => {
        const draft = await createDocument('INVOICE', await fields('INVOICE', archived, day(-170), { title: 'Site vitrine — solde', lines: [line(item('Maquettes'), 1), line(item('Journée de développement'), 4)] }));
        ids.archived = await finalize(draft.id, day(-170));
      },
    ],
    [
      day(-160),
      async () => {
        const draft = await createDocument(
          'QUOTE',
          await fields('QUOTE', clientA, day(-160), {
            title: 'Refonte du site et de l’espace client',
            introduction: 'Suite à notre rendez-vous, voici notre proposition pour la refonte de votre site.',
            billingSchedule: 'Acompte à la commande, solde à la livraison',
            depositType: 'PERCENT',
            depositValue: 30,
            lines: [
              section('Conception'),
              line(item('Maquettes'), 1),
              section('Réalisation'),
              line(item('Journée de développement'), 12),
              line(item('Formation'), 1),
              section('Exploitation (première année)'),
              line(item('Hébergement'), 12),
              line(item('Nom de domaine'), 1),
            ],
          }),
        );
        ids.quoteA = await finalize(draft.id, day(-160));
      },
    ],
    [
      day(-149),
      async () => {
        const deposit = await createFromDocument(ids.quoteA, 'DEPOSIT_INVOICE', { depositPercent: 30, issueDate: day(-149) });
        ids.depositA = await finalize(deposit.id, day(-149));
      },
    ],
    [
      day(-125),
      async () => {
        const draft = await createDocument(
          'INVOICE',
          await fields('INVOICE', clientB, day(-125), { title: 'Maintenance et hébergement', lines: [line(item('Maintenance mensuelle'), 1), line(item('Hébergement'), 1)] }),
        );
        ids.maintenanceB = await finalize(draft.id, day(-125));
        await createRecurringInvoice(ids.maintenanceB, {
          name: `Maintenance — ${clientB.name}`,
          recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }),
          startDate: day(-95),
          autoFinalize: true,
          active: true,
        });
      },
    ],
    [
      day(-120),
      async () => {
        const draft = await createDocument(
          'QUOTE',
          await fields('QUOTE', clientB, day(-120), { title: 'Atelier de cadrage', billingSchedule: 'En une fois, à la livraison', lines: [line(item('Journée de conseil'), 3)] }),
        );
        ids.quoteB = await finalize(draft.id, day(-120));
      },
    ],
    [
      day(-100),
      async () => {
        const draft = await createDocument(
          'INVOICE',
          await fields('INVOICE', clientB, day(-100), {
            title: 'Accompagnement',
            lines: [line(item('Journée de conseil'), 2), line(item('Frais de déplacement'), 1, { unitPrice: 128.4, description: 'Aller-retour Lyon – Paris' })],
          }),
        );
        ids.invoiceB = await finalize(draft.id, day(-100));
      },
    ],
    [
      day(-95),
      async () => {
        const invoice = await createFromDocument(ids.quoteB, 'INVOICE', { issueDate: day(-95) });
        ids.invoiceFromQuoteB = await finalize(invoice.id, day(-95));
      },
    ],
    [
      day(-90),
      async () => {
        const draft = await createDocument('QUOTE', await fields('QUOTE', clientC, day(-90), { title: 'Site personnel', lines: [line(item('Maquettes'), 1), line(item('Journée de développement'), 3)] }));
        ids.refusedC = await finalize(draft.id, day(-90));
      },
    ],
    [
      day(-75),
      async () => {
        const draft = await createDocument(
          'QUOTE',
          await fields('QUOTE', clientD, day(-75), { title: 'Audit de performance', dueDate: day(-45), lines: [line(item('Journée de conseil'), 2)] }),
        );
        ids.expiredD = await finalize(draft.id, day(-75));
      },
    ],
    [
      day(-70),
      async () => {
        const invoice = await createFromDocument(ids.quoteA, 'INVOICE', { issueDate: day(-70) });
        ids.invoiceA = await finalize(invoice.id, day(-70));
      },
    ],
    [
      day(-55),
      async () => {
        // Credit note on one of the two days of the paid invoice: it is to be refunded.
        const credit = await createFromDocument(ids.invoiceB, 'CREDIT_NOTE', { issueDate: day(-55) });
        const current = await editableFields(await findDocument(credit.id));
        await updateDocument(credit.id, {
          ...current,
          title: 'Avoir — journée annulée',
          lines: current.lines.filter((item) => item.kind === 'ITEM').map((item) => ({ ...item, quantity: 1 })),
        });
        ids.creditB = await finalize(credit.id, day(-55));
      },
    ],
    [
      day(-45),
      async () => {
        const draft = await createDocument(
          'INVOICE',
          await fields('INVOICE', clientD, day(-45), {
            title: 'Formation et accompagnement',
            globalDiscountType: 'PERCENT',
            globalDiscountValue: 5,
            lines: [line(item('Formation'), 2), line(item('Journée de conseil'), 1), line(item('Frais de déplacement'), 1, { unitPrice: 86.2, description: 'Train et repas' })],
          }),
        );
        ids.invoiceD = await finalize(draft.id, day(-45));
      },
    ],
    [
      day(-28),
      async () => {
        const draft = await createDocument(
          'QUOTE',
          await fields('QUOTE', clientC, day(-28), {
            title: 'Boutique en ligne',
            dueDate: day(15),
            billingSchedule: 'Au mois, en fin de mois',
            depositType: 'AMOUNT',
            depositValue: 500,
            lines: [line(item('Maquettes'), 1), line(item('Développement'), 40), line(item('Hébergement'), 12)],
          }),
        );
        ids.pendingC = await finalize(draft.id, day(-28));
      },
    ],
    [
      day(-20),
      async () => {
        // Tracked time of the client with the most of it, billed by the hour.
        const roots = clients.slice(0, 4).map((client) => ({ client: byId.get(client.id)!, ids: projects.filter((project) => project.clientId === client.id).map((project) => project.id) }));
        const counted = await Promise.all(
          roots.map(async (root) => ({ ...root, entries: await prisma.timeEntry.findMany({ where: { projectId: { in: root.ids }, documentId: null, duration: { not: null }, startedAt: { lt: parseDay(day(-20)) } }, orderBy: { startedAt: 'asc' } }) })),
        );
        const best = counted.sort((a, b) => b.entries.length - a.entries.length)[0];
        if (!best?.entries.length) return;
        const seconds = best.entries.reduce((sum, entry) => sum + (entry.duration ?? 0), 0);
        const done = [...new Set(best.entries.map((entry) => entry.description?.split('\n')[0]).filter(Boolean))].slice(0, 8);
        const draft = await createDocument(
          'INVOICE',
          await fields('INVOICE', best.client, day(-20), {
            title: 'Temps passé',
            paymentTerms: 'À réception',
            dueDate: day(-20),
            projectId: projects.find((project) => project.id === best.entries[0].projectId)?.id ?? null,
            serviceStart: best.entries[0].startedAt.toISOString().slice(0, 10),
            serviceEnd: best.entries[best.entries.length - 1].startedAt.toISOString().slice(0, 10),
            lines: [line(item('Développement'), Math.round((seconds / 3600) * 100) / 100, { description: done.map((text) => `- ${text}`).join('\n') || null })],
            timeEntryIds: best.entries.map((entry) => entry.id),
          }),
        );
        ids.timeInvoice = await finalize(draft.id, day(-20));
      },
    ],
  ];
  timeline.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [date, step] of timeline) {
    await issueDueInvoices(date);
    await step();
  }
  await issueDueInvoices(today);

  // --- Drafts ------------------------------------------------------------------------------------------
  const unbilled = await prisma.timeEntry.findMany({ where: { projectId: { in: projects.filter((project) => project.clientId === clientD.id).map((project) => project.id) }, documentId: null, duration: { not: null } } });
  const draftSeconds = unbilled.slice(0, 4).reduce((sum, entry) => sum + (entry.duration ?? 0), 0);
  await createDocument(
    'INVOICE',
    await fields('INVOICE', clientD, day(-2), {
      title: 'Développement — brouillon',
      lines: draftSeconds ? [line(item('Développement'), Math.round((draftSeconds / 3600) * 100) / 100)] : [line(item('Journée de développement'), 2)],
      timeEntryIds: draftSeconds ? unbilled.slice(0, 4).map((entry) => entry.id) : [],
    }),
  );
  await createDocument('QUOTE', await fields('QUOTE', clientD, day(-1), { title: 'Application mobile — première version', lines: [line(item('Maquettes'), 1), line(item('Journée de développement'), 20)] }));

  // --- Tracking: sending, acceptance, refusal ----------------------------------------------------------
  const sent = async (id: string | undefined, date: string) => {
    if (!id) return;
    await markSent(id);
    await prisma.accountingDocument.update({ where: { id }, data: { sentAt: new Date(`${date}T09:30:00`) } });
  };
  const finals = await prisma.accountingDocument.findMany({ where: { status: 'FINAL' }, select: { id: true, issueDate: true } });
  for (const document of finals) await sent(document.id, document.issueDate.toISOString().slice(0, 10));
  await acceptQuote(ids.quoteA, day(-152), null);
  await acceptQuote(ids.quoteB, day(-112), null);
  await setTrackingStatus(ids.refusedC, (await statusOf('QUOTE', 'REFUSED')).id);

  // --- Payments, refunds and reminders -----------------------------------------------------------------
  const due = async (id: string) => ((await documentBalances()).get(id)?.balance ?? 0) / 100;
  const pay = async (id: string | undefined, date: string, share = 1, fixed?: number) => {
    if (!id) return;
    const amount = fixed ?? Math.round((await due(id)) * share * 100) / 100;
    if (amount > 0) await recordPayment(id, { accountId: bank.id, date, amount, methodId: methodOf(faker.helpers.arrayElement(['Virement', 'Virement', 'Chèque'])) });
  };
  const remind = (id: string | undefined, date: string, note: string) => id && prisma.documentReminder.create({ data: { documentId: id, date: new Date(`${date}T11:00:00`), note } });

  await pay(ids.archived, day(-150));
  await pay(ids.depositA, day(-140));
  await pay(ids.maintenanceB, day(-118));
  await remind(ids.invoiceB, day(-65), 'Relance par mail');
  // Paid in full before its credit note was taken into account: the credit note is refunded.
  await pay(ids.invoiceB, day(-60), 1, Number((await findDocument(ids.invoiceB)).totalGross));
  await pay(ids.creditB, day(-50));
  await pay(ids.invoiceFromQuoteB, day(-80));
  await pay(ids.invoiceA, day(-40), 0.5);
  await remind(ids.invoiceA, day(-30), 'Relance par mail');
  await remind(ids.invoiceA, day(-15), 'Appel : paiement du solde promis sous quinzaine');
  await pay(ids.invoiceD, day(-20));
  // Recurring invoices are paid about a week after they are issued, except the last one.
  const generated = await prisma.accountingDocument.findMany({ where: { recurringId: { not: null }, status: 'FINAL' }, orderBy: { issueDate: 'asc' } });
  for (const invoice of generated.slice(0, -1)) await pay(invoice.id, addDays(invoice.issueDate.toISOString().slice(0, 10), 8));

  // --- Imported documents (issued before Ordo) ---------------------------------------------------------
  const importedBase = { dueDate: null, projectId: null, note: null, currency: 'EUR' };
  await importDocument({ ...importedBase, type: 'INVOICE', number: 'FA-2025-118', issueDate: day(-210), dueDate: day(-180), clientId: clientA.id, clientName: null, title: 'Audit du site', totalNet: 1500, totalVat: 300, totalGross: 1800, settled: true }, null);
  const unsettled = await importDocument(
    { ...importedBase, type: 'INVOICE', number: 'FA-2025-131', issueDate: day(-195), dueDate: day(-165), clientId: clientD.id, clientName: null, title: 'Développement', totalNet: 2400, totalVat: 480, totalGross: 2880, settled: false },
    null,
  );
  await importDocument({ ...importedBase, type: 'QUOTE', number: 'DEV-2025-044', issueDate: day(-220), clientId: clientB.id, clientName: null, title: 'Refonte (première version)', totalNet: 6000, totalVat: 1200, totalGross: 7200, settled: true }, null);
  await importDocument({ ...importedBase, type: 'INVOICE', number: '2025-07', issueDate: day(-240), clientId: null, clientName: 'Association Les Amis du Vélo', title: 'Affiche', totalNet: 350, totalVat: 0, totalGross: 350, settled: true }, null);
  await createEntry({
    accountId: bank.id,
    status: 'ACTUAL',
    date: day(-160),
    label: `Règlement FA-2025-131 — ${clientD.name}`,
    amount: 2880,
    ...entryBase,
    categoryId: categoryOf('Prestations', 2880),
    methodId: methodOf('Virement'),
    clientId: clientD.id,
    allocations: [{ documentId: null, importedDocumentId: unsettled.id, amount: 2880 }],
  });

  // --- Expenses: repeated forecasts realized month after month, one-off movements, coming expenses -------
  const repeated = [
    { label: 'Loyer du bureau', amount: -750, category: 'Loyer', method: 'Prélèvement', payee: 'Agence immobilière du Centre', start: day(-175), recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }) },
    { label: 'Abonnements logiciels', amount: -89, category: 'Logiciels', method: 'Carte', start: day(-170), recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }) },
    { label: 'URSSAF', amount: -1450, category: 'Charges sociales', method: 'Prélèvement', payee: 'URSSAF', start: day(-165), recurrence: rule({ frequency: 'MONTHLY', interval: 3, monthlyMode: 'DAY' }) },
    { label: 'Frais bancaires', amount: -18, category: 'Frais bancaires', method: 'Prélèvement', payee: 'Banque Populaire', start: day(-178), recurrence: rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }) },
  ];
  for (const forecast of repeated) {
    const created = await createEntry({
      accountId: bank.id,
      status: 'FORECAST',
      date: forecast.start,
      label: forecast.label,
      amount: forecast.amount,
      ...entryBase,
      categoryId: categoryOf(forecast.category, forecast.amount),
      methodId: methodOf(forecast.method),
      counterpartyId: counterpartyOf('payee' in forecast ? forecast.payee : undefined),
      recurrence: forecast.recurrence,
    });
    for (const occurrence of occurrenceDates(forecast.recurrence, forecast.start, forecast.start, day(-1))) {
      // Charges vary a little; some are taken a day or two later.
      const amount = forecast.category === 'Charges sociales' ? forecast.amount - faker.number.int({ min: 0, max: 200 }) : forecast.amount;
      await realizeForecast(created.id, occurrence, { date: addDays(occurrence, faker.helpers.arrayElement([0, 0, 1, 2])), amount });
    }
  }
  const oneOff = [
    { date: day(-130), label: 'Écran 27 pouces', amount: -420, category: 'Matériel', method: 'Carte', payee: 'Boulanger' },
    { date: day(-96), label: 'Déplacement Paris', amount: -128.4, category: 'Déplacements', method: 'Carte', payee: 'SNCF' },
    { date: day(-50), label: 'Déjeuner client', amount: -64, category: 'Repas', method: 'Carte' },
  ];
  for (const entry of oneOff) {
    const { category: name, method, payee, ...fields } = entry;
    await createEntry({ ...entryBase, ...fields, accountId: bank.id, status: 'ACTUAL', categoryId: categoryOf(name, entry.amount), methodId: methodOf(method), counterpartyId: counterpartyOf(payee) });
  }
  // Travel costs paid for a client and refunded by them: linked, they offset each other in the charts.
  const advance = await createEntry({
    ...entryBase,
    accountId: bank.id,
    status: 'ACTUAL',
    date: day(-42),
    valueDate: day(-40),
    label: 'Billets de train avancés pour le client',
    amount: -86.2,
    categoryId: categoryOf('Déplacements', -86.2),
    methodId: methodOf('Carte'),
    counterpartyId: counterpartyOf('SNCF'),
  });
  await createEntry({
    ...entryBase,
    accountId: bank.id,
    status: 'ACTUAL',
    date: day(-35),
    valueDate: day(-34),
    label: 'Remboursement des billets de train',
    amount: 86.2,
    categoryId: categoryOf('Remboursements de frais', 86.2),
    methodId: methodOf('Virement'),
    clientId: clientA.id,
    linkedEntryIds: [advance.id],
  });
  for (const entry of [
    { date: day(20), label: 'TVA trimestrielle', amount: -1850, category: 'TVA', method: 'Prélèvement', payee: 'DGFiP' },
    { date: day(40), label: 'Ordinateur portable', amount: -2300, category: 'Matériel', method: 'Carte', payee: 'Boulanger' },
    { date: day(60), label: 'Subvention région (solde)', amount: 3000, category: 'Subventions', method: 'Virement', payee: 'Région' },
  ]) {
    const { category: name, method, payee, ...fields } = entry;
    await createEntry({ ...entryBase, ...fields, accountId: bank.id, status: 'FORECAST', categoryId: categoryOf(name, entry.amount), methodId: methodOf(method), counterpartyId: counterpartyOf(payee) });
  }
}
