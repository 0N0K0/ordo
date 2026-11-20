import type { Reminder, ReminderFields } from '@ordo/shared';
import { BellIcon } from '@phosphor-icons/react';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';

interface TaskRemindersProps {
  /** Reminders chosen (« À HH:MM » only). */
  value: readonly ReminderFields[];
  /** « Ouverture » and « Échéance » of the task (YYYY-MM-DD). */
  minDate: string | null | undefined;
  deadline: string | null | undefined;
  onChange: (reminders: Reminder[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * « Rappels » of a task, in its creation form and its panel (decision D16): times of the day, rung every day from its
 * « Ouverture » to its « Échéance » (the « Échéance » day only without « Ouverture »); disabled without « Échéance ».
 * @param {TaskRemindersProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function TaskReminders({ value, minDate, deadline, onChange, error, disabled = false }: TaskRemindersProps) {
  return (
    <RemindersSelect
      kinds={['at']}
      day=""
      label="Rappels"
      description={
        !deadline
          ? 'Donnez-lui une échéance pour recevoir des rappels.'
          : minDate
            ? 'Chaque jour de l’ouverture à l’échéance, à ces heures.'
            : 'Le jour de l’échéance, à ces heures.'
      }
      leftSection={<BellIcon aria-hidden />}
      emptyLabel="Aucun"
      disabled={disabled || !deadline}
      value={value}
      onChange={onChange}
      clearable
      searchable
      error={error}
    />
  );
}
