import { normalizedReminders, personDetailsChangesSchema, type ReminderFields } from '@ordo/shared';
import type { z } from 'zod';
import { parseInput } from '../../graphql/errors';
import { toJson } from './json';

/** Details of a person as GraphQL takes them: any field may be omitted (left unchanged) or null. */
export interface PersonDetailsFields {
  birthDate?: string | null;
  birthdayReminders?: ReminderFields[] | null;
  email?: string | null;
  /** [{ label, number }], checked here. */
  phones?: unknown;
}

/**
 * Details of a contributor or a relation (lot 16) as Prisma stores them, from what is sent: birth date (`YYYY-MM-DD`
 * or `--MM-DD`), birthday reminders sorted and without duplicates, email, phones. Omitted fields are left out (left
 * unchanged); a null list is empty.
 * @param {PersonDetailsFields} input Details sent.
 * @returns {object} Prisma data.
 */
export function personDetailsData(input: PersonDetailsFields) {
  const parsed: z.output<typeof personDetailsChangesSchema> = parseInput(personDetailsChangesSchema, {
    birthDate: input.birthDate,
    email: input.email,
    birthdayReminders: input.birthdayReminders === null ? [] : input.birthdayReminders,
    phones: input.phones === null ? [] : input.phones,
  });
  return {
    ...(parsed.birthDate !== undefined && { birthDate: parsed.birthDate }),
    ...(parsed.email !== undefined && { email: parsed.email }),
    ...(parsed.birthdayReminders && { birthdayReminders: toJson(normalizedReminders(parsed.birthdayReminders)) }),
    ...(parsed.phones && { phones: toJson(parsed.phones) }),
  };
}
