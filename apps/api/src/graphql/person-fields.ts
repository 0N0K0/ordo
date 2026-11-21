import type { InputFields } from './builder';
import { ReminderInput } from './reminder-fields';

/** Description of a birth date, the same on every type (contributors, relations). */
export const BIRTH_DATE_DESCRIPTION = 'Birth date: YYYY-MM-DD, or --MM-DD when the year is not known. Its birthday shows in the calendar (query birthdays).';

/**
 * Input fields of the details of a person (contributor, relation): birth date, birthday reminders, email
 * addresses, phones; omitted: left unchanged.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
export function personDetailsInputFields(t: InputFields) {
  return {
    birthDate: t.string({ description: `${BIRTH_DATE_DESCRIPTION} Empty: none.` }),
    birthdayReminders: t.field({ type: [ReminderInput], description: 'Reminders of its birthday « À HH:MM » or « N jours avant, à HH:MM », 10 at most.' }),
    emails: t.field({ type: 'JSON', description: '[{ label, address }]: email addresses, 10 at most.' }),
    phones: t.field({ type: 'JSON', description: '[{ label, number }], 10 at most.' }),
  };
}
