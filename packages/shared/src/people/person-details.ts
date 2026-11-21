import { z } from 'zod';
import { birthdayRemindersSchema } from '../dates/reminders';
import { birthDateSchema } from './birthdays';
import { emailsSchema, phonesSchema } from './contact';

/**
 * Details of a member of the team or household (« Moi » included) or of a relation: birth date (year optional),
 * reminders of its birthday, email addresses (several) and phone numbers (the shape of the phones of the clients and
 * their contacts). Another contributor has none of its own: its details are those of what it is linked to
 * (`CONTRIBUTOR_LINKS`).
 */
const personDetailsShape = {
  birthDate: birthDateSchema,
  birthdayReminders: birthdayRemindersSchema,
  emails: emailsSchema,
  phones: phonesSchema,
};

/** Details of a person, all given (a new person, a relation saved whole). */
export const personDetailsSchema = z.object(personDetailsShape);
export type PersonDetailsInput = z.input<typeof personDetailsSchema>;

/** Details of a person changed: omitted fields are left unchanged. */
export const personDetailsChangesSchema = personDetailsSchema.partial();
