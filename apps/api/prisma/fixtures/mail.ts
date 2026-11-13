import { fakerFR as faker } from '@faker-js/faker';
import { addDays, EMPTY_MAIL_SEARCH } from '@ordo/shared';
import { ImapFlow } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer';
import { prisma } from '../../src/db';
import type { Project } from '../../src/generated/prisma/client';
import { closeImap } from '../../src/services/mail/imap';
import { copyToProject } from '../../src/services/mail/linked';
import { createLabel, markMails } from '../../src/services/mail/organize';
import { fetchParsed } from '../../src/services/mail/reader';
import { scheduleMail } from '../../src/services/mail/scheduled';
import { createSearch } from '../../src/services/mail/searches';
import { encryptSecret } from '../../src/services/mail/secret';

/** Mailbox of the fixtures: IMAP on GreenMail, sending through Mailpit (see docker-compose.yml). */
export const DEMO_MAILBOX = {
  email: 'moi@atelier-demo.fr',
  password: 'ordo-dev',
  imap: { host: 'localhost', port: 3143 },
  smtp: { host: 'localhost', port: 1025 },
};
const ME = { name: 'Atelier Ordo (démo)', address: DEMO_MAILBOX.email };
/** Names servers give in French ("Archive" is the name recognized as the archive folder). */
const FOLDERS = { sent: 'Envoyés', drafts: 'Brouillons', archive: 'Archive', trash: 'Corbeille' };

interface Mail {
  folder: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  subject: string;
  text: string;
  /** YYYY-MM-DD and hour. */
  date: string;
  hour: number;
  seen?: boolean;
  flagged?: boolean;
  /** Message replied to (key of another mail). */
  replyTo?: string;
  key?: string;
  attachment?: { filename: string; content: string; contentType: string };
  /** Copied into this project. */
  projectId?: string | null;
}

/**
 * Small PDF with one line of text.
 * @param {string} text Text.
 * @returns {string} PDF source.
 */
