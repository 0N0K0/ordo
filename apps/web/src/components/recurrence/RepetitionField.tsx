import { Button, Group, Input, Modal, Stack, Text } from '@mantine/core';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';

interface RepetitionFieldProps<V> {
  value: V;
  onChange: (value: V) => void;
  /** The repetition as text, a line each (mode, cases, times…); none: « Ne se répète pas ». */
  describe: (value: V) => string[];
  /** Every setting, on a draft applied on « Appliquer ». */
  editor: (draft: V, setDraft: (value: V) => void) => ReactNode;
  /** Draft that can be applied (a rule required…). Optional. Default = any. */
  valid?: (draft: V) => boolean;
  /** Label of the field. Optional. Default = « Répétition ». */
  label?: string;
  /** Help under the label. Optional. */
  description?: string;
  /** Error under the field. Optional. */
  error?: ReactNode;
  required?: boolean;
  /** Can be changed. Optional. Default = true. */
  editable?: boolean;
}

/**
 * Repetition of what a panel shows: its summary, and « Modifier » opening every repetition setting in a modal (applied
 * on « Appliquer », dropped on « Annuler »). The same field for events, schedules, tasks, routines, alarms, treasury
 * and invoicing.
 * @template V
 * @param {RepetitionFieldProps<V>} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RepetitionField<V>({ value, onChange, describe, editor, valid, label = 'Répétition', description, error, required, editable = true }: RepetitionFieldProps<V>) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<V>(value);
  const lines = describe(value);
  return (
    <Input.Wrapper label={label} description={description} error={error} required={required}>
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start" mt={4}>
        <Stack gap={2} style={{ minWidth: 0 }}>
          {lines.length ? (
            lines.map((line, index) => (
              <Text key={index} size="sm">
                {line}
              </Text>
            ))
          ) : (
            <Text size="sm" c="dimmed">
              Ne se répète pas
            </Text>
          )}
        </Stack>
        {editable && (
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
        )}
      </Group>
      <Modal opened={opened} onClose={() => setOpened(false)} title={label} size="xl">
        <Stack gap="md">
          {editor(draft, setDraft)}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setOpened(false)}>
              Annuler
            </Button>
            <Button
              disabled={valid ? !valid(draft) : false}
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
