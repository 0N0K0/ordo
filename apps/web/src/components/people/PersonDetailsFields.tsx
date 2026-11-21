import { SimpleGrid, Stack } from '@mantine/core';
import type { LabelledEmail, Phone, Reminder, ReminderFields } from '@ordo/shared';
import { ContactListField } from '../inputs/ContactListField';
import { RemindersSelect } from '../inputs/RemindersSelect';
import { BirthDateField } from './BirthDateField';

/** Binding of a field saved on leaving it (`useFieldSave().fieldProps`). */
interface FieldBinding<T> {
  value: T;
  onChange: (value: T) => void;
  onBlur: () => void;
}

interface PersonDetailsFieldsProps {
  birthDate: FieldBinding<string | null>;
  /** Reminders of the birthday, saved as soon as they change. */
  birthdayReminders: { value: readonly ReminderFields[]; onChange: (reminders: Reminder[]) => void };
  emails: FieldBinding<LabelledEmail[]>;
  phones: FieldBinding<Phone[]>;
  /** Errors of the form, by path. */
  errors: Record<string, unknown>;
  /** Errors of the email addresses, by path inside the list (`nestedErrors`). */
  emailErrors: Record<string, string | undefined>;
  /** Errors of the phones, by path inside the list (`nestedErrors`). */
  phoneErrors: Record<string, string | undefined>;
}

/**
 * Details of a contributor (member of the team or household included) or of a relation (lot 16), the same in both
 * panels: birth date (year optional) and the reminders of its birthday (« À HH:MM » or « N jours avant, à HH:MM »,
 * disabled without birth date), email addresses (several, lot 16c) and phones, the same labelled list field
 * (`ContactListField`, the one of the phones of the clients and their contacts).
 * @param {PersonDetailsFieldsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function PersonDetailsFields({ birthDate, birthdayReminders, emails, phones, errors, emailErrors, phoneErrors }: PersonDetailsFieldsProps) {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {/* eslint-disable-next-line no-restricted-syntax -- PersonDetailsFields itself. */}
        <BirthDateField {...birthDate} error={errors.birthDate as string | undefined} />
        <RemindersSelect
          kinds={['at', 'days']}
          label="Rappels d’anniversaire"
          description={birthDate.value ? 'Le jour même ou quelques jours avant, à une heure.' : 'Donnez une date de naissance pour des rappels.'}
          disabled={!birthDate.value}
          value={birthdayReminders.value}
          onChange={birthdayReminders.onChange}
          error={errors.birthdayReminders as string | undefined}
        />
      </SimpleGrid>
      <ContactListField kind="emails" {...emails} errors={emailErrors} />
      <ContactListField kind="phones" {...phones} errors={phoneErrors} />
    </Stack>
  );
}