export function tinyPdf(text: string): string {
  const stream = `BT /F1 14 Tf 72 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${body}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

/**
 * Mailbox of the fixtures: the Ordo account (IMAP on GreenMail, SMTP on Mailpit) and its messages, received,
 * sent, drafted and archived, some of them linked to projects. The GreenMail mailbox is emptied first.
 * Skipped with a warning when MAIL_ENCRYPTION_KEY is missing or GreenMail is not running.
 * @param {{ projects: Project[], today: string }} context Projects and today.
 * @returns {Promise<void>}
 */
export async function seedMailbox({ projects, today }: { projects: Project[]; today: string }): Promise<void> {
  if (!process.env.MAIL_ENCRYPTION_KEY) {
    console.warn('Boîte mail de démo non créée : MAIL_ENCRYPTION_KEY manque dans .env.');
    return;
  }
  const client = new ImapFlow({ ...DEMO_MAILBOX.imap, secure: false, auth: { user: DEMO_MAILBOX.email, pass: DEMO_MAILBOX.password }, logger: false });
  try {
    await client.connect();
  } catch {
    console.warn('Boîte mail de démo non créée : GreenMail ne répond pas (docker compose up -d greenmail).');
    return;
  }

  // --- Empty mailbox (folders are emptied, not deleted: Ordo may have them open) -----------------------
  const existing = new Set((await client.list()).map((folder) => folder.path));
  for (const folder of Object.values(FOLDERS)) if (!existing.has(folder)) await client.mailboxCreate(folder);
  for (const folder of ['INBOX', ...Object.values(FOLDERS)]) {
    const lock = await client.getMailboxLock(folder);
    try {
      if (client.mailbox && client.mailbox.exists > 0) await client.messageDelete('1:*');
    } finally {
      lock.release();
    }
  }

  // --- Ordo account ----------------------------------------------------------------------------------
  await prisma.mailAccount.deleteMany({ where: { email: DEMO_MAILBOX.email } });
  const account = await prisma.mailAccount.create({
    data: {
      name: 'Démo',
      email: DEMO_MAILBOX.email,
      displayName: ME.name,
      imapHost: DEMO_MAILBOX.imap.host,
      imapPort: DEMO_MAILBOX.imap.port,
      imapSecure: false,
      imapUser: DEMO_MAILBOX.email,
      imapPassword: encryptSecret(DEMO_MAILBOX.password),
      smtpHost: DEMO_MAILBOX.smtp.host,
      smtpPort: DEMO_MAILBOX.smtp.port,
      smtpSecure: false,
      smtpUser: DEMO_MAILBOX.email,
      smtpPassword: encryptSecret(DEMO_MAILBOX.password),
      saveSent: true,
      signature: '<p>--<br>Atelier Ordo (démo)<br>04 78 00 00 00 · atelier-demo.fr</p>',
      position: (await prisma.mailAccount.count()) + 1,
    },
  });

  // --- Correspondents: client contacts and their projects ------------------------------------------------
  const contacts = await prisma.clientContact.findMany({ where: { email: { not: null }, client: { archivedAt: null } }, include: { client: true }, orderBy: { createdAt: 'asc' } });
  const projectOf = (clientId: string) => projects.find((project) => project.clientId === clientId && project.parentId === null && !project.archivedAt) ?? null;
  const people = contacts.slice(0, 5).map((contact) => ({
    person: { name: `${contact.firstName} ${contact.lastName}`, address: contact.email! },
    firstName: contact.firstName,
    company: contact.client.name,
    project: projectOf(contact.clientId),
  }));
  if (people.length === 0) {
    console.warn('Boîte mail de démo vide : aucun contact client avec une adresse.');
    await client.logout();
    return;
  }
  const at = (index: number) => people[index % people.length];
  const day = (offset: number) => addDays(today, offset);
  const [a, b, c, d] = [at(0), at(1), at(2), at(3)];

  const mails: Mail[] = [
    {
      key: 'brief',
      folder: 'INBOX',
      from: a.person,
      to: [ME],
      subject: `${a.project?.title ?? 'Notre projet'} : cahier des charges`,
      text: `Bonjour,\n\nComme convenu, voici notre cahier des charges pour ${a.project?.title ?? 'le projet'}. Les points prioritaires sont l’espace client et la prise de rendez-vous.\n\nPouvez-vous nous faire un retour d’ici la fin de semaine ?\n\nBien cordialement,\n${a.person.name}\n${a.company}`,
      date: day(-20),
      hour: 9,
      seen: true,
      attachment: { filename: 'cahier-des-charges.pdf', content: tinyPdf('Cahier des charges - version 2'), contentType: 'application/pdf' },
      projectId: a.project?.id,
    },
    {
      key: 'brief-reply',
      folder: FOLDERS.sent,
      from: ME,
      to: [a.person],
      replyTo: 'brief',
      subject: `Re: ${a.project?.title ?? 'Notre projet'} : cahier des charges`,
      text: `Bonjour ${a.firstName},\n\nMerci pour le cahier des charges. Nous revenons vers vous jeudi avec un planning et une estimation.\n\nBonne journée,\nAtelier Ordo`,
      date: day(-19),
      hour: 14,
      projectId: a.project?.id,
    },
    {
      key: 'brief-answer',
      folder: 'INBOX',
      from: a.person,
      to: [ME],
      replyTo: 'brief-reply',
      subject: `Re: ${a.project?.title ?? 'Notre projet'} : cahier des charges`,
      text: `Parfait, merci. Nous serons disponibles jeudi après-midi pour en parler.\n\n${a.firstName}`,
      date: day(-18),
      hour: 11,
      seen: true,
      projectId: a.project?.id,
    },
    {
      folder: 'INBOX',
      from: b.person,
      to: [ME],
      subject: 'Retours sur les maquettes',
      text: `Bonjour,\n\nL’équipe a regardé les maquettes : nous aimons beaucoup la page d’accueil. Deux remarques :\n- le menu mobile est un peu chargé ;\n- pouvez-vous essayer une variante plus claire du bandeau ?\n\nMerci !\n${b.person.name}`,
      date: day(-6),
      hour: 16,
      seen: true,
      flagged: true,
      projectId: b.project?.id,
    },
    {
      folder: 'INBOX',
      from: c.person,
      to: [ME],
      subject: 'Question sur votre devis',
      text: `Bonjour,\n\nMerci pour votre devis. L’hébergement est-il obligatoire chez vous, ou pouvons-nous garder notre hébergeur actuel ?\n\nCordialement,\n${c.person.name}`,
      date: day(-3),
      hour: 10,
      projectId: c.project?.id,
    },
    {
      folder: 'INBOX',
      from: d.person,
      to: [ME],
      subject: 'Règlement de votre facture',
      text: `Bonjour,\n\nNotre service comptable a programmé le virement de votre dernière facture pour la fin du mois.\n\nBien à vous,\n${d.person.name}\n${d.company}`,
      date: day(-2),
      hour: 15,
    },
    {
      folder: 'INBOX',
      from: b.person,
      to: [ME],
      subject: 'Accès à l’hébergement',
      text: `Bonjour,\n\nPourriez-vous nous transmettre les accès à l’interface d’administration ? Notre nouveau stagiaire doit mettre à jour les actualités.\n\nMerci d’avance,\n${b.firstName}`,
      date: day(-1),
      hour: 8,
      projectId: b.project?.id,
    },
    {
      folder: 'INBOX',
      from: a.person,
      to: [ME],
      subject: 'Bug sur le formulaire de contact',
      text: `Bonjour,\n\nUn client nous signale que le formulaire de contact affiche une erreur sur mobile depuis ce matin. Pouvez-vous regarder en priorité ?\n\nMerci,\n${a.firstName}`,
      date: day(0),
      hour: 8,
      flagged: true,
      projectId: a.project?.id,
    },
    {
      folder: 'INBOX',
      from: { name: 'URSSAF', address: 'ne-pas-repondre@urssaf.fr' },
      to: [ME],
      subject: 'Votre échéancier de cotisations est disponible',
      text: 'Bonjour,\n\nVotre échéancier de cotisations est disponible dans votre espace en ligne.\n\nL’URSSAF',
      date: day(-9),
      hour: 7,
      seen: true,
    },
    {
      folder: 'INBOX',
      from: { name: 'Hébergeur Démo', address: 'facturation@hebergeur-demo.fr' },
      to: [ME],
      subject: 'Votre facture du mois est disponible',
      text: 'Bonjour,\n\nVotre facture d’hébergement est disponible dans votre espace client. Elle sera prélevée sous 5 jours.\n\nL’équipe Hébergeur Démo',
      date: day(-12),
      hour: 6,
      seen: true,
      attachment: { filename: 'facture-hebergement.pdf', content: tinyPdf('Facture hebergement - 25,00 EUR'), contentType: 'application/pdf' },
    },
    {
      folder: 'INBOX',
      from: { name: faker.person.fullName(), address: 'contact@prospect-demo.fr' },
      to: [ME],
      subject: 'Demande de devis pour une application mobile',
      text: 'Bonjour,\n\nNous cherchons un prestataire pour développer une application mobile de réservation. Seriez-vous disponible pour un premier échange la semaine prochaine ?\n\nCordialement',
      date: day(-4),
      hour: 17,
    },
    {
      folder: FOLDERS.sent,
      from: ME,
      to: [b.person],
      subject: 'Nouvelles maquettes',
      text: `Bonjour ${b.firstName},\n\nVoici la variante plus claire du bandeau et un menu mobile simplifié. Dites-nous ce que vous en pensez.\n\nBonne journée,\nAtelier Ordo`,
      date: day(-4),
      hour: 11,
      projectId: b.project?.id,
    },
    {
      folder: FOLDERS.sent,
      from: ME,
      to: [c.person],
      subject: 'Proposition commerciale',
      text: `Bonjour,\n\nVous trouverez ci-joint notre proposition. Nous restons disponibles pour en discuter.\n\nCordialement,\nAtelier Ordo`,
      date: day(-28),
      hour: 10,
      projectId: c.project?.id,
    },
    {
      folder: FOLDERS.drafts,
      from: ME,
      to: [c.person],
      subject: 'Re: Question sur votre devis',
      text: `Bonjour,\n\nVous pouvez tout à fait garder votre hébergeur actuel : nous retirerons la ligne`,
      date: day(0),
      hour: 9,
    },
    {
      folder: FOLDERS.archive,
      from: d.person,
      to: [ME],
      subject: 'Bon de commande signé',
      text: `Bonjour,\n\nVeuillez trouver notre bon de commande signé.\n\nCordialement,\n${d.person.name}`,
      date: day(-60),
      hour: 14,
      seen: true,
      attachment: { filename: 'bon-de-commande.pdf', content: tinyPdf('Bon de commande signe'), contentType: 'application/pdf' },
      projectId: d.project?.id,
    },
    {
      folder: FOLDERS.archive,
      from: { name: 'Salon du numérique', address: 'inscriptions@salon-demo.fr' },
      to: [ME],
      subject: 'Confirmation de votre inscription',
      text: 'Bonjour,\n\nVotre inscription au Salon du numérique est confirmée. Votre badge vous sera envoyé une semaine avant l’évènement.',
      date: day(-45),
      hour: 9,
      seen: true,
    },
    {
      folder: FOLDERS.trash,
      from: { name: 'Offres exceptionnelles', address: 'promo@spam-demo.fr' },
      to: [ME],
      subject: 'Dernier jour : -70 % sur tout le site',
      text: 'Ne manquez pas nos offres exceptionnelles !',
      date: day(-7),
      hour: 22,
      seen: true,
    },
  ];

  // --- Messages, in date order (threads refer to the Message-ID of earlier ones) --------------------
  const ids = new Map<string, string>();
  const linked: { folder: string; uid: number; projectId: string; sent: boolean }[] = [];
  const inbox = new Map<string, number>();
  const ordered = [...mails].sort((x, y) => `${x.date}${String(x.hour).padStart(2, '0')}`.localeCompare(`${y.date}${String(y.hour).padStart(2, '0')}`));
  for (const mail of ordered) {
    const date = new Date(`${mail.date}T${String(mail.hour).padStart(2, '0')}:${String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0')}:00`);
    const messageId = `<${faker.string.alphanumeric(16)}@${mail.from.address.split('@')[1]}>`;
    if (mail.key) ids.set(mail.key, messageId);
    const parent = mail.replyTo ? ids.get(mail.replyTo) : undefined;
    const raw = await new MailComposer({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      date,
      messageId,
      ...(parent && { inReplyTo: parent, references: [parent] }),
      attachments: mail.attachment ? [mail.attachment] : [],
    })
      .compile()
      .build();
    const flags = [...(mail.seen || mail.folder !== 'INBOX' ? ['\\Seen'] : []), ...(mail.flagged ? ['\\Flagged'] : []), ...(mail.folder === FOLDERS.drafts ? ['\\Draft'] : [])];
    const appended = await client.append(mail.folder, raw, flags, date);
    if (mail.folder === 'INBOX' && appended && appended.uid) inbox.set(mail.subject, appended.uid);
    if (mail.projectId && appended && appended.uid) linked.push({ folder: mail.folder, uid: appended.uid, projectId: mail.projectId, sent: mail.folder === FOLDERS.sent });
  }
  await client.logout();

  // --- Copies in the projects -------------------------------------------------------------------------
  for (const item of linked) {
    await copyToProject(await fetchParsed(account.id, item.folder, item.uid), { projectId: item.projectId, accountId: account.id, sent: item.sent });
  }

  // --- Flags, done mails and search folders (reused when they exist: the kept mail accounts may use them) ------
  const label = async (name: string, color: string) => (await prisma.mailLabel.findFirst({ where: { name } })) ?? (await createLabel({ name, color }));
  const urgent = (await label('Urgent', '#fa5252')).id;
  const billing = (await label('À facturer', '#fab005')).id;
  await label('Personnel', '#e64980');
  const mark = async (subjects: string[], change: Parameters<typeof markMails>[3]) => {
    const uids = subjects.map((subject) => inbox.get(subject)).filter((uid): uid is number => uid !== undefined);
    if (uids.length) await markMails(account.id, 'INBOX', uids, change);
  };
  await mark(['Bug sur le formulaire de contact', 'Accès à l’hébergement'], { labelId: urgent, on: true });
  await mark(['Règlement de votre facture', 'Question sur votre devis'], { labelId: billing, on: true });
  await mark(['Votre échéancier de cotisations est disponible', 'Votre facture du mois est disponible', 'Règlement de votre facture'], { done: true });
  for (const search of [
    { ...EMPTY_MAIL_SEARCH, name: 'À traiter', state: 'todo' as const },
    { ...EMPTY_MAIL_SEARCH, name: 'Mails urgents', scope: 'all' as const, labelIds: [urgent] },
    { ...EMPTY_MAIL_SEARCH, name: 'Avec pièces jointes', scope: 'all' as const, attachments: true },
  ]) {
    if (!(await prisma.mailSearch.findFirst({ where: { name: search.name } }))) await createSearch(search);
  }

  // --- A mail scheduled for tomorrow morning ------------------------------------------------------------
  const sendAt = new Date(`${day(1)}T08:30:00`);
  await scheduleMail(
    {
      accountId: account.id,
      to: [people[0].person.address],
      subject: 'Point de la semaine prochaine',
      html: `<p>Bonjour ${people[0].firstName},</p><p>Je vous propose un point lundi à 10 h pour faire le tour des retours.</p><p>Bonne journée,</p>`,
      projectId: people[0].project?.id ?? null,
    },
    sendAt,
  );
  closeImap(account.id);
}
