import { z } from 'zod';
import { readStoredList, shortTextSchema } from '../core/rules';

/**
 * Ways to reach a person or an organization, one shape for all: labelled lists (`[{ label, <value> }]`) of phone
 * numbers (clients, their services and contacts; contributors, members and relations, lot 16) and of email addresses
 * (contributors, members and relations, lot 16c), and the single email address of the clients and their contacts (the
 * one invoices are sent to).
 */

/** Most entries of a labelled list (phones, email addresses). */
export const LABELLED_LIST_MAX = 10;

/**
 * Schema of an entry of a labelled list: a label (« Mobile », « Travail »…) and its value under a key of its own.
 * @template {string} K
 * @template {z.ZodType} V
 * @param {K} key Key of the value (`number`, `address`).
 * @param {V} value Schema of the value.
 * @returns {z.ZodObject} Schema of an entry.
 */
function labelledEntrySchema<K extends string, V extends z.ZodType>(key: K, value: V) {
  return z.object({ label: shortTextSchema, ...({ [key]: value } as Record<K, V>) });
}

/**
 * Schema of a labelled list (stored as JSON), `LABELLED_LIST_MAX` entries at most.
 * @template {z.ZodType} T
 * @param {T} entry Schema of an entry.
 * @returns {z.ZodArray<T>} Schema of the list.
 */
const labelledListSchema = <T extends z.ZodType>(entry: T) => z.array(entry).max(LABELLED_LIST_MAX);

/** Most characters of a phone number (a format). */
export const PHONE_MAX = 30;

/** A phone number with its label (« Mobile », « Standard »…). */
export const phoneSchema = labelledEntrySchema('number', z.string().trim().min(3, 'Numéro invalide.').max(PHONE_MAX, 'Numéro invalide.'));
export type Phone = z.infer<typeof phoneSchema>;

/** Phone numbers, 10 at most (stored as JSON `[{ label, number }]`). */
export const phonesSchema = labelledListSchema(phoneSchema);

/** Message of an invalid email address. */
const INVALID_EMAIL = 'Adresse email invalide.';

/** Email address of a person or an organization, or none (empty → null); `emailSchema` is the account's, required. */
export const optionalEmailSchema = z
  .union([z.email({ error: INVALID_EMAIL }), z.literal('')])
  .transform((value) => value || null)
  .nullable();

/** An email address with its label (« Personnel », « Travail »…; lot 16c). */
export const labelledEmailSchema = labelledEntrySchema('address', z.string().trim().pipe(z.email({ error: INVALID_EMAIL })));
export type LabelledEmail = z.infer<typeof labelledEmailSchema>;

/** Email addresses of a contributor or a relation, 10 at most (stored as JSON `[{ label, address }]`, lot 16c). */
export const emailsSchema = labelledListSchema(labelledEmailSchema);

/**
 * Phone numbers read from a stored value (invalid ones left out).
 * @param {unknown} value JSON.
 * @returns {Phone[]} Phones.
 */
export const readPhones = (value: unknown): Phone[] => readStoredList(phoneSchema, value);

/**
 * Email addresses read from a stored value (invalid ones left out; lot 16c).
 * @param {unknown} value JSON.
 * @returns {LabelledEmail[]} Addresses.
 */
export const readEmails = (value: unknown): LabelledEmail[] => readStoredList(labelledEmailSchema, value);
