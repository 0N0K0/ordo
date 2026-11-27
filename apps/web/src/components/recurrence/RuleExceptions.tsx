import type { Recurrence } from '@ordo/shared';
import { ExceptionsList } from './ExceptionsList';
import { ruleDayAdding, skippedLines, withoutSkipped } from './exceptions';

/**
 * « Rien » exceptions of a single rule to change, in a repetition modal (event, alarm, treasury, invoicing): each
 * restored, and one added on a day of the rule.
 * @param {{ rule: Recurrence, onChange: (rule: Recurrence) => void, start: string }} props Rule edited, its change, its first day.
 * @returns {JSX.Element} List.
 */
export function RuleExceptions({ rule, onChange, start }: { rule: Recurrence; onChange: (rule: Recurrence) => void; start: string }) {
  return (
    <ExceptionsList
      entries={skippedLines([rule]).map((line) => ({ ...line, onRestore: () => onChange(withoutSkipped(rule, line.day)) }))}
      add={ruleDayAdding(rule, start, onChange)}
    />
  );
}
