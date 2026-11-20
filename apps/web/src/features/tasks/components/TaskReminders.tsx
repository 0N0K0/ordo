import type { Reminder, ReminderFields } from '@ordo/shared';
import { BellIcon } from '@phosphor-icons/react';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';

interface TaskRemindersProps {
  /** Reminders chosen (« À HH:MM » only). */
  value: readonly ReminderFields[];
  /** « Date min » and « Date max » of the task (YYYY-MM-DD). */
  minDate: string | null | undefined;
  deadline: string | null | undefined;
  onChange: (reminders: Reminder[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * « Rappels » of a task, in its creation form and its panel (decision D16): times of the day, rung every day from its
 * « Date min » to its « Date max » (the « Date max » day only without « Date min »); disabled without « Date max ».
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
          ? 'Donnez-lui une « Date max » pour recevoir des rappels.'
          : minDate
            ? 'Chaque jour de la « Date min » à la « Date max », à ces heures.'
            : 'Le jour de la « Date max », à ces heures.'
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
