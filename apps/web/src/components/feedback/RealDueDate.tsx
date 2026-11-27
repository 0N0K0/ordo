import { Text, Tooltip } from '@mantine/core';
import * as fmt from '../../lib/format';
import { YesNoIcon } from '../data-table/cells/YesNoIcon';

interface RealDueDateProps {
  /** Real due day (YYYY-MM-DD): the one late state, lists and reminders read; null: none. */
  day: string | null;
  /** Due day of its rule (the stored « Échéance » of a task, the due day of the rule of an occurrence); null: none. */
  ruleDay: string | null;
  /** Why they differ, after the rule's day in the tooltip (« hors horaires », « hors créneaux »). */
  reason: string;
  /** Accessible name of the warning shown when its rule has a due day but no real one (none allowed). */
  noneLabel: string;
}

/**
 * Real due day of an item when it differs from that of its rule, the same for tasks and routine occurrences: the real
 * day (« ven. 27 nov. »), its tooltip telling the rule's (« Échéance du dim. 29 nov., hors horaires »); without a real
 * day although its rule has one, an orange warning triangle named `noneLabel`; nothing when they are the same.
 * @param {RealDueDateProps} props Component props.
 * @returns {JSX.Element | null} Real due day.
 */
export function RealDueDate({ day, ruleDay, reason, noneLabel }: RealDueDateProps) {
  if (!ruleDay || day === ruleDay) return null;
  if (!day) return <YesNoIcon value labels={{ yes: noneLabel, no: noneLabel }} icons={{ yes: 'warning' }} />;
  return (
    <Tooltip label={`Échéance du ${fmt.weekday(ruleDay)}, ${reason}`}>
      <Text span size="sm" tabIndex={0} style={{ whiteSpace: 'nowrap' }}>
        {fmt.weekday(day)}
      </Text>
    </Tooltip>
  );
}
