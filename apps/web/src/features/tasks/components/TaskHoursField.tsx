import { Group, Input, Stack, Text } from '@mantine/core';
import { HOURS_START_REQUIRED, hoursCaseNeedsStart, taskHoursSchema, type ScheduleCase } from '@ordo/shared';
import { TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { RepetitionField, RepetitionModal } from '../../../components/recurrence/RepetitionField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { ActionButton } from '../../../components/actions/ActionButton';
import { parisToday } from '../../../lib/dates';
import { ScheduleCases } from '../../calendar/components/ScheduleRepetition';
import { newScheduleCase } from '../../calendar/lib/schedule-text';
import { taskHoursLines } from '../lib/task-hours-text';

/** « À partir du » asked of each case whose rhythm counts from a day (its error shown under it). */
const HOURS_CASE_START = { needed: hoursCaseNeedsStart, message: HOURS_START_REQUIRED };

/**
 * Whether hours edited can be applied (the checks of a créneau, the days rhythms count from).
 * @param {ScheduleCase[]} draft Hours edited.
 * @returns {boolean} Valid.
 */
const validHours = (draft: ScheduleCase[]) => taskHoursSchema.safeParse(draft).success;

/**
 * Settings of the « Horaires » of a task in the repetition modal: the cases of a créneau (days, hours), its first
 * error (the messages of a créneau), « Retirer les horaires »; none: « Ajouter des horaires ».
 * @param {{ draft: ScheduleCase[], setDraft: (hours: ScheduleCase[]) => void, start: string }} props Hours edited, their change, the day new cases start from.
 * @returns {JSX.Element} Settings.
 */
function TaskHoursEditor({ draft, setDraft, start }: { draft: ScheduleCase[]; setDraft: (hours: ScheduleCase[]) => void; start: string }) {
  if (!draft.length)
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Aucun horaire : la tâche est faisable à n’importe quelle heure.
        </Text>
        <AddItemButton onClick={() => setDraft([newScheduleCase(start)])}>Ajouter des horaires</AddItemButton>
      </Stack>
    );
  // A missing « À partir du » shows under its field.
  const issue = taskHoursSchema.safeParse(draft).error?.issues.find((item) => item.message !== HOURS_START_REQUIRED)?.message;
  return (
    <Stack gap="sm">
      <ScheduleCases cases={draft} onChange={setDraft} start={start} caseStart={HOURS_CASE_START} />
      {issue && <Input.Error>{issue}</Input.Error>}
      <Group>
        <ActionButton priority="tertiary" danger icon={<TrashIcon aria-hidden />} onClick={() => setDraft([])}>
          Retirer les horaires
        </ActionButton>
      </Group>
    </Stack>
  );
}

/**
 * « Horaires » of a task: days and hours it can be done, edited as the cases of a créneau (summary, « Modifier » in the
 * repetition modal); none: any time. With a slot condition, the task is doable only when both allow it; nothing in the
 * agenda.
 * @param {{ value: ScheduleCase[], onChange: (hours: ScheduleCase[]) => void, readOnly?: boolean }} props Hours, their change, read only (archived task). Optional `readOnly`. Default = false.
 * @returns {JSX.Element} Field.
 */
export function TaskHoursField({ value, onChange, readOnly = false }: { value: ScheduleCase[]; onChange: (hours: ScheduleCase[]) => void; readOnly?: boolean }) {
  const start = parisToday();
  return (
    <RepetitionField<ScheduleCase[]>
      label="Horaires"
      description="Facultatif : les jours et heures où la tâche est faisable (un cabinet joignable du lundi au vendredi, 9:00–12:00 et 14:00–17:00). Avec une condition de créneaux, quand les deux le permettent."
      emptyText="N’importe quand"
      value={value}
      onChange={onChange}
      editable={!readOnly}
      valid={validHours}
      describe={(hours) => taskHoursLines(hours, start)}
      editor={(draft, setDraft) => <TaskHoursEditor draft={draft} setDraft={setDraft} start={start} />}
    />
  );
}

/**
 * Settings of the « Horaires » of a task in the repetition modal, out of its panel (a table cell): applied on
 * « Appliquer » to it, or to every task selected. Mounted when opened: its draft starts from the hours as they are then.
 * @param {{ value: ScheduleCase[], title: string, onClose: () => void, onApply: (hours: ScheduleCase[]) => void, header?: ReactNode }} props Hours, title, closing, saving, what it applies to. Optional `header`.
 * @returns {JSX.Element} Modal.
 */
export function TaskHoursModal({ value, title, onClose, onApply, header }: { value: ScheduleCase[]; title: string; onClose: () => void; onApply: (hours: ScheduleCase[]) => void; header?: ReactNode }) {
  const [draft, setDraft] = useState<ScheduleCase[]>(value);
  const start = parisToday();
  return (
    <RepetitionModal<ScheduleCase[]>
      opened
      onClose={onClose}
      title={title}
      header={header}
      draft={draft}
      setDraft={setDraft}
      valid={validHours}
      editor={(hours, change) => <TaskHoursEditor draft={hours} setDraft={change} start={start} />}
      onApply={onApply}
    />
  );
}
