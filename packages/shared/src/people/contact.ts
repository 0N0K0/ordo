import { z } from 'zod';
import { shortTextSchema } from '../core/rules';

/**
 * Ways to reach a person or an organization, one shape for all: an email address and phone numbers with a label each
 * (clients, their services and contacts; contributors, members and relations, lot 16).
 */

/** Most characters of a phone number (a format). */
export const PHONE_MAX = 30;

/** A phone number with its label (« Mobile », « Standard »…). */
export const phoneSchema = z.object({
  label: shortTextSchema,
  number: z.string().trim().min(3, 'Numéro invalide.').max(PHONE_MAX, 'Numéro invalide.'),
});
export type Phone = z.infer<typeof phoneSchema>;

/** Phone numbers, 10 at most (stored as JSON `[{ label, number }]`). */
export const phonesSchema = z.array(phoneSchema).max(10);

/** Email address of a person or an organization, or none (empty → null); `emailSchema` is the account's, required. */
export const optionalEmailSchema = z
  .union([z.email({ error: 'Adresse email invalide.' }), z.literal('')])
  .transform((value) => value || null)
  .nullable();

/**
 * Phone numbers read from a stored value (invalid ones left out).
 * @param {unknown} value JSON.
 * @returns {Phone[]} Phones.
 */
export function readPhones(value: unknown): Phone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = phoneSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
