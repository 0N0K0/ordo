import { Text } from '@mantine/core';
import * as fmt from '../../../lib/format';
import { FEEDBACK_COLORS } from '../../../components/feedback/feedback-colors';
import { NO_TASK_DUE_DAY } from '../lib/task-due';

interface TaskDueNoticeProps {
  task: { effectiveMinDate?: string | null; effectiveDeadline?: string | null; dueDay?: string | null };
}

/**
 * Warnings of the « Échéance » of a task its « Horaires » move, under its dates in its panel (nothing moved): its
 * « Échéance » on a day they exclude (« L’échéance réelle est le ven. 27 nov. : le dim. 29 nov. est hors de ses
 * horaires. »), none allowed within a year before it (`NO_TASK_DUE_DAY`), its real « Échéance » before its
 * « Ouverture » (« L’échéance réelle (ven. 27 nov.) tombe avant l’ouverture. »).
 * @param {TaskDueNoticeProps} props Component props.
 * @returns {JSX.Element | null} Warnings.
 */
export function TaskDueNotice({ task }: TaskDueNoticeProps) {
  const { effectiveMinDate: minDate, effectiveDeadline: deadline, dueDay } = task;
  if (!deadline || dueDay === deadline) return null;
  const lines = !dueDay
    ? [`${NO_TASK_DUE_DAY}.`]
    : [
        `L’échéance réelle est le ${fmt.weekday(dueDay)} : le ${fmt.weekday(deadline)} est hors de ses horaires.`,
        ...(minDate && minDate > dueDay ? [`L’échéance réelle (${fmt.weekday(dueDay)}) tombe avant l’ouverture.`] : []),
      ];
  return (
    <Text span inherit c={FEEDBACK_COLORS.warning} display="block">
      {lines.join(' ')}
    </Text>
  );
}
