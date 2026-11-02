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
