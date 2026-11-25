import { Stack, Text } from '@mantine/core';
import { recurrenceSchema, type Recurrence } from '@ordo/shared';
import { useState, type FormEvent } from 'react';
import { FormActions } from '../dialogs/FormActions';
import { RecurrenceEditor } from './RecurrenceEditor';

interface MovedRuleFormProps {
  /** Rule proposed (that of the day the occurrence goes to: the last day of the month when that day is one). */
  initial: Recurrence;
  /** Day the moved series is shown from (the occurrence on its new day). */
  start: string;
  /** Gives the rule chosen. */
  onSubmit: (rule: Recurrence) => void;
  /** Gives up the move. */
  onCancel: () => void;
}

/**
 * Form of the new rule of a repetition on the last day of the month moved to another day (« Celle-ci et les
 * suivantes », « Toutes »): not every month has the same length, so the new rule is chosen, never decided. The rule
 * editor of every repetition (`RecurrenceEditor`), prefilled with the rule proposed, its frequency kept (monthly or
 * yearly: the series moves as such).
 * @param {MovedRuleFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MovedRuleForm({ initial, start, onSubmit, onCancel }: MovedRuleFormProps) {
  const [rule, setRule] = useState<Recurrence>(initial);
  const [error, setError] = useState<string | null>(null);
  /**
   * Gives the rule chosen once valid; else tells why under the editor.
   * @param {FormEvent} event Submission.
   * @returns {void}
   */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = recurrenceSchema.safeParse(rule);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Règle invalide.');
    onSubmit(parsed.data);
  };
  return (
    <form noValidate onSubmit={submit}>
      <Stack gap="md">
        <Text size="sm">Cette répétition tombe le dernier jour du mois, et tous les mois n’ont pas le même nombre de jours : choisissez la règle de la série déplacée.</Text>
        <RecurrenceEditor
          value={rule}
          start={start}
          allowNone={false}
          frequencyLocked
          onChange={(next) => {
            if (!next) return;
            setRule(next);
            setError(null);
          }}
        />
        {error && (
          <Text size="xs" c="var(--mantine-color-error)">
            {error}
          </Text>
        )}
        <FormActions submitLabel="Déplacer" onCancel={onCancel} />
      </Stack>
    </form>
  );
}
