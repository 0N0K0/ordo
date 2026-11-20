import type { UseFormReturnType } from '@mantine/form';
import { readPhones, readReminders, type Phone, type Reminder, type ReminderFields } from '@ordo/shared';
import { nestedErrors, type FieldSave } from '../../lib/form';
import type { PersonDetailsFields } from './PersonDetailsFields';

/** Details of a person in a form (lot 16): birth date, birthday reminders, email, phones. */
export type PersonDetailsValues = {
  birthDate: string | null;
  birthdayReminders: ReminderFields[];
  email: string | null;
  phones: Phone[];
};

/** Details of a new person: none. */
export const NO_PERSON_DETAILS_VALUES: PersonDetailsValues = { birthDate: null, birthdayReminders: [], email: null, phones: [] };

/** Details saved on leaving them (the others, the reminders, as soon as they change). */
export const PERSON_DETAILS_ON_BLUR = ['birthDate', 'email', 'phones'] as const;

/**
 * Details of a person as the cache holds them, as form values.
 * @param {{ birthDate?: string | null, birthdayReminders: readonly ReminderFields[], email?: string | null, phones: unknown }} person Contributor or relation.
 * @returns {PersonDetailsValues} Values.
 */
export function personDetailsValues(person: { birthDate?: string | null; birthdayReminders: readonly ReminderFields[]; email?: string | null; phones: unknown }): PersonDetailsValues {
  return { birthDate: person.birthDate ?? null, birthdayReminders: readReminders(person.birthdayReminders), email: person.email ?? null, phones: readPhones(person.phones) };
}

/**
 * Props of `PersonDetailsFields` from the form of a person saved field by field (`useFieldSave`).
 * @template {PersonDetailsValues} V
 * @param {UseFormReturnType<V>} form Form.
 * @param {FieldSave<V>['fieldProps']} fieldProps Binding of the fields saved on leaving them.
 * @returns {Parameters<typeof PersonDetailsFields>[0]} Props.
 */
export function personDetailsProps<V extends PersonDetailsValues>(form: UseFormReturnType<V>, fieldProps: FieldSave<V>['fieldProps']): Parameters<typeof PersonDetailsFields>[0] {
  // The details are those of every person form: their types are those of `PersonDetailsValues`.
  const own = form as unknown as UseFormReturnType<PersonDetailsValues>;
  const bind = fieldProps as unknown as FieldSave<PersonDetailsValues>['fieldProps'];
  return {
    birthDate: bind('birthDate'),
    birthdayReminders: { value: own.values.birthdayReminders, onChange: (reminders: Reminder[]) => own.setFieldValue('birthdayReminders', reminders) },
    email: own.getInputProps('email'),
    phones: bind('phones'),
    errors: own.errors,
    phoneErrors: nestedErrors(own.errors, 'phones'),
  };
}
