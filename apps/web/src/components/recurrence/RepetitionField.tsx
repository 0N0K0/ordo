import { Group, Input, Modal, Stack, Text } from '@mantine/core';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { FormActions } from '../dialogs/FormActions';
import { InModalContext } from '../dialogs/in-modal';
import { ActionButton } from '../actions/ActionButton';
import { ExceptionsSummary } from './ExceptionsSummary';
import { ExceptionsFocusContext } from './exceptions-focus';
import type { ExceptionLine } from './exceptions';

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
  /** Its exceptions in words, summed up under it (`ExceptionsSummary`), changed in the same modal. Optional. */
  exceptions?: (value: V) => ExceptionLine[];
}

/**
 * Repetition of what a panel shows: its summary, and « Modifier » opening every repetition setting in a modal (applied
 * on « Appliquer », dropped on « Annuler »). The same field for schedules, tasks (their « Horaires »), alarms, treasury
 * and invoicing (events and routines edit theirs right in their panel).
 * @template V
 * @param {RepetitionFieldProps<V>} props Component props.
 * @returns {JSX.Element} Field.
 */
export function RepetitionField<V>({ value, onChange, describe, editor, valid, label = 'Répétition', description, error, required, editable = true, emptyText = 'Ne se répète pas', exceptions }: RepetitionFieldProps<V>) {
  const [opened, setOpened] = useState(false);
  // Opened by « Modifier les exceptions »: scrolled to them.
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<V>(value);
  const lines = describe(value);
  /**
   * Opens the modal on a draft of the value: at its top, or scrolled to its exceptions.
   * @param {boolean} [exceptionsFirst] Scrolled to its exceptions. Optional. Default = at its top.
   * @returns {void}
   */
  const open = (exceptionsFirst = false) => {
    setDraft(value);
    setFocused(exceptionsFirst);
    setOpened(true);
  };
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
            onClick={() => open()}
          >
            Modifier
          </ActionButton>
        )}
      </Group>
      {exceptions && (
        <Stack mt="sm">
          <ExceptionsSummary lines={exceptions(value)} onEdit={editable ? () => open(true) : undefined} />
        </Stack>
      )}
      <RepetitionModal opened={opened} onClose={() => setOpened(false)} title={label} draft={draft} setDraft={setDraft} editor={editor} valid={valid} onApply={onChange} exceptionsFirst={focused} />
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
  /** Scrolled to its exceptions once shown (« Modifier les exceptions »). Optional. Default = at its top. */
  exceptionsFirst?: boolean;
}

/**
 * Modal holding every repetition setting, on a draft applied on « Appliquer », dropped on « Annuler » (the field's,
 * or a table cell's).
 * @template V
 * @param {RepetitionModalProps<V>} props Component props.
 * @returns {JSX.Element} Modal.
 */
export function RepetitionModal<V>({ opened, onClose, title, draft, setDraft, editor, valid, onApply, header, exceptionsFirst = false }: RepetitionModalProps<V>) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl">
      <InModalContext.Provider value>
        <ExceptionsFocusContext.Provider value={exceptionsFirst}>
          <DraftSettings draft={draft} setDraft={setDraft} editor={editor} valid={valid} onApply={onApply} onClose={onClose} header={header} />
        </ExceptionsFocusContext.Provider>
      </InModalContext.Provider>
    </Modal>
  );
}

/**
 * Settings of a repetition modal on a draft: what it applies to, the settings, « Appliquer » (refused by `valid`) and
 * « Annuler » in its footer, always visible.
 * @template V
 * @param {Pick<RepetitionModalProps<V>, 'draft' | 'setDraft' | 'editor' | 'valid' | 'onApply' | 'onClose' | 'header'>} props Component props.
 * @returns {JSX.Element} Settings.
 */
function DraftSettings<V>({ draft, setDraft, editor, valid, onApply, onClose, header }: Pick<RepetitionModalProps<V>, 'draft' | 'setDraft' | 'editor' | 'valid' | 'onApply' | 'onClose' | 'header'>) {
  return (
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
  );
}

/**
 * Settings of a repetition modal opened by `openRepetitionModal`: its own draft, from the value given.
 * @template V
 * @param {{ value: V, editor: RepetitionModalProps<V>['editor'], valid?: RepetitionModalProps<V>['valid'], onApply: (value: V) => void, onClose: () => void }} props Value, settings, validity, applying, closing.
 * @returns {JSX.Element} Settings.
 */
export function OpenedDraft<V>({ value, editor, valid, onApply, onClose }: { value: V; editor: RepetitionModalProps<V>['editor']; valid?: RepetitionModalProps<V>['valid']; onApply: (value: V) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<V>(value);
  return <DraftSettings draft={draft} setDraft={setDraft} editor={editor} valid={valid} onApply={onApply} onClose={onClose} />;
}
