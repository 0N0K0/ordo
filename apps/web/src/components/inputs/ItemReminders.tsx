import { DAY_REMINDER_KINDS, EVENT_REMINDER_ANCHORS, REMINDER_KINDS, ROUTINE_REMINDER_ANCHORS, type Reminder, type ReminderFields } from '@ordo/shared';
import type { ReactNode } from 'react';
import { RemindersSelect } from './RemindersSelect';

/** Props of the « Rappels » of an item: its reminders, their change, the error of the list, disabled. */
interface ItemRemindersProps {
  value: readonly ReminderFields[];
  onChange: (reminders: Reminder[]) => void;
  error?: ReactNode;
  disabled?: boolean;
}

interface TaskRemindersFieldProps extends ItemRemindersProps {
  /** « Ouverture » and « Échéance » of the task (YYYY-MM-DD). */
  minDate: string | null | undefined;
  deadline: string | null | undefined;
}

/**
 * « Rappels » of a task (its creation form, its panel, the panel of its reminders): times of the day, rung every day
 * from its « Ouverture » to its « Échéance » (the « Échéance » day only without « Ouverture »), or once some days
 * before its « Échéance » (« N jours avant, à HH:MM »); disabled without « Échéance ».
 * @param {TaskRemindersFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function TaskRemindersField({ value, minDate, deadline, onChange, error, disabled = false }: TaskRemindersFieldProps) {
  return (
    <RemindersSelect
      kinds={DAY_REMINDER_KINDS}
      day=""
      dayLabel="Chaque jour"
      label="Rappels"
      description={
        !deadline
          ? 'Donnez-lui une échéance pour recevoir des rappels.'
          : minDate
            ? 'Chaque jour de l’ouverture à l’échéance, à ces heures ; ou quelques jours avant l’échéance.'
            : 'Le jour de l’échéance, à ces heures ; ou quelques jours avant.'
      }
      disabled={disabled || !deadline}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}

/**
 * « Rappels » of a routine (its panel, the panel of its reminders): before its moments or at a time of its days; at a
 * time only when it has no hour.
 * @param {ItemRemindersProps & { timed: boolean }} props Component props, and whether the routine has hours
 *   (`routineHasHours`).
 * @returns {JSX.Element} Field.
 */
export function RoutineRemindersField({ timed, value, onChange, error, disabled }: ItemRemindersProps & { timed: boolean }) {
  return (
    <RemindersSelect
      label="Rappels"
      description={
        timed
          ? 'Pour chaque occurrence : avant le début ou la fin de chaque moment non coché, le jour de l’ouverture ou celui de l’échéance (« dès » / « jusqu’à », l’autre heure selon le temps à y consacrer), 24 h au plus ; ou à une heure de l’un de ces jours ou de quelques jours avant.'
          : 'À une heure du jour de l’ouverture ou de l’échéance, ou de quelques jours avant : donnez une heure « dès » ou « jusqu’à » à ses moments (ou un créneau) pour des rappels avant eux.'
      }
      kinds={timed ? REMINDER_KINDS : DAY_REMINDER_KINDS}
      anchors={ROUTINE_REMINDER_ANCHORS}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
    />
  );
}

/**
 * « Rappels » of an event, for its whole series (its panel, the panel of its reminders): before its start or its end,
 * or at a time of its first or last day or of some days before.
 * @param {ItemRemindersProps & { allDay: boolean }} props Component props, and whether the event lasts whole days.
 * @returns {JSX.Element} Field.
 */
export function EventRemindersField({ allDay, value, onChange, error, disabled }: ItemRemindersProps & { allDay: boolean }) {
  return (
    <RemindersSelect
      label="Rappels"
      description={
        allDay
          ? 'Avant minuit le premier jour (« 6 h avant » : la veille à 18 h), 24 h au plus ; ou à une heure du premier jour ou de quelques jours avant ; ou de même depuis la fin (minuit après le dernier jour).'
          : 'Avant le début, 24 h au plus ; ou à une heure du premier jour ou de quelques jours avant ; ou de même depuis la fin.'
      }
      anchors={EVENT_REMINDER_ANCHORS}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
    />
  );
}
