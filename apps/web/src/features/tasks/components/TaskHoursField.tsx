import { Group, Input, Stack, Text } from '@mantine/core';
import { taskHoursSchema, type ScheduleCase } from '@ordo/shared';
import { TrashIcon } from '@phosphor-icons/react';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { ActionButton } from '../../../components/actions/ActionButton';
import { localToday } from '../../../lib/dates';
import { ScheduleCases } from '../../calendar/components/ScheduleRepetition';
import { describeScheduleCase, newScheduleCase } from '../../calendar/lib/schedule-text';

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
  const issue = taskHoursSchema.safeParse(draft).error?.issues[0]?.message;
  return (
    <Stack gap="sm">
      <ScheduleCases cases={draft} onChange={setDraft} start={start} />
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
  const start = localToday();
  return (
    <RepetitionField<ScheduleCase[]>
      label="Horaires"
      description="Facultatif : les jours et heures où la tâche est faisable (un cabinet joignable du lundi au vendredi, 9:00–12:00 et 14:00–17:00). Avec une condition de créneaux, quand les deux le permettent."
      emptyText="N’importe quand"
      value={value}
      onChange={onChange}
      editable={!readOnly}
      valid={(draft) => taskHoursSchema.safeParse(draft).success}
      describe={(hours) => hours.map((item) => describeScheduleCase(item, start))}
      editor={(draft, setDraft) => <TaskHoursEditor draft={draft} setDraft={setDraft} start={start} />}
    />
  );
}
