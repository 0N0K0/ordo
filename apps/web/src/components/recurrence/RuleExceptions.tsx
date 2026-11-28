import type { Recurrence } from '@ordo/shared';
import { ExceptionsList, type ExceptionEntry } from './ExceptionsList';
import { ruleDayAdding, skippedLines, withoutSkipped } from './exceptions';

/**
 * « Rien » exceptions of a single rule to change, in a repetition modal (event, alarm, treasury, invoicing): each
 * restored, and one added on a day of the rule; the other exceptions of the item (an event's occurrences cancelled or
 * changed alone) among them.
 * @param {{ rule: Recurrence, onChange: (rule: Recurrence) => void, start: string, others?: readonly ExceptionEntry[] }} props Rule edited, its change, its first day, other exceptions (optional).
 * @returns {JSX.Element} List.
 */
export function RuleExceptions({ rule, onChange, start, others = [] }: { rule: Recurrence; onChange: (rule: Recurrence) => void; start: string; others?: readonly ExceptionEntry[] }) {
  return (
    <ExceptionsList
      entries={[...others, ...skippedLines([rule]).map((line) => ({ ...line, onRestore: () => onChange(withoutSkipped(rule, line.day)) }))]}
      add={ruleDayAdding(rule, start, onChange)}
    />
  );
}
