import { z } from 'zod';
import { birthdayRemindersSchema } from '../dates/reminders';
import { birthDateSchema } from './birthdays';
import { emailsSchema, phonesSchema } from './contact';

/**
 * Details of a contributor (member of the team or household included) or of a relation (lot 16): birth date (year
 * optional), reminders of its birthday, email addresses (several, lot 16c) and phone numbers (the shape of the phones of
 * the clients and their contacts).
 */
export const personDetailsShape = {
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
