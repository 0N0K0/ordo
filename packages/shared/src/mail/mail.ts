import { z } from 'zod';
import { END_AFTER_START, endsAfter, requiredText, shortTextSchema } from '../core/rules';
import { daySchema } from '../dates/times';

/** Orders of the mails of a folder; a search sorts on all but the size. */
export const MAIL_SORTS = ['date', 'correspondent', 'subject', 'size'] as const;
/** Field the mails of a folder are sorted on. */
export type MailSortBy = (typeof MAIL_SORTS)[number];
/** Field the mails found by a search are sorted on. */
export type MailSearchSortBy = Exclude<MailSortBy, 'size'>;

/**
 * Field to sort the mails of a folder on, from a value sent by the client: the date when unknown.
 * @param {string | null | undefined} sort Value sent.
 * @returns {MailSortBy} Field.
 */
export function mailSortBy(sort: string | null | undefined): MailSortBy {
  return MAIL_SORTS.find((by) => by === sort) ?? 'date';
}

/**
 * Field to sort the mails found by a search on, from a value sent by the client: the date when unknown (or the size).
 * @param {string | null | undefined} sort Value sent.
 * @returns {MailSearchSortBy} Field.
 */
export function mailSearchSortBy(sort: string | null | undefined): MailSearchSortBy {
  const by = mailSortBy(sort);
  return by === 'size' ? 'date' : by;
}

/** Subject shown for a mail without one. */
export const NO_SUBJECT = '(sans objet)';

/** Most characters of a server name or a login of a mail server (a format, not a free text). */
const SERVER_FIELD_MAX = 255;
/** Most characters of a password of a mail server. */
const SERVER_PASSWORD_MAX = 1000;
/** Most characters of an HTML signature (rich text, out of the shared text sizes). */
const SIGNATURE_MAX = 100_000;
/** Most characters of the path of a mail folder (a format). */
const FOLDER_PATH_MAX = 500;
/** Most characters of an id. */
const ID_MAX = 100;

const hostSchema = z.string().trim().min(1, 'Le serveur est requis.').max(SERVER_FIELD_MAX);
const portSchema = z.number({ error: 'Port attendu.' }).int().min(1, 'Port invalide.').max(65_535, 'Port invalide.');

/** Mail account settings. Passwords may be left empty on edition to keep the saved ones. */
export const mailAccountFormSchema = z.object({
  label: requiredText(),
  email: z.email({ error: 'Adresse email invalide.' }),
  displayName: shortTextSchema,
  imapHost: hostSchema,
  imapPort: portSchema,
  imapSecure: z.boolean(),
  imapUser: z.string().trim().min(1, 'L’identifiant est requis.').max(SERVER_FIELD_MAX),
  imapPassword: z.string().max(SERVER_PASSWORD_MAX),
  smtpHost: hostSchema,
  smtpPort: portSchema,
  smtpSecure: z.boolean(),
  smtpUser: z.string().trim().min(1, 'L’identifiant est requis.').max(SERVER_FIELD_MAX),
  smtpPassword: z.string().max(SERVER_PASSWORD_MAX),
  saveSent: z.boolean(),
});
export type MailAccountFormValues = z.infer<typeof mailAccountFormSchema>;

/** Servers of an account as saved: what its passwords were saved for. */
export type MailServerSettings = Pick<MailAccountFormValues, 'imapHost' | 'imapPort' | 'imapUser' | 'imapSecure' | 'smtpHost' | 'smtpPort' | 'smtpUser' | 'smtpSecure'>;

/** Error of a password to type again: its server changed. */
export const PASSWORD_AGAIN = 'Saisissez à nouveau le mot de passe : le serveur, le port, l’identifiant ou le chiffrement a changé.';

/**
 * Passwords to type again: a saved password is only reused with the server it was saved for, so changing the server,
 * port, login or encryption of a side requires typing its password again (otherwise it could be sent to another
 * server). The same in the web (before saving) and the API.
 * @param {MailAccountFormValues} values New settings.
 * @param {MailServerSettings | null} saved Saved account (none: a new one).
 * @returns {('imapPassword' | 'smtpPassword')[]} Password fields missing.
 */
export function passwordsToRetype(values: MailAccountFormValues, saved: MailServerSettings | null): ('imapPassword' | 'smtpPassword')[] {
  if (!saved) return [];
  const imapChanged = values.imapHost !== saved.imapHost || values.imapPort !== saved.imapPort || values.imapUser !== saved.imapUser || values.imapSecure !== saved.imapSecure;
  const smtpChanged = values.smtpHost !== saved.smtpHost || values.smtpPort !== saved.smtpPort || values.smtpUser !== saved.smtpUser || values.smtpSecure !== saved.smtpSecure;
  return [...(imapChanged && !values.imapPassword ? (['imapPassword'] as const) : []), ...(smtpChanged && !values.smtpPassword ? (['smtpPassword'] as const) : [])];
}

/** Name of a mail folder: a label, without the characters IMAP refuses in it; the same in the web and the API. */
export const mailFolderNameSchema = requiredText().refine((name) => !/[*%"\\]/.test(name), 'Caractères interdits : * % " \\');

/** HTML signature (sanitized by the API). */
export const signatureSchema = z.string().max(SIGNATURE_MAX, 'Signature trop longue.');
/** Signature of an account as its editor holds it. */
export const signatureFormSchema = z.object({ signature: signatureSchema });

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
    folder: z.string().max(FOLDER_PATH_MAX).nullable().default(null),
    state: z.enum(['all', 'todo', 'done']),
    /** Mails with any of these flags; empty: any mail. */
    labelIds: z.array(z.string()).max(50),
    unread: z.boolean(),
    /** Text in the subject, the addresses or the body. */
    text: shortTextSchema,
    from: shortTextSchema.default(''),
    to: shortTextSchema.default(''),
    subject: shortTextSchema.default(''),
    body: shortTextSchema.default(''),
    /** Dates included (YYYY-MM-DD). */
    since: daySchema().nullable().default(null),
    until: daySchema().nullable().default(null),
    attachments: z.boolean().default(false),
    /** Mails linked to this project (their copies in Ordo), found in the folders, the sent ones too. */
    projectId: z.string().max(ID_MAX).nullable().default(null),
  })
  .superRefine((criteria, context) => {
    if (criteria.scope === 'folder' && (!criteria.folder || criteria.accountIds.length !== 1)) {
      context.addIssue({ code: 'custom', path: ['folder'], message: 'Choisissez le dossier (d’une seule boîte).' });
    }
    if (!endsAfter(criteria.since, criteria.until)) context.addIssue({ code: 'custom', path: ['until'], message: END_AFTER_START });
  });
export type MailSearchCriteria = z.infer<typeof mailSearchCriteriaSchema>;

/** Search folder: a label and its criteria, kept in Ordo. */
export const mailSearchSchema = z.object({ label: requiredText() }).and(mailSearchCriteriaSchema);
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
  projectId: null,
};
