import type { Recurrence } from '@ordo/shared';
import * as fmt from '../../lib/format';
import { describeRecurrence } from './describe-recurrence';
import { RepetitionEditor } from './RepetitionEditor';
import { RepetitionField } from './RepetitionField';

interface RuleFieldProps {
  value: Recurrence | null;
  onChange: (value: Recurrence | null) => void;
  /** First date the rule repeats from. */
  start: string;
  /** Label of the field. Optional. Default = « Répétition ». */
  label?: string;
  /** Help under the label. Optional. */
  description?: string;
  /** Error under the field. Optional. */
  error?: string;
  /** A rule is required (« Ne se répète pas » not offered). Optional. */
  required?: boolean;
  /** Weekdays and even / odd weeks offered. Optional. Default = true. */
  weekly?: boolean;
}

/**
 * Repetition made of a single rule, without times (treasury, invoicing): the common repetition field and editor.
 * @param {RuleFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RuleField({ value, onChange, start, label, description, error, required, weekly = true }: RuleFieldProps) {
  return (
    <RepetitionField
      label={label}
      description={description}
      error={error}
      required={required}
      value={value}
      onChange={onChange}
      valid={(draft) => !required || draft !== null}
      describe={(rule) => (rule ? [fmt.capitalize(describeRecurrence(rule, start, weekly))] : [])}
      editor={(draft, setDraft) => (
        <RepetitionEditor
          mode="RULE"
          onModeChange={() => undefined}
          cases={[{ since: null, until: null, anchor: null, rule: draft, times: null }]}
          onChange={(cases) => setDraft(cases[0]?.rule ?? null)}
          start={start}
          weekly={weekly}
          allowNone={!required}
        />
      )}
    />
  );
}
