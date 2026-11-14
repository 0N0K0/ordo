import { Button, Group, Input, Modal, Stack, Text } from '@mantine/core';
import type { Recurrence } from '@ordo/shared';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import * as fmt from '../../lib/format';
import { describeRecurrence } from './describe-recurrence';
import { RecurrenceEditor } from './RecurrenceEditor';

interface RecurrenceFieldProps {
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
  /** No repetition is offered (the rule is required). Optional. */
  required?: boolean;
}

/**
 * Repetition of a form, out of its way: the rule told in words and a button opening its editor in a modal (applied on
 * « Appliquer », dropped on « Annuler »).
 * @param {RecurrenceFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RecurrenceField({ value, onChange, start, label = 'Répétition', description, error, required }: RecurrenceFieldProps) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<Recurrence | null>(value);
  return (
    <Input.Wrapper label={label} description={description} error={error} required={required}>
      <Group justify="space-between" gap="sm" wrap="nowrap" mt={4}>
        <Text size="sm" c={value ? undefined : 'dimmed'}>
          {value ? fmt.capitalize(describeRecurrence(value, start)) : 'Ne se répète pas'}
        </Text>
        <Button
          variant="default"
          size="xs"
          leftSection={<PencilSimpleIcon aria-hidden />}
          style={{ flex: 'none' }}
          onClick={() => {
            setDraft(value);
            setOpened(true);
          }}
        >
          Modifier
        </Button>
      </Group>
      <Modal opened={opened} onClose={() => setOpened(false)} title={label} size="lg">
        <Stack gap="md">
          <RecurrenceEditor value={draft} onChange={setDraft} start={start} />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setOpened(false)}>
              Annuler
            </Button>
            <Button
              disabled={required && !draft}
              onClick={() => {
                onChange(draft);
                setOpened(false);
              }}
            >
              Appliquer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Input.Wrapper>
  );
}
