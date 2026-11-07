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

/** Search folder: mails matching criteria across accounts and folders, kept in Ordo. */
export const mailSearchSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.'),
  /** Accounts searched; empty: every account. */
  accountIds: z.array(z.string()).max(50),
  /** The inboxes, or every folder but the trash, junk, drafts and sent ones. */
  scope: z.enum(['inbox', 'all']),
  state: z.enum(['all', 'todo', 'done']),
  /** Mails with any of these flags; empty: any mail. */
  labelIds: z.array(z.string()).max(50),
  unread: z.boolean(),
  /** Text in the subject, the addresses or the body. */
  text: z.string().trim().max(200, '200 caractères maximum.'),
});
export type MailSearchInput = z.input<typeof mailSearchSchema>;
export type MailSearchCriteria = Omit<z.infer<typeof mailSearchSchema>, 'name'>;
