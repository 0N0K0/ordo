import { Text, Tooltip } from '@mantine/core';
import * as fmt from '../../lib/format';
import { YesNoIcon } from '../data-table/cells/YesNoIcon';
import { realDueTooltip, type RealDue } from './real-due';

/**
 * Warning of an item whose rule has a due day but no real one (no day allowed): an orange triangle, named `label`.
 * @param {{ label: string }} props Component props: its accessible name.
 * @returns {JSX.Element} Warning.
 */
export function RealDueWarning({ label }: { label: string }) {
  return <YesNoIcon value labels={{ yes: label, no: label }} icons={{ yes: 'warning' }} />;
}

/**
 * Real due day of an item, the same for tasks and routine occurrences, shown alone in place of that of its rule: the
 * real day (« ven. 27 nov. »), with a tooltip telling the rule's when they differ (`realDueTooltip`); without a real day
 * although its rule has one, the warning (`RealDueWarning` named `noneLabel`); nothing without any due day. An editor of
 * the due day (a date field) shows it the same way from `realDueTooltip` and `RealDueWarning`.
 * @param {RealDue & { noneLabel: string }} props Component props.
 * @returns {JSX.Element | null} Real due day.
 */
export function RealDueDate({ day, ruleDay, reason, noneLabel }: RealDue & { noneLabel: string }) {
  if (!day) return ruleDay ? <RealDueWarning label={noneLabel} /> : null;
  const tooltip = realDueTooltip({ day, ruleDay, reason });
  const text = (
    <Text span inherit tabIndex={tooltip ? 0 : undefined} style={{ whiteSpace: 'nowrap' }}>
      {fmt.weekday(day)}
    </Text>
  );
  return tooltip ? <Tooltip label={tooltip}>{text}</Tooltip> : text;
}
