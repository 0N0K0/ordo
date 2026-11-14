import { closePanel, openPanel } from '../../components/panels/panels';
import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { recurrenceSchema, type Recurrence } from '@ordo/shared';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { describeRecurrence, formatLongDate } from '../../components/recurrence/describe-recurrence';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useSetTaskRecurrence, type Task } from './api';
import type { TaskContext } from './use-task-context';
import { useTaskLink } from './use-task-link';

/**
 * Stored rule of a task, or null.
 * @param {Task} task Task.
 * @returns {Recurrence | null} Rule.
 */
function ruleOf(task: Task): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(task.recurrence);
  return parsed.success ? parsed.data : null;
}

/**
 * Repetition form of a series, in the side panel.
 * @param {{ task: Task, start: string, onDone: () => void }} props First task of the series and its date.
 * @returns {JSX.Element} Form.
 */
function RecurrenceForm({ task, start, onDone }: { task: Task; start: string; onDone: () => void }) {
  const setRecurrence = useSetTaskRecurrence();
  const [rule, setRule] = useState<Recurrence | null>(ruleOf(task));
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        La tâche se répète à partir du {formatLongDate(start)}. Ses occurrences sont créées quand l’agenda affiche leur
        semaine ou leur mois : elles copient la tâche (titre, description, assignés, effort…) avec des dates décalées.
      </Text>
      <RecurrenceEditor value={rule} onChange={setRule} start={start} />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={setRecurrence.isPending}
          onClick={() =>
            setRecurrence.mutate(
              { id: task.id, recurrence: rule },
              {
                onSuccess: () => {
                  notifySuccess(rule ? 'Répétition enregistrée.' : 'La tâche ne se répète plus.');
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Repetition of a task in its panel: the rule of a series, or the series an occurrence belongs to.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskRecurrence({ task, context }: { task: Task; context: TaskContext }) {
  const link = useTaskLink();
  const series = task.seriesId ? context.taskById.get(task.seriesId) : undefined;
  const first = series ?? task;
  const rule = ruleOf(first);
  const start = first.occurrenceDate ?? first.startDate ?? first.endDate;

  /**
   * Opens the repetition form of the series.
   * @returns {void}
   */
  const open = () => {
    if (!start) return;
    const modalId = `task-recurrence-${first.id}`;
    openPanel({
      panelId: modalId,
      title: `Répétition — #${first.number} ${first.title}`,
      children: <RecurrenceForm task={first} start={start} onDone={() => closePanel(modalId)} />,
    });
  };

  return (
    <Stack gap={2}>
      <Text size="sm" fw={500}>
        Répétition
      </Text>
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" c={rule ? undefined : 'dimmed'}>
            {rule && start ? describeRecurrence(rule, start) : start ? 'Ne se répète pas' : 'Donnez une date à la tâche pour la répéter'}
          </Text>
          {series && (
            <Text size="xs" c="dimmed">
              Occurrence du {task.occurrenceDate ? formatLongDate(task.occurrenceDate) : '—'} de{' '}
              <Anchor component={Link} to={link.to(series.id)} size="xs">
                #{series.number}
              </Anchor>
            </Text>
          )}
        </Stack>
        <Button size="compact-sm" variant="default" leftSection={<ArrowsClockwiseIcon aria-hidden />} disabled={!start || task.archived} onClick={open}>
          {rule ? 'Modifier' : 'Répéter'}
        </Button>
      </Group>
    </Stack>
  );
}
