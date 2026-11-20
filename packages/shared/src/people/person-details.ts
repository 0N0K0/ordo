import { z } from 'zod';
import { birthdayRemindersSchema } from '../dates/reminders';
import { birthDateSchema } from './birthdays';
import { optionalEmailSchema, phonesSchema } from './contact';

/**
 * Details of a contributor (member of the team or household included) or of a relation (lot 16): birth date (year
 * optional), reminders of its birthday, email address and phone numbers (the shape of the clients and their contacts).
 */
export const personDetailsShape = {
  birthDate: birthDateSchema,
  birthdayReminders: birthdayRemindersSchema,
  email: optionalEmailSchema,
  phones: phonesSchema,
};

/** Details of a person, all given (a new person, a relation saved whole). */
export const personDetailsSchema = z.object(personDetailsShape);
export type PersonDetailsInput = z.input<typeof personDetailsSchema>;

/** Details of a person changed: omitted fields are left unchanged. */
export const personDetailsChangesSchema = personDetailsSchema.partial();
