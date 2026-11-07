import { z } from 'zod';

const hostSchema = z.string().trim().min(1, 'Le serveur est requis.').max(255);
const portSchema = z.number({ error: 'Port attendu.' }).int().min(1, 'Port invalide.').max(65_535, 'Port invalide.');

/** Mail account settings. Passwords may be left empty on edition to keep the saved ones. */
export const mailAccountFormSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(80, '80 caractères maximum.'),
  email: z.email({ error: 'Adresse email invalide.' }),
  displayName: z.string().trim().max(120, '120 caractères maximum.'),
  imapHost: hostSchema,
  imapPort: portSchema,
  imapSecure: z.boolean(),
  imapUser: z.string().trim().min(1, 'L’identifiant est requis.').max(255),
  imapPassword: z.string().max(1000),
  smtpHost: hostSchema,
  smtpPort: portSchema,
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().min(1, 'L’identifiant est requis.').max(255),
  smtpPassword: z.string().max(1000),
  saveSent: z.boolean(),
});
export type MailAccountFormValues = z.infer<typeof mailAccountFormSchema>;

/** HTML signature (sanitized by the API). */
export const signatureSchema = z.string().max(100_000, 'Signature trop longue.');

/** List of recipients: email addresses. */
export const recipientsSchema = z.array(z.email({ error: 'Adresse email invalide.' })).max(100, '100 destinataires maximum.');

/** Criteria of a search of mails (search folder, or advanced search). */
export const mailSearchCriteriaSchema = z
  .object({
    /** Accounts searched; empty: every account. */
    accountIds: z.array(z.string()).max(50),
    /** The inboxes, every folder but the trash, junk, drafts and sent ones, or one folder (of one account). */
    scope: z.enum(['inbox', 'all', 'folder']),
    /** Folder path, with the "folder" scope. */
    folder: z.string().max(500).nullable().default(null),
    state: z.enum(['all', 'todo', 'done']),
    /** Mails with any of these flags; empty: any mail. */
    labelIds: z.array(z.string()).max(50),
    unread: z.boolean(),
    /** Text in the subject, the addresses or the body. */
    text: z.string().trim().max(200, '200 caractères maximum.'),
    from: z.string().trim().max(200, '200 caractères maximum.').default(''),
    to: z.string().trim().max(200, '200 caractères maximum.').default(''),
    subject: z.string().trim().max(200, '200 caractères maximum.').default(''),
    body: z.string().trim().max(200, '200 caractères maximum.').default(''),
    /** Dates included (YYYY-MM-DD). */
    since: z.iso.date().nullable().default(null),
    until: z.iso.date().nullable().default(null),
    attachments: z.boolean().default(false),
  })
  .superRefine((criteria, context) => {
    if (criteria.scope === 'folder' && (!criteria.folder || criteria.accountIds.length !== 1)) {
      context.addIssue({ code: 'custom', path: ['folder'], message: 'Choisissez le dossier (d’une seule boîte).' });
    }
    if (criteria.since && criteria.until && criteria.until < criteria.since) context.addIssue({ code: 'custom', path: ['until'], message: 'La fin doit suivre le début.' });
  });
export type MailSearchCriteria = z.infer<typeof mailSearchCriteriaSchema>;

/** Search folder: a name and its criteria, kept in Ordo. */
export const mailSearchSchema = z.object({ name: z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.') }).and(mailSearchCriteriaSchema);
export type MailSearchInput = z.input<typeof mailSearchSchema>;

/** Criteria of a new search (every account, inboxes, to do). */
export const EMPTY_MAIL_SEARCH: MailSearchCriteria = {
  accountIds: [],
  scope: 'inbox',
  folder: null,
  state: 'all',
  labelIds: [],
  unread: false,
  text: '',
  from: '',
  to: '',
  subject: '',
  body: '',
  since: null,
  until: null,
  attachments: false,
};
