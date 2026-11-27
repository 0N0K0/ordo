import { Group, Input, Modal, Stack, Text } from '@mantine/core';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { FormActions } from '../dialogs/FormActions';
import { InModalContext } from '../dialogs/in-modal';
import { ActionButton } from '../actions/ActionButton';

interface RepetitionFieldProps<V> {
  value: V;
  onChange: (value: V) => void;
  /** The repetition as text, a line each (mode, cases, times…); none: `emptyText`. */
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
  /** Shown without any line. Optional. Default = « Ne se répète pas ». */
  emptyText?: string;
}

/**
 * Repetition of what a panel shows: its summary, and « Modifier » opening every repetition setting in a modal (applied
 * on « Appliquer », dropped on « Annuler »). The same field for schedules, tasks (their « Horaires »), alarms, treasury
 * and invoicing (events and routines edit theirs right in their panel).
 * @template V
 * @param {RepetitionFieldProps<V>} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RepetitionField<V>({ value, onChange, describe, editor, valid, label = 'Répétition', description, error, required, editable = true, emptyText = 'Ne se répète pas' }: RepetitionFieldProps<V>) {
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
              {emptyText}
            </Text>
          )}
        </Stack>
        {editable && (
          <ActionButton
            priority="secondary"
            size="xs"
            icon={<PencilSimpleIcon aria-hidden />}
            style={{ flex: 'none' }}
            onClick={() => {
              setDraft(value);
              setOpened(true);
            }}
          >
            Modifier
          </ActionButton>
        )}
      </Group>
      <RepetitionModal opened={opened} onClose={() => setOpened(false)} title={label} draft={draft} setDraft={setDraft} editor={editor} valid={valid} onApply={onChange} />
    </Input.Wrapper>
  );
}

interface RepetitionModalProps<V> {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Draft edited, applied on « Appliquer ». */
  draft: V;
  setDraft: (value: V) => void;
  /** Every setting. */
  editor: (draft: V, setDraft: (value: V) => void) => ReactNode;
  /** Draft that can be applied. Optional. Default = any. */
  valid?: (draft: V) => boolean;
  onApply: (value: V) => void;
  /** Above the settings (what it applies to…). Optional. */
  header?: ReactNode;
}

/**
 * Modal holding every repetition setting, on a draft applied on « Appliquer », dropped on « Annuler » (the field's,
 * or a table cell's).
 * @template V
 * @param {RepetitionModalProps<V>} props Component props.
 * @returns {JSX.Element} Modal.
 */
export function RepetitionModal<V>({ opened, onClose, title, draft, setDraft, editor, valid, onApply, header }: RepetitionModalProps<V>) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl">
      <InModalContext.Provider value>
        <Stack gap="md">
          {header}
          {editor(draft, setDraft)}
          <FormActions
            onCancel={onClose}
            submitLabel="Appliquer"
            disabled={valid ? !valid(draft) : false}
            onSubmit={() => {
              onApply(draft);
              onClose();
            }}
          />
        </Stack>
      </InModalContext.Provider>
    </Modal>
  );
}
